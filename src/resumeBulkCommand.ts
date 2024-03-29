/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags, SfCommand, loglevel, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { BulkV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { BulkResultV2, ResumeOptions } from './types.js';
import { POLL_FREQUENCY_MS, isBulkV2RequestDone, remainingTime, transformResults } from './bulkUtils.js';
import { displayBulkV2Result, getRemainingTimeStatus, setupLifecycleListeners } from './BulkBaseCommand.js';
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.resume.command');

export abstract class ResumeBulkCommand extends SfCommand<BulkResultV2> {
  public static readonly flags = {
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
      // don't use `exactlyOne` because this defaults to true
      default: true,
      exclusive: ['job-id'],
    }),
    wait: Flags.duration({
      summary: messages.getMessage('flags.wait.summary'),
      unit: 'minutes',
      min: 0,
      defaultValue: 0,
    }),
    'api-version': Flags.orgApiVersion(),
    loglevel,
  };

  protected async resume(resumeOptions: ResumeOptions, wait: Duration): Promise<BulkResultV2> {
    const endWaitTime = Date.now() + wait.milliseconds;
    this.spinner.start('Getting status');
    const conn = resumeOptions.options.connection;
    const isAsync = wait.milliseconds === 0;
    // @ts-expect-error jsforce 2 vs 3 differences.
    const bulk2 = new BulkV2(conn);
    const job = bulk2.job('ingest', { id: resumeOptions.jobInfo.id });
    this.spinner.status = getRemainingTimeStatus({ isAsync, endWaitTime });
    setupLifecycleListeners({
      job,
      cmd: this,
      isAsync,
      apiVersion: conn.getApiVersion(),
      username: conn.getUsername(),
      endWaitTime,
    });
    if (Date.now() < endWaitTime) {
      await job.poll(POLL_FREQUENCY_MS, remainingTime(Date.now())(endWaitTime));
    }
    const jobInfo = await job.check();
    this.spinner.stop();
    displayBulkV2Result({ jobInfo, username: conn.getUsername(), isAsync, cmd: this });
    const result = { jobInfo } as BulkResultV2;
    if (!isBulkV2RequestDone(jobInfo) || !this.jsonEnabled()) {
      return result;
    }
    result.records = transformResults(await job.getAllResults());
    return result;
  }
}
