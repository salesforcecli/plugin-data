/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Flags, loglevel, optionalOrgFlagWithDeprecations, SfCommand } from '@salesforce/sf-plugins-core';
import { BatchInfo } from 'jsforce/lib/api/bulk';
import { Messages } from '@salesforce/core';
import { BulkOperation, Job } from 'jsforce/api/bulk';
import { Schema } from 'jsforce';
import { ResumeOptions, StatusResult } from './types';
import { Batcher } from './batcher';
import { BatchInfoColumns, getBatchTotals, getFailedBatchesForDisplay } from './reporters';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.resume.command');

export abstract class ResumeBulkCommand extends SfCommand<StatusResult> {
  public static readonly globalFlags = {
    'target-org': optionalOrgFlagWithDeprecations,
    'batch-id': Flags.salesforceId({
      deprecated: true,
      length: 18,
      char: 'b',
      startsWith: '751',
      summary: messages.getMessage('flags.batchid'),
      aliases: ['batchid'],
      deprecateAliases: true
    }),
    'job-id': Flags.salesforceId({
      length: 18,
      char: 'i',
      startsWith: '750',
      summary: messages.getMessage('flags.jobid'),
      aliases: ['jobid'],
      deprecateAliases: true
    }),
    'use-most-recent': Flags.boolean({
      summary: messages.getMessage('flags.useMostRecent.summary'),
      default: false,
      exclusive: ['job-id']
    }),
    'api-version': Flags.orgApiVersion(),
    loglevel
  };

  private username: string | undefined;

  protected async resume(resumeOptions: ResumeOptions): Promise<StatusResult> {
    this.spinner.start('Getting status');
    const conn = resumeOptions.options.connection;
    this.username = resumeOptions.options.connection.getUsername();
    const batcher = new Batcher(conn);
    const job = conn.bulk.job(resumeOptions.jobInfo.id);

    // view job status
    const jobStatus = await batcher.fetchJobStatus(resumeOptions.jobInfo.id);
    this.spinner.stop();
    await this.displayResult(job);
    return jobStatus;
  }

  // eslint-disable-next-line class-methods-use-this
  protected isDone(resumeResults: StatusResult): boolean {
    if (Array.isArray(resumeResults)) {
      return resumeResults.every((batch) => !['InProgress', 'Queued'].includes(batch.state));
    } else {
      return resumeResults.state === 'Closed';
    }
  }

  private async displayResult(job: Job<Schema, BulkOperation>): Promise<void> {
    const jobInfo = await job.info();
    const batches: BatchInfo[] = await job.list();
    const ttls = getBatchTotals(batches);

    const failedBatches = getFailedBatchesForDisplay(batches);
    const resultMessage = `Job ${jobInfo.id} Status ${jobInfo.state} Total Records ${ttls.total} Success ${ttls.success} Failed ${ttls.failed}. Number of Batches ${batches.length}. Number of failed batches ${failedBatches.length}`;
    this.info(resultMessage);
    if (failedBatches.length > 0) {
      this.table(failedBatches, BatchInfoColumns);
    }
    if (failedBatches.length > 0 || jobInfo.state !== 'Closed') {
      this.info(`To review the details of this job, run:\n${this.config.bin} org open --target-org ${this.username} --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F${jobInfo.id}"`);
    }
  }
}
