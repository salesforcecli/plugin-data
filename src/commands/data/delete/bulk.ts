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

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { baseUpsertDeleteFlags, lineEndingFlag, bulkIngest } from '../../../bulkIngest.js';
import { BulkDeleteRequestCache } from '../../../bulkDataRequestCache.js';
import { BulkResultV2 } from '../../../types.js';
import { transformResults } from '../../../bulkUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulkv2.delete');

export default class Delete extends SfCommand<BulkResultV2> {
  public static readonly examples = messages.getMessages('examples');
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public static readonly flags = {
    ...baseUpsertDeleteFlags,
    'line-ending': lineEndingFlag,
    'hard-delete': Flags.boolean({
      summary: messages.getMessage('flags.hard-delete.summary'),
      description: messages.getMessage('flags.hard-delete.description'),
      default: false,
    }),
  };

  public async run(): Promise<BulkResultV2> {
    const { flags } = await this.parse(Delete);

    const res = await bulkIngest({
      resumeCmdId: 'data delete resume',
      stageTitle: 'Deleting data',
      object: flags.sobject,
      operation: flags['hard-delete'] ? 'hardDelete' : 'delete',
      lineEnding: flags['line-ending'],
      columnDelimiter: undefined,
      conn: flags['target-org'].getConnection(flags['api-version']),
      cache: await BulkDeleteRequestCache.create(),
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

    const job = flags['target-org'].getConnection(flags['api-version']).bulk2.job('ingest', {
      id: res.jobId,
    });

    if (res.failedRecords && res.failedRecords > 0) {
      process.exitCode = 1;
    }

    const jobInfo = await job.check();

    return {
      jobInfo,
      records:
        jobInfo.state === 'JobComplete'
          ? transformResults(await job.getAllResults())
          : {
              successfulResults: [],
              failedResults: [],
              unprocessedRecords: [],
            },
    };
  }
}
