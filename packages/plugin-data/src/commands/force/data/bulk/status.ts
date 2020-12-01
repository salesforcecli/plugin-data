/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { Job, JobInfo, BatchInfo } from 'jsforce';
import { flags, FlagsConfig } from '@salesforce/command';
import { Connection, Messages, SfdxError } from '@salesforce/core';
import { Batcher } from '@salesforce/data';
import { DataCommand } from '../../../../dataCommand';

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

  public async run(): Promise<BatchInfo[] | JobInfo> {
    this.ux.startSpinner('Getting Status');
    this.conn = this.org.getConnection();
    if (this.flags.jobid && this.flags.batchid) {
      // view batch status
      const job: Job = this.conn.bulk.job(this.flags.jobid);
      let found = false;

      const batches: BatchInfo[] = await job.list();
      batches.forEach((batch: BatchInfo) => {
        if (batch.id === this.flags.batchid) {
          Batcher.bulkBatchStatus(batch, this.ux);
          found = true;
        }
      });
      if (!found) {
        throw SfdxError.create('@salesforce/plugin-data', 'bulk.status', 'NoBatchFound', [
          this.flags.batchid,
          this.flags.jobid,
        ]);
      }

      this.ux.stopSpinner();
      return batches;
    } else {
      // view job status
      const jobStatus = await Batcher.fetchAndDisplayJobStatus(this.conn, this.flags.jobid, this.ux);
      this.ux.stopSpinner();
      return jobStatus;
    }
  }
}
