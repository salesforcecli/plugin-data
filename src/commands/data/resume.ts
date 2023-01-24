/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BatchInfo, JobInfo } from 'jsforce/api/bulk';
import { Messages, SfError } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { orgFlags } from '../../flags';
import { Batcher } from '../../batcher';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.status');

export type StatusResult = BatchInfo[] | JobInfo;
export default class Status extends SfCommand<StatusResult> {
  public static readonly state = 'deprecated';
  public static readonly deprecationOptions = {to: 'force:data:bulk:status', message: 'Use force:data:bulk:status instead'}
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:bulk:status'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    'batch-id': Flags.salesforceId({
      length: 18,
      char: 'b',
      startsWith: '751',
      summary: messages.getMessage('flags.batchid'),
      aliases: ['batchid'],
      deprecateAliases: true,
    }),
    'job-id': Flags.salesforceId({
      length: 18,
      char: 'i',
      startsWith: '750',
      summary: messages.getMessage('flags.jobid'),
      aliases: ['jobid'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<StatusResult> {
    const { flags } = await this.parse(Status);
    this.spinner.start('Getting Status');
    const conn = flags['target-org'].getConnection(flags['api-version']);
    const batcher = new Batcher(conn);
    if (flags['job-id'] && flags['batch-id']) {
      // view batch status
      const job = conn.bulk.job(flags['job-id']);

      const batches: BatchInfo[] = await job.list();
      const batch = batches.find((b: BatchInfo) => b.id === flags['batch-id']);
      if (batch) {
        this.displayBatch(batch);
      } else {
        throw new SfError(messages.getMessage('NoBatchFound', [flags['batch-id'], flags['job-id']]), 'NoBatchFound');
      }

      this.spinner.stop();
      return batches;
    } else {
      // view job status
      const jobStatus = await batcher.fetchJobStatus(flags['job-id'] ?? '');
      this.info(`Job Status: ${jobStatus.state} operation: ${jobStatus.operation}`);
      this.spinner.stop();
      return jobStatus;
    }
  }

  private displayBatch(batch: BatchInfo): void {
    const tableData = Object.entries(batch).map(([key, value]) => ({ key, value }));
    const columns = {
        key: { header: 'Key' },
        value: { header: 'Key' },
      };
    this.table(tableData, columns);
  }
}
