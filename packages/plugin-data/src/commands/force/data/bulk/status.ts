/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { Job, JobInfo, BatchInfo, BatchResultInfo } from 'jsforce';
import { flags, FlagsConfig, UX } from '@salesforce/command';
import { Connection, Messages, SfdxError } from '@salesforce/core';
import { DataCommand } from '../../../../dataCommand';
import Upsert from './upsert';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.status');

export default class Status extends DataCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    batchid: flags.string({
      char: 'b',
      description: messages.getMessage('flags.batchid'),
    }),
    jobid: flags.string({
      char: 'i',
      description: messages.getMessage('flags.jobid'),
      required: true,
    }),
  };
  private conn!: Connection;

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
    const job: Job = conn.bulk.job(jobId);
    const jobInfo: JobInfo = await job.check();

    Status.bulkBatchStatus(jobInfo, ux);

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
    Upsert.prototype.log(''); // newline
    if (batchNum) {
      ux.styledHeader(messages.getMessage('BulkBatch', [batchNum]));
    }
    if (results) {
      const errorMessages: string[] = [];
      results.forEach((result: BatchResultInfo): void => {
        if (result.errors) {
          result.errors.forEach((errMsg: string): void => {
            errorMessages.push(errMsg);
          });
        }
      });
      if (errorMessages.length > 0) {
        ux.styledHeader(messages.getMessage('BulkError'));
        errorMessages.forEach((errorMessage): void => {
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
    // just a guess - it was ux.styledHash before
    ux.styledObject(summary, formatOutput);
  }

  public async run(): Promise<BatchInfo[] | JobInfo> {
    this.ux.startSpinner('Getting Status');
    this.conn = this.org.getConnection();
    if (this.flags.jobid && this.flags.batchid) {
      // view batch status
      const batchStatus = await this.fetchAndDisplayBatchStatus(this.flags.jobid, this.flags.batchid, this.ux);
      this.ux.stopSpinner();
      return batchStatus;
    } else {
      // view job status
      const jobStatus = await Status.fetchAndDisplayJobStatus(this.conn, this.flags.jobid, this.ux);
      this.ux.stopSpinner();
      return jobStatus;
    }
  }

  /**
   * get and display the batch status
   * exposed for unit testing
   *
   * @param jobId {string}
   * @param batchId {string}
   * @param ux
   */
  private async fetchAndDisplayBatchStatus(jobId: string, batchId: string, ux: UX): Promise<BatchInfo[]> {
    const job = this.conn.bulk.job(jobId);
    let found = false;

    const batches: BatchInfo[] = await job.list();
    batches.forEach(function (batch: BatchInfo): void {
      if (batch.id === batchId) {
        Status.bulkBatchStatus(batch, ux);
        found = true;
      }
    });
    if (!found) {
      throw SfdxError.create('@salesforce/plugin-data', 'bulk.status', 'NoBatchFound', [batchId, jobId]);
    }

    return batches;
  }
}
