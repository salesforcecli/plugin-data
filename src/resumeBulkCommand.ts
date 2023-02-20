/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Flags, loglevel, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import { IngestJobV2, IngestOperation } from 'jsforce/lib/api/bulk';
import { Messages } from '@salesforce/core';
import { Schema } from 'jsforce';
import { Duration } from '@salesforce/kit';
import { BulkResultV2, ResumeOptions } from './types';
import { isBulkV2RequestDone, transformResults, waitOrTimeout } from './bulkUtils';
import { BulkBaseCommand } from './BulkBaseCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.resume.command');

export abstract class ResumeBulkCommand extends BulkBaseCommand {
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
    wait: Flags.duration({
      summary: messages.getMessage('flags.wait.summary'),
      unit: 'minutes',
      min: 0,
      default: Duration.minutes(0),
    }),
    'api-version': Flags.orgApiVersion(),
    loglevel,
  };

  protected job!: IngestJobV2<Schema, IngestOperation>;

  protected async resume(resumeOptions: ResumeOptions, wait: Duration): Promise<BulkResultV2> {
    this.spinner.start('Getting status');
    const conn = resumeOptions.options.connection;

    this.job = conn.bulk2.job({ id: resumeOptions.jobInfo.id });
    this.wait = wait.milliseconds;
    this.endWaitTime = Date.now() + wait.milliseconds;
    this.spinner.status = this.getRemainingTimeStatus();
    this.setupLifecycleListeners();
    await waitOrTimeout(this.job, wait.milliseconds);
    const jobInfo = await this.job.check();
    this.spinner.stop();
    this.displayBulkV2Result(jobInfo);
    const result = { jobInfo } as BulkResultV2;
    if (!isBulkV2RequestDone(jobInfo) || !this.jsonEnabled()) {
      return result;
    }
    result.records = transformResults(await this.job.getAllResults());
    return result;
  }
}
