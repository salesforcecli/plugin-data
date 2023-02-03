/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Flags, loglevel, optionalOrgFlagWithDeprecations, SfCommand } from '@salesforce/sf-plugins-core';
import { IngestJobV2, IngestOperation } from 'jsforce/lib/api/bulk';
import { Messages } from '@salesforce/core';
import { JobInfoV2 } from 'jsforce/api/bulk';
import { Schema } from 'jsforce';
import { BulkResultV2, ResumeOptions } from './types';
import { didBulkV2RequestJobFail, isBulkV2RequestDone, transformResults } from './bulkUtils';
import { getResultMessage } from './reporters';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.resume.command');

export abstract class ResumeBulkCommand extends SfCommand<BulkResultV2> {
  public static readonly baseFlags = {
    'target-org': { ...optionalOrgFlagWithDeprecations, summary: messages.getMessage('flags.targetOrg.summary') },
    'job-id': Flags.salesforceId({
      length: 18,
      char: 'i',
      startsWith: '750',
      summary: messages.getMessage('flags.jobid'),
      aliases: ['jobid'],
      deprecateAliases: true,
    }),
    'use-most-recent': Flags.boolean({
      summary: messages.getMessage('flags.useMostRecent.summary'),
      default: true,
      exclusive: ['job-id'],
    }),
    'api-version': Flags.orgApiVersion(),
    loglevel,
  };

  protected job!: IngestJobV2<Schema, IngestOperation>;
  private username: string | undefined;

  protected async resume(resumeOptions: ResumeOptions): Promise<BulkResultV2> {
    this.spinner.start('Getting status');
    const conn = resumeOptions.options.connection;
    this.username = resumeOptions.options.connection.getUsername();

    const job = conn.bulk2.job({ id: resumeOptions.jobInfo.id });

    // view job status
    const jobInfo = await job.check();
    this.spinner.stop();
    this.displayResult(jobInfo);
    const result = { jobInfo } as BulkResultV2;
    if (!isBulkV2RequestDone(jobInfo) || !this.jsonEnabled()) {
      return result;
    }
    result.records = transformResults(await job.getAllResults());
    return result;
  }

  private displayResult(jobInfo: JobInfoV2): void {
    this.log();
    this.info(getResultMessage(jobInfo));

    if (!isBulkV2RequestDone(jobInfo)) {
      this.info(messages.getMessage('checkStatus', [this.config.bin, jobInfo.operation, jobInfo.id, this.username]));
    }
    if ((jobInfo.numberRecordsFailed ?? 0) > 0 || didBulkV2RequestJobFail(jobInfo)) {
      this.info(messages.getMessage('checkJobViaUi', [this.config.bin, this.username, jobInfo.id]));
    }
  }
}
