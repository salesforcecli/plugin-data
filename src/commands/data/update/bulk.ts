/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
    async: Flags.boolean({
      summary: messages.getMessage('flags.async.summary'),
      char: 'a',
    }),
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
      async: flags.async,
      wait: flags.wait,
      file: flags.file,
      jsonEnabled: this.jsonEnabled(),
      verbose: false,
      logFn: (arg: string) => {
        this.log(arg);
      },
      warnFn: (arg: SfCommand.Warning) => {
        this.warn(arg);
      },
    });
  }
}
