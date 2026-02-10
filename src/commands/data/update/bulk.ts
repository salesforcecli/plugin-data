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
import { bulkIngest, columnDelimiterFlag, lineEndingFlag } from '../../../bulkIngest.js';
import { BulkUpdateRequestCache } from '../../../bulkDataRequestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.update.bulk');

export type DataUpdateBulkResult = {
  jobId: string;
  processedRecords?: number;
  successfulRecords?: number;
  failedRecords?: number;
};

export default class DataUpdateBulk extends SfCommand<DataUpdateBulkResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    wait: Flags.duration({
      summary: messages.getMessage('flags.wait.summary'),
      char: 'w',
      unit: 'minutes',
    }),
    file: Flags.file({
      summary: messages.getMessage('flags.file.summary'),
      char: 'f',
      required: true,
      exists: true,
    }),
    sobject: Flags.string({
      summary: messages.getMessage('flags.sobject.summary'),
      char: 's',
      required: true,
    }),
    'api-version': Flags.orgApiVersion(),
    'target-org': Flags.requiredOrg(),
    'line-ending': lineEndingFlag,
    'column-delimiter': columnDelimiterFlag,
  };

  public async run(): Promise<DataUpdateBulkResult> {
    const { flags } = await this.parse(DataUpdateBulk);

    return bulkIngest({
      resumeCmdId: 'data update resume',
      stageTitle: 'Updating data',
      object: flags.sobject,
      operation: 'update',
      lineEnding: flags['line-ending'],
      columnDelimiter: flags['column-delimiter'],
      conn: flags['target-org'].getConnection(flags['api-version']),
      cache: await BulkUpdateRequestCache.create(),
      wait: flags.wait,
      file: flags.file,
      jsonEnabled: this.jsonEnabled(),
      logFn: (arg: string) => {
        this.log(arg);
      },
      warnFn: (arg: SfCommand.Warning) => {
        this.warn(arg);
      },
    });
  }
}
