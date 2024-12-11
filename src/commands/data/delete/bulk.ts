/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
      async: flags.async,
      wait: flags.wait,
      file: flags.file,
      jsonEnabled: this.jsonEnabled(),
      verbose: flags.verbose,
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
