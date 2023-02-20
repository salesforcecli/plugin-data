/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ReadStream } from 'fs';
import { Connection, Messages, SfError } from '@salesforce/core';
import { Ux } from '@salesforce/sf-plugins-core';
import { BulkIngestBatchResult, Job, JobInfo, Batch, BatchInfo, BulkOperation } from 'jsforce/api/bulk';
import { Schema } from 'jsforce';
import { stringify } from 'csv-stringify/sync';
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

type BulkResult = {
  $: {
    xmlns: string;
  };
  id: string;
  jobId: string;
  state: string;
  createdDate: string;
  systemModStamp: string;
  numberRecordsProcessed: string;
  numberRecordsFailed: string;
  totalProcessingTime: string;
  apiActiveProcessingTime: string;
  apexProcessingTime: string;
};

export type BatcherReturnType = Awaited<ReturnType<Batcher['createAndExecuteBatches']>>;

export class Batcher {
  public constructor(
    private readonly conn: Connection,
    private readonly ux: Ux,
    private readonly cli: string,
    private readonly separator: string
  ) {}

  /**
   * get and display the job status; close the job if completed
   *
   * @param jobId {string}
   * @param doneCallback
   */
  public async fetchAndDisplayJobStatus(
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
   * Handles ux output and massaging the data by filtering out the $ from the response
   */
  public bulkStatus(
    summary: JobInfo | BatchInfo,
    results?: BulkIngestBatchResult,
    batchNum?: number,
    isJob?: boolean
  ): JobInfo | BatchInfo {
    this.ux.log('');
    if (batchNum) {
      this.ux.styledHeader(messages.getMessage('BulkBatch', [batchNum]));
    }
    const errorMessages = (results ?? []).flatMap((result) => result.errors);
    if (errorMessages.length > 0) {
      this.ux.styledHeader(messages.getMessage('BulkError'));
      errorMessages.forEach((errorMessage) => {
        this.ux.log(errorMessage);
      });
    }

    this.ux.styledHeader(isJob ? messages.getMessage('BulkJobStatus') : messages.getMessage('BatchStatus'));

    // remove url field (present if isJob)
    // Object.entries loses type info, but will match the original type
    const output = Object.fromEntries(Object.entries(summary).filter(([key]) => key !== '$')) as typeof summary;
    this.ux.styledObject(output);

    return output;
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
    const batchesCompleted = 0;
    let batchesQueued = 0;
    const overallInfo = false;

    const batches = await splitIntoBatches(records);

    // The error handling for this gets quite tricky when there are multiple batches
    // Currently, we bail out early by calling an Error.exit
    // But, we might want to actually continue to the next batch.
    return (await Promise.all(
      batches.map(
        async (batch: Array<Record<string, string>>, i: number): Promise<BulkResult | BatchInfo | void | JobInfo> => {
          const newBatch = job.createBatch();

          return new Promise((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            newBatch.on('error', (err: Error) => {
              // reword no external id error message to direct it to org user rather than api user
              if (err.message.startsWith('External ID was blank')) {
                err.message = messages.getMessage('ExternalIdRequired', [sobjectType]);
                job.emit('error', err);
              }
              if (err.message.startsWith('Polling time out')) {
                err.message = this.parseTimeOutError(err);
                // using the reject method for all of the promises wasn't handling errors properly
                // so emit a 'error' on the job.

                job.emit('error', new SfError(err.message, 'Time Out', [], 69));
              }
              this.ux.spinner.stop('Error');
            });

            void newBatch.on(
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
                  this.ux.log(
                    messages.getMessage('CheckStatusCommand', [
                      i + 1,
                      this.cli,
                      this.separator,
                      this.separator,
                      this.separator,
                      batchInfo.jobId,
                      batchInfo.id,
                    ])
                  );
                  const result = await newBatch.check();
                  if (result.state === 'Failed') {
                    reject(result.stateMessage);
                  } else {
                    resolve(batchInfo);
                  }
                }
              );
            } else {
              resolve(this.waitForCompletion(newBatch, batchesCompleted, overallInfo, i + 1, batches.length, wait));
            }

            void newBatch.execute(batch);
          });
        }
      )
    )) as BulkResult[];
  }

  /**
   * The timeout error handling is messy so to increase readability
   * break it out into it's own method
   *
   * @param err The timeout Error
   * @private
   */
  private parseTimeOutError(err: Error): string {
    const jobIdIndex = err.message.indexOf('750');
    const batchIdIndex = err.message.indexOf('751');
    const message = messages.getMessage('TimeOut', [
      this.cli,
      this.separator,
      this.separator,
      this.separator,
      err.message.substr(jobIdIndex, 18),
      err.message.substr(batchIdIndex, 18),
    ]);
    this.ux.log('');
    this.ux.log(message);

    process.exitCode = 69;
    return message;
  }

  /**
   * register completion event listeners on the batch
   * exposed for unit testing
   *
   * @param newBatch
   * @param batchesCompleted
   * @param overallInfo
   * @param batchNum
   * @param totalNumBatches
   * @param waitMins
   */
  private async waitForCompletion<J extends Schema, T extends BulkOperation>(
    newBatch: Batch<J, T>,
    batchesCompleted: number,
    overallInfo: boolean,
    batchNum: number,
    totalNumBatches: number,
    waitMins: number
  ): Promise<JobInfo> {
    return new Promise((resolve, reject) => {
      void newBatch.on(
        'queue',
        // we're using an async method on an event listener which doesn't fit the .on method parameter types
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (batchInfo: BatchInfo): Promise<void> => {
          const result = await newBatch.check();
          if (result.state === 'Failed') {
            reject(result.stateMessage);
          } else if (!overallInfo) {
            this.ux.log(
              messages.getMessage('PollingInfo', [
                this.cli,
                this.separator,
                this.separator,
                this.separator,
                POLL_FREQUENCY_MS / 1000,
                batchInfo.jobId,
              ])
            );
            overallInfo = true;
          }
          this.ux.log(messages.getMessage('BatchQueued', [batchNum, batchInfo.id]));
          newBatch.poll(POLL_FREQUENCY_MS, waitMins * 60000);
        }
      );
      // we're using an async method on an event listener which doesn't fit the .on method parameter types
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      void newBatch.on('response', async (results: BulkIngestBatchResult): Promise<void> => {
        const summary: BatchInfo = await newBatch.check();
        this.bulkStatus(summary, results, batchNum);
        batchesCompleted++;
        if (batchesCompleted === totalNumBatches) {
          resolve(await this.fetchAndDisplayJobStatus(summary.jobId));
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
      bom: true,
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
