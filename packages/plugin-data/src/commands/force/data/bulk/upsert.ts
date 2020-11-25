/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { ReadStream } from 'fs';
import { Batch, BatchInfo, BatchResultInfo, Job as jsforceJob, JobInfo } from 'jsforce';
import { flags, FlagsConfig, UX } from '@salesforce/command';
import { Connection, fs as fscore, Logger, Messages, SfdxError } from '@salesforce/core';
import parse = require('csv-parse');
import { DataCommand } from '../../../../dataCommand';
import Status from './status';

const BATCH_RECORDS_LIMIT = 10000;
const POLL_FREQUENCY_MS = 5000;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.upsert');

export type Batches = Array<Array<Record<string, unknown>>>;
export type Job = jsforceJob & { id: string };

export default class Upsert extends DataCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    externalid: flags.string({
      char: 'i',
      description: messages.getMessage('flags.externalid'),
      required: true,
    }),
    csvfile: flags.string({
      char: 'f',
      description: messages.getMessage('flags.csvfile'),
      required: true,
    }),
    sobjecttype: flags.string({
      char: 's',
      description: messages.getMessage('flags.sobjecttype'),
      required: true,
    }),
    wait: flags.number({
      char: 'w',
      description: messages.getMessage('flags.wait'),
    }),
  };
  public static logger: Logger;

  // public static bulkBatchStatus(
  //   summary: JobInfo | BatchInfo,
  //   ux: UX,
  //   results?: BatchResultInfo[],
  //   batchNum?: number,
  //   isJob?: boolean
  // ): void {
  //   Upsert.prototype.log(''); // newline
  //   if (batchNum) {
  //     ux.styledHeader(messages.getMessage('BulkBatch', [batchNum]));
  //   }
  //   if (results) {
  //     const errorMessages: string[] = [];
  //     results.forEach((result: BatchResultInfo): void => {
  //       if (result.errors) {
  //         result.errors.forEach((errMsg: string): void => {
  //           errorMessages.push(errMsg);
  //         });
  //       }
  //     });
  //     if (errorMessages.length > 0) {
  //       ux.styledHeader(messages.getMessage('BulkError'));
  //       errorMessages.forEach((errorMessage): void => {
  //         ux.log(errorMessage);
  //       });
  //     }
  //   }
  //
  //   const formatOutput: string[] = [];
  //   for (const field in summary) {
  //     if (Object.prototype.hasOwnProperty.call(summary, field)) {
  //       formatOutput.push(field);
  //     }
  //   }
  //   // remove url field
  //   // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  //   // @ts-ignore
  //   delete summary['$'];
  //   formatOutput.splice(0, 1);
  //
  //   if (isJob) {
  //     ux.styledHeader(messages.getMessage('BulkJobStatus'));
  //   } else {
  //     ux.styledHeader(messages.getMessage('BatchStatus'));
  //   }
  //   // just a guess - it was ux.styledHash before
  //   ux.styledObject(summary, formatOutput);
  // }

  /**
   * create and execute batches based on the record arrays; wait for completion response if -w flag is set with > 0 minutes
   * exposed for unit testing
   *
   * to get proper logging/printing to console pass the instance of UX that called this method
   *
   * @param job {Job}
   * @param records
   * @param sobjectType {string}
   * @param ux
   * @param wait {number}
   */
  public static async createAndExecuteBatches(
    job: Job,
    records: ReadStream,
    sobjectType: string,
    ux: UX,
    wait?: number
  ): Promise<unknown[]> {
    const batchesCompleted = 0;
    let batchesQueued = 0;
    const overallInfo = false;

    const batches = await this.splitIntoBatches(records);

    // The error handling for this gets quite tricky when there are multiple batches
    // Currently, we bail out early by calling an Error.exit
    // But, we might want to actually continue to the next batch.
    return await Promise.all(
      batches.map(
        async (batch: Array<Record<string, unknown>>, i: number): Promise<unknown> => {
          const newBatch = job.createBatch();
          return new Promise((resolve, reject) => {
            newBatch.on('error', function (err: Error): void {
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
                /* jsforce clears out the id after close, but you should be able to close a job
              after the queue, so add it back so future batch.check don't fail.*/
                job.id = id;
              }
            });

            if (!wait) {
              newBatch.on(
                'queue',
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
                Upsert.waitForCompletion(newBatch, batchesCompleted, overallInfo, i + 1, batches.length, wait, ux)
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
    );
  }

  /**
   * registers the listener in charge of distributing all csv records into batches
   * exposed for unit testing
   *
   * @param readStream - the read stream
   * @returns {Object[][]}
   */
  public static async splitIntoBatches(readStream: ReadStream): Promise<Batches> {
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
   */
  private static async waitForCompletion(
    newBatch: Batch,
    batchesCompleted: number,
    overallInfo: boolean,
    batchNum: number,
    totalNumBatches: number,
    waitMins: number,
    ux: UX
  ): Promise<void> {
    const logger: Logger = await Logger.child(this.constructor.name);
    newBatch.on(
      'queue',
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
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (results: BatchResultInfo[]): Promise<JobInfo> => {
        const conn = Upsert.prototype.org.getConnection();
        const summary: BatchInfo = await newBatch.check();
        Status.bulkBatchStatus(summary, ux, results, batchNum);
        batchesCompleted++;
        if (batchesCompleted === totalNumBatches) {
          return await Status.fetchAndDisplayJobStatus(conn, summary.jobId, ux);
        } else {
          return {} as JobInfo;
        }
      }
    );
  }

  public async run(): Promise<void> {
    const conn: Connection = this.org.getConnection();
    this.ux.startSpinner('Bulk Upsert');

    await this.throwIfFileDoesntExist(this.flags.csvfile);

    const csvStream: ReadStream = fscore.createReadStream(this.flags.csvfile);

    try {
      const job: Job = conn.bulk.createJob(this.flags.sobjecttype, 'upsert', {
        extIdField: this.flags.externalid,
        concurrencyMode: 'Parallel',
      }) as Job;
      await Upsert.createAndExecuteBatches(job, csvStream, this.flags.sobjecttype, this.ux, this.flags.wait);
      this.ux.stopSpinner();
    } catch (e) {
      this.ux.stopSpinner('error');
      throw SfdxError.wrap(e);
    }
  }
}
