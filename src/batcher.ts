/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EventEmitter } from 'events';
import { ReadStream } from 'fs';
import { Connection, Messages, SfError } from '@salesforce/core';
import { Batch, BatchInfo, BatchState, BulkIngestBatchResult, BulkOperation, Job, JobInfo } from 'jsforce/api/bulk';
import { Schema } from 'jsforce';
import { stringify } from 'csv-stringify/sync';
import { Duration } from '@salesforce/kit';
import parse = require('csv-parse');

// max rows per file in Bulk 1.0
const BATCH_RECORDS_LIMIT = 10000;
/// max characters/bytes per file in Bulk 1.0
const BATCH_BYTES_LIMIT = 10000000;
const POLL_FREQUENCY_MS = 5000;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'batcher');

type BatchEntry = Record<string, string>;
type Batches = BatchEntry[][];

export type BulkResult = {
  $: {
    xmlns: string;
  };
  id: string;
  jobId: string;
  state: BatchState;
  createdDate: string;
  systemModStamp: string;
  numberRecordsProcessed: string;
  numberRecordsFailed: string;
  totalProcessingTime: string;
  apiActiveProcessingTime: string;
  apexProcessingTime: string;
};

export type BatcherReturnType = BulkResult[] | JobInfo[];

export class Batcher extends EventEmitter {
  private batchesCompleted = 0;

  public constructor(private readonly conn: Connection) {
    super();
  }

  /**
   * The timeout error handling is messy so to increase readability
   * break it out into it's own method
   *
   * @param err The timeout Error
   * @private
   */
  private static parseTimeOutError(err: Error, operation: BulkOperation | null): string {
    const jobIdIndex = err.message.indexOf('750');
    const batchIdIndex = err.message.indexOf('751');
    const message = messages.getMessage('TimeOut', [
      operation ?? '',
      err.message.substr(jobIdIndex, 18),
      err.message.substr(batchIdIndex, 18)
    ]);

    process.exitCode = 69;
    return message;
  }

  /**
   * get and display the job status; close the job if completed
   *
   * @param jobId {string}
   * @param doneCallback
   */
  public async fetchJobStatus(
    jobId: string,
    doneCallback?: (...args: [{ job: JobInfo }]) => void
  ): Promise<JobInfo> {
    const job = this.conn.bulk.job(jobId);
    const jobInfo = await job.check();

    this.bulkStatus(jobInfo, undefined, undefined, true);

    if (doneCallback) {
      doneCallback({ job: jobInfo });
    }

    return jobInfo;
  }

  /**
   *
   * Handles massaging the data by filtering out the $ from the response
   */
  public bulkStatus(
    summary: JobInfo | BatchInfo,
    results?: BulkIngestBatchResult,
    batchNum?: number,
    isJob?: boolean
  ): JobInfo | BatchInfo {
    const errorMessages = (results ?? []).flatMap((result) => result.errors);
    this.emit('bulkBatchStatus', { summary, results, batchNum, isJob, errorMessages });
    // remove url field (present if isJob)
    // Object.entries loses type info, but will match the original type
    return Object.fromEntries(Object.entries(summary).filter(([key]) => key !== '$')) as typeof summary;
  }

