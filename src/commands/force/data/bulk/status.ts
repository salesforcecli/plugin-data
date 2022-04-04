/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { BatchInfo } from 'jsforce/lib/api/bulk';
import { JobInfo } from 'jsforce/job';
import { flags, FlagsConfig } from '@salesforce/command';
import { Connection, Messages, SfError } from '@salesforce/core';
import { Batcher } from '../../../../batcher';
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

  public async run(): Promise<BatchInfo[] | JobInfo> {
    this.ux.startSpinner('Getting Status');
    const conn: Connection = this.ensureOrg().getConnection();
    const batcher = new Batcher(conn, this.ux);
    if (this.flags.jobid && this.flags.batchid) {
      // view batch status
      const job = conn.bulk.job(this.flags.jobid);
      let found = false;

      const batches: BatchInfo[] = await job.list();
      batches.forEach((batch: BatchInfo) => {
        if (batch.id === this.flags.batchid) {
          batcher.bulkStatus(batch);
          found = true;
        }
      });
      if (!found) {
        throw new SfError(messages.getMessage('NoBatchFound', [this.flags.batchid, this.flags.jobid]));
      }

      this.ux.stopSpinner();
      return batches;
    } else {
      // view job status
      const jobStatus = await batcher.fetchAndDisplayJobStatus(this.flags.jobid as string);
      this.ux.stopSpinner();
      return jobStatus;
    }
  }
}
