/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { BatchInfo, JobInfo } from 'jsforce/api/bulk';
import { Connection, Messages, SfError } from '@salesforce/core';
import { SfCommand, Flags, Ux } from '@salesforce/sf-plugins-core';
import { Batcher } from '../../../../batcher';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.status');

type StatusResult = BatchInfo[] | JobInfo;
export default class Status extends SfCommand<StatusResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static flags = {
    targetusername: Flags.requiredOrg({
      required: true,
      char: 'u',
      summary: messages.getMessage('flags.targetusername'),
    }),
    batchid: Flags.string({
      char: 'b',
      summary: messages.getMessage('flags.batchid'),
    }),
    jobid: Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.jobid'),
      required: true,
    }),
  };

  public async run(): Promise<StatusResult> {
    const { flags } = await this.parse(Status);
    this.spinner.start('Getting Status');
    const conn: Connection = flags.targetusername.getConnection();
    const batcher = new Batcher(conn, new Ux(!this.jsonEnabled()));
    if (flags.jobid && flags.batchid) {
      // view batch status
      const job = conn.bulk.job(flags.jobid);
      let found = false;

      const batches: BatchInfo[] = await job.list();
      batches.forEach((batch: BatchInfo) => {
        if (batch.id === flags.batchid) {
          batcher.bulkStatus(batch);
          found = true;
        }
      });
      if (!found) {
        throw new SfError(messages.getMessage('NoBatchFound', [flags.batchid, flags.jobid]), 'NoBatchFound');
      }

      this.spinner.stop();
      return batches;
    } else {
      // view job status
      const jobStatus = await batcher.fetchAndDisplayJobStatus(flags.jobid);
      this.spinner.stop();
      return jobStatus;
    }
  }
}