  /**
   * create and execute batches based on the record arrays; wait for completion response if -w flag is set with > 0 minutes
   * to get proper logging/printing to console pass the instance of UX that called this method
   *
   * @param job {Job}
   * @param records
   * @param sobjectType {string}
   * @param wait {number}
   */
  public async createAndExecuteBatches<J extends Schema, T extends BulkOperation>(
    job: Job<J, T>,
    records: ReadStream,
    sobjectType: string,
    wait?: number
  ): Promise<BulkResult[] | JobInfo[]> {
    let batchesQueued = 0;
    const overallInfo = false;
    let batchTimedOut = false;
    job.on('error', (err) => {
      this.emit('error', err);
    });
    const timeNow = Date.now() + Duration.minutes(wait ?? 0).milliseconds;
    this.emit('bulkStatusTotals', {
      totalRecords: 0,
      totalBatches: 0
    });
    const batches = await splitIntoBatches(records);
    const totalRecords = batches.reduce((acc, batch) => acc + batch.length, 0);

    this.emit('bulkStatusTotals', {
      totalRecords,
      totalBatches: batches.length
    });
    // The error handling for this gets quite tricky when there are multiple batches
    // Currently, we bail out early by calling an Error.exit
    // But, we might want to actually continue to the next batch.
    const batchPromises = batches.map(
      async (batch: Array<Record<string, string>>, i: number): Promise<unknown> => {
        const newBatch = job.createBatch();

        return new Promise((resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          newBatch.on('error', (err: Error): void => {
            // reword no external id error message to direct it to org user rather than api user
            if (err.message.startsWith('External ID was blank')) {
              err.message = messages.getMessage('ExternalIdRequired', [sobjectType]);
              // job.emit('error', err);
              this.emit('error', err);
            }
            if (err.message.startsWith('Unable to find object')) {
              err.message = messages.getMessage('InvalidSObject', [sobjectType]);
              // job.emit('error', err);
              this.emit('error', err);
            }
            if (err.message.startsWith('Polling time out')) {
              err.message = Batcher.parseTimeOutError(err, job.operation);
              // using the reject method for all of the promises wasn't handling errors properly
              // so emit a 'error' on the job.
              if (!batchTimedOut) {
                batchTimedOut = true;
                const error = new SfError(err.message, 'Time Out', [], 69);
                this.emit('batchTimeout', error);
                this.emit('error', error);
                throw error;
              }
            }
          });

          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          newBatch.on(
            'queue',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            async (): Promise<void> => {
              batchesQueued++;
              if (batchesQueued === batches.length) {
                /* jsforce clears out the id after close, but you should be able to close a job
            after the queue, so add it back so future batch.check don't fail.*/

                const id = job.id;
                await job.close();
                job.id = id;
              }
            }
          );

          if (!wait) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            newBatch.on(
              'queue',
              // we're using an async method on an event listener which doesn't fit the .on method parameter types
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              async (batchInfo: BatchInfo): Promise<void> => {
                batchesQueued++;
                if (batchesQueued === batches.length) {
                  this.emit('allBatchesQueued', batchesQueued);
                }
                const result = await newBatch.check();
                if (result.state === 'Failed') {
                  reject(result.stateMessage);
                  this.emit('batchFailed', result.stateMessage);
                } else {
                  resolve(batchInfo);
                }
              }
            );
          } else {
            resolve(this.waitForCompletion(job, newBatch, overallInfo, i + 1, batches.length, Duration.milliseconds(timeNow - Date.now()).minutes));
          }

          let batchResult: unknown;
          resolve((async (): Promise<void> => {
            try {
              batchResult = await newBatch.execute(batch);
            } catch (err) {
              // reject(err);
            }
          })());
          resolve(batchResult);
        });
      }
    );
    try {
      return (await Promise.all(batchPromises)) as BulkResult[];
    } catch (err) {
      throw new SfError('batchError', 'Batch Error', [], 69);
    }

  }

  /**
   * register completion event listeners on the batch
   * exposed for unit testing
   *
   * @param newBatch
   * @param overallInfo
   * @param batchNum
   * @param totalNumBatches
   * @param waitMins
   */
  private async waitForCompletion<J extends Schema, T extends BulkOperation>(
    job: Job<J, T>,
    newBatch: Batch<J, T>,
    overallInfo: boolean,
    batchNum: number,
    totalNumBatches: number,
    waitMins: number): Promise<JobInfo> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      newBatch.on(
        'queue',
        // we're using an async method on an event listener which doesn't fit the .on method parameter types
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (): Promise<void> => {
          const result = await newBatch.check();
          if (result.state === 'Failed') {
            this.emit('batchFailed', result.stateMessage);
            reject(result.stateMessage);
          } else if (!overallInfo) {
            this.emit('batchQueued', batchNum);
            overallInfo = true;
          }
          newBatch.poll(POLL_FREQUENCY_MS, waitMins * Duration.minutes(100).milliseconds);
        }
      );
      // we're using an async method on an event listener which doesn't fit the .on method parameter types
      // eslint-disable-next-line @typescript-eslint/no-floating-promises,@typescript-eslint/no-misused-promises
      newBatch.on('response', async (results: BulkIngestBatchResult): Promise<void> => {
        const summary: BatchInfo = await newBatch.check();
        this.bulkStatus(summary, results, batchNum);
        this.batchesCompleted++;
        if (this.batchesCompleted === totalNumBatches) {
          const jobInfo = await this.fetchJobStatus(summary.jobId);
          const id = job.id;
          if (jobInfo.state !== 'Closed') {
            await job.close();
          }
          job.id = id;
          this.emit('allBatchesDone', jobInfo);
          resolve(jobInfo);
        }
      });
    });
  }
}

/**
 * registers the listener in charge of distributing all csv records into batches
 *
 * @param readStream - the read stream
 * @returns {Promise<Batches>}
 */
export const splitIntoBatches = async (readStream: ReadStream): Promise<Batches> => {
  // split all records into batches
  const batches: Batches = [];
  let batchIndex = 0;
  let batchBytes = 0;
  let batchHeaderBytes = 0;
  batches[batchIndex] = [];

  return new Promise((resolve, reject) => {
    const parser = parse({
      columns: true,
      // library option is snakecase
      // eslint-disable-next-line camelcase
      skip_empty_lines: true,
      bom: true
    });

    readStream.pipe(parser);

    parser.on('data', (element: BatchEntry) => {
      if (!batchHeaderBytes) {
        // capture header byte length
        batchHeaderBytes = Buffer.byteLength(stringify([Object.keys(element)]) + '\n', 'utf8');
        batchBytes = batchHeaderBytes;
      }
      // capture row byte length
      const rowBytes = Buffer.byteLength(stringify([Object.values(element)]) + '\n', 'utf8');
      if (batches[batchIndex].length === BATCH_RECORDS_LIMIT || rowBytes + batchBytes > BATCH_BYTES_LIMIT) {
        // TODO: we can start processing this batch here
        // we need event listeners to remove all of the `await new Promise`
        // next batch
        batchIndex++;
        batches[batchIndex] = [];
        // reset file size to just the headers
        batchBytes = batchHeaderBytes;
      }
      batchBytes += rowBytes;
      batches[batchIndex].push(element);
    });

    parser.on('error', (err) => {
      readStream.destroy();
      reject(SfError.wrap(err));
    });

    parser.on('end', () => {
      readStream.destroy();
      resolve(batches);
    });
  });
};
