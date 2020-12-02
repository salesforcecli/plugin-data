/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ReadStream } from 'fs';
import { Connection, Logger, Messages, SfdxError } from '@salesforce/core';
import parse = require('csv-parse');
import { Batch, BatchInfo, BatchResultInfo, JobInfo } from 'jsforce';
import { UX } from '@salesforce/command';
import { Job as jsforceJob } from 'jsforce/job';

const BATCH_RECORDS_LIMIT = 10000;
const POLL_FREQUENCY_MS = 5000;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/data', 'batcher');

export type Batches = Array<Array<Record<string, string>>>;
export type Job = jsforceJob & { id: string };

export type BulkResult = {
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

export class Batcher {
  /**
   * get and display the job status; close the job if completed
   *
   * @param conn {Connection}
   * @param jobId {string}
   * @param ux
   * @param doneCallback
   */
  public static async fetchAndDisplayJobStatus(
    conn: Connection,
    jobId: string,
    ux: UX,
    doneCallback?: (...args: [{ job: JobInfo }]) => void
  ): Promise<JobInfo> {
    const job: jsforceJob = conn.bulk.job(jobId);
    const jobInfo: JobInfo = await job.check();

    Batcher.bulkBatchStatus(jobInfo, ux);

    if (doneCallback) {
      doneCallback({ job: jobInfo });
    }

    return jobInfo;
  }

  public static bulkBatchStatus(
    summary: JobInfo | BatchInfo,
    ux: UX,
    results?: BatchResultInfo[],
    batchNum?: number,
    isJob?: boolean
  ): void {
    ux.log('');
    if (batchNum) {
      ux.styledHeader(messages.getMessage('BulkBatch', [batchNum]));
    }
    if (results) {
      const errorMessages: string[] = [];
      results.forEach((result: BatchResultInfo): void => {
        if (result.errors) {
          result.errors.forEach((errMsg) => {
            errorMessages.push(errMsg);
          });
        }
      });
      if (errorMessages.length > 0) {
        ux.styledHeader(messages.getMessage('BulkError'));
        errorMessages.forEach((errorMessage) => {
          ux.log(errorMessage);
        });
      }
    }

    const formatOutput: string[] = [];
    for (const field in summary) {
      if (Object.prototype.hasOwnProperty.call(summary, field)) {
        formatOutput.push(field);
      }
    }
    // remove url field
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    delete summary['$'];
    formatOutput.splice(0, 1);

    if (isJob) {
      ux.styledHeader(messages.getMessage('BulkJobStatus'));
    } else {
      ux.styledHeader(messages.getMessage('BatchStatus'));
    }
    ux.styledObject(summary, formatOutput);
  }

  /**
   * create and execute batches based on the record arrays; wait for completion response if -w flag is set with > 0 minutes
   * to get proper logging/printing to console pass the instance of UX that called this method
   *
   * @param job {Job}
   * @param records
   * @param sobjectType {string}
   * @param ux
   * @param conn
   * @param wait {number}
   */
  public static async createAndExecuteBatches(
    job: Job,
    records: ReadStream,
    sobjectType: string,
    ux: UX,
    conn: Connection,
    wait?: number
  ): Promise<BulkResult[]> {
    const batchesCompleted = 0;
    let batchesQueued = 0;
    const overallInfo = false;

    const batches = await Batcher.splitIntoBatches(records);

    // The error handling for this gets quite tricky when there are multiple batches
    // Currently, we bail out early by calling an Error.exit
    // But, we might want to actually continue to the next batch.
    return (await Promise.all(
      batches.map(
        async (batch: Array<Record<string, string>>, i: number): Promise<BulkResult | BatchInfo | void> => {
          const newBatch = job.createBatch();
          return new Promise((resolve, reject) => {
            newBatch.on('error', (err: Error) => {
              // reword no external id error message to direct it to org user rather than api user
              if (err.message.startsWith('External ID was blank')) {
                err.message = messages.getMessage('ExternalIdRequired', [sobjectType]);
              }
              if (err.message.startsWith('Polling time out')) {
                const jobIdIndex = err.message.indexOf('750');
                const batchIdIndex = err.message.indexOf('751');
                ux.log(
                  messages.getMessage('TimeOut', [
                    err.message.substr(jobIdIndex, 18),
                    err.message.substr(batchIdIndex, 18),
                  ])
                );
              }
              reject(err.message);
            });

            newBatch.on('queue', (): void => {
              batchesQueued++;
              if (batchesQueued === batches.length) {
                const id = job.id;
                job.close();
                // jsforce clears out the id after close, but you should be able to close a job
                // after the queue, so add it back so future batch.check don't fail.*/
                job.id = id;
              }
            });

            if (!wait) {
              newBatch.on(
                'queue',
                // we're using an async method on an event listener which doesn't fit the .on method parameter types
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                async (batchInfo: BatchInfo): Promise<void> => {
                  ux.log(messages.getMessage('CheckStatusCommand', [i + 1, batchInfo.jobId, batchInfo.id]));
                  const result: BatchInfo = await newBatch.check();
                  if (result.state === 'Failed') {
                    reject(result.stateMessage);
                  } else {
                    resolve(batchInfo);
                  }
                }
              );
            } else {
              resolve(
                Batcher.waitForCompletion(
                  newBatch,
                  batchesCompleted,
                  overallInfo,
                  i + 1,
                  batches.length,
                  wait,
                  ux,
                  conn
                )
              );
            }

            newBatch.execute(batch, (err) => {
              if (err) {
                reject(err);
              }
            });
          });
        }
      )
    )) as BulkResult[];
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
   * @param ux
   * @param conn
   */
  private static async waitForCompletion(
    newBatch: Batch,
    batchesCompleted: number,
    overallInfo: boolean,
    batchNum: number,
    totalNumBatches: number,
    waitMins: number,
    ux: UX,
    conn: Connection
  ): Promise<void> {
    const logger: Logger = await Logger.child(this.constructor.name);
    newBatch.on(
      'queue',
      // we're using an async method on an event listener which doesn't fit the .on method parameter types
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (batchInfo: BatchInfo): Promise<void> => {
        const result: BatchInfo = await newBatch.check();
        if (result.state === 'Failed') {
          throw SfdxError.wrap(result.stateMessage);
        } else {
          if (!overallInfo) {
            logger.info(messages.getMessage('PollingInfo', [POLL_FREQUENCY_MS / 1000, batchInfo.jobId]));
            overallInfo = true;
          }
        }
        logger.info(messages.getMessage('BatchQueued', [batchNum, batchInfo.id]));
        newBatch.poll(POLL_FREQUENCY_MS, waitMins * 60000);
      }
    );

    newBatch.on(
      'response',
      // we're using an async method on an event listener which doesn't fit the .on method parameter types
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (results: BatchResultInfo[]): Promise<JobInfo> => {
        const summary: BatchInfo = await newBatch.check();
        Batcher.bulkBatchStatus(summary, ux, results, batchNum);
        batchesCompleted++;
        if (batchesCompleted === totalNumBatches) {
          return await Batcher.fetchAndDisplayJobStatus(conn, summary.jobId, ux);
        } else {
          return {} as JobInfo;
        }
      }
    );
  }

  /**
   * registers the listener in charge of distributing all csv records into batches
   *
   * @param readStream - the read stream
   * @returns {Promise<Batches>}
   */
  private static async splitIntoBatches(readStream: ReadStream): Promise<Batches> {
    // split all records into batches
    const batches: Batches = [];
    let batchIndex = 0;
    batches[batchIndex] = [];

    return await new Promise((resolve, reject) => {
      const parser = parse({
        columns: true,
        // library option is snakecase
        // eslint-disable-next-line @typescript-eslint/camelcase
        skip_empty_lines: true,
      });

      readStream.pipe(parser);

      parser.on('data', (element) => {
        batches[batchIndex].push(element);
        if (batches[batchIndex].length === BATCH_RECORDS_LIMIT) {
          // next batch
          batchIndex++;
          batches[batchIndex] = [];
        }
      });

      parser.on('error', (err) => {
        readStream.destroy();
        reject(SfdxError.wrap(err));
      });

      parser.on('end', () => {
        readStream.destroy();
        resolve(batches);
      });
    });
  }
}
