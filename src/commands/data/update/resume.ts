/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { BulkUpdateRequestCache } from '../../../bulkDataRequestCache.js';
import { bulkIngestResume } from '../../../bulkIngest.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.update.resume');

export type DataUpdateResumeResult = {
  jobId: string;
  processedRecords?: number;
  successfulRecords?: number;
  failedRecords?: number;
};

export default class DataUpdateResume extends SfCommand<DataUpdateResumeResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'use-most-recent': Flags.boolean({
      summary: messages.getMessage('flags.use-most-recent.summary'),
      exactlyOne: ['job-id'],
    }),
    'job-id': Flags.salesforceId({
      summary: messages.getMessage('flags.job-id.summary'),
      char: 'i',
      length: 18,
      startsWith: '750',
      exactlyOne: ['use-most-recent'],
    }),
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      summary: messages.getMessage('flags.wait.summary'),
      defaultValue: 5,
    }),
  };

  public async run(): Promise<DataUpdateResumeResult> {
    const { flags } = await this.parse(DataUpdateResume);

    return bulkIngestResume({
      cmdId: 'data update resume',
      stageTitle: 'Updating data',
      cache: await BulkUpdateRequestCache.create(),
      jobIdOrMostRecent: flags['job-id'] ?? flags['use-most-recent'],
      jsonEnabled: this.jsonEnabled(),
      wait: flags.wait,
      warnFn: (arg: SfCommand.Warning) => {
        this.warn(arg);
      },
    });
  }
}
