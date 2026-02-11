/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { BulkImportRequestCache } from '../../../bulkDataRequestCache.js';
import { bulkIngestResume } from '../../../bulkIngest.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.import.resume');

export type DataImportResumeResult = {
  jobId: string;
  processedRecords?: number;
  successfulRecords?: number;
  failedRecords?: number;
};

export default class DataImportResume extends SfCommand<DataImportResumeResult> {
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

  public async run(): Promise<DataImportResumeResult> {
    const { flags } = await this.parse(DataImportResume);

    return bulkIngestResume({
      cmdId: 'data import resume',
      stageTitle: 'Updating data',
      cache: await BulkImportRequestCache.create(),
      jobIdOrMostRecent: flags['job-id'] ?? flags['use-most-recent'],
      jsonEnabled: this.jsonEnabled(),
      wait: flags.wait,
      warnFn: (arg: SfCommand.Warning) => {
        this.warn(arg);
      },
    });
  }
}
