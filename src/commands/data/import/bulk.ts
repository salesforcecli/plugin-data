/*
 * Copyright 2025, Salesforce, Inc.
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
import { bulkIngest, columnDelimiterFlag } from '../../../bulkIngest.js';
import { BulkImportRequestCache } from '../../../bulkDataRequestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.import.bulk');

export type DataImportBulkResult = {
  jobId: string;
  processedRecords?: number;
  successfulRecords?: number;
  failedRecords?: number;
};

export default class DataImportBulk extends SfCommand<DataImportBulkResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
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
    wait: Flags.duration({
      summary: messages.getMessage('flags.wait.summary'),
      char: 'w',
      unit: 'minutes',
    }),
    'target-org': Flags.requiredOrg(),
    'line-ending': Flags.option({
      summary: messages.getMessage('flags.line-ending.summary'),
      dependsOn: ['file'],
      options: ['CRLF', 'LF'] as const,
    })(),
    'column-delimiter': columnDelimiterFlag,
  };

  public async run(): Promise<DataImportBulkResult> {
    const { flags } = await this.parse(DataImportBulk);

    return bulkIngest({
      resumeCmdId: 'data import resume',
      stageTitle: 'Importing data',
      object: flags.sobject,
      operation: 'insert',
      lineEnding: flags['line-ending'],
      columnDelimiter: flags['column-delimiter'],
      conn: flags['target-org'].getConnection(flags['api-version']),
      cache: await BulkImportRequestCache.create(),
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
