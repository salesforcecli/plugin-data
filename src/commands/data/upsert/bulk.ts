/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { baseUpsertDeleteFlags, bulkIngest, columnDelimiterFlag, lineEndingFlag } from '../../../bulkIngest.js';
import type { BulkResultV2 } from '../../../types.js';
import { BulkUpsertRequestCache } from '../../../bulkDataRequestCache.js';
import { transformResults } from '../../../bulkUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulkv2.upsert');

export default class Upsert extends SfCommand<BulkResultV2> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...baseUpsertDeleteFlags,
    'line-ending': lineEndingFlag,
    'column-delimiter': columnDelimiterFlag,
    'external-id': Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.external-id.summary'),
      required: true,
      aliases: ['externalid'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<BulkResultV2> {
    const { flags } = await this.parse(Upsert);

    const res = await bulkIngest({
      resumeCmdId: 'data upsert resume',
      stageTitle: 'Upserting data',
      object: flags.sobject,
      operation: 'upsert',
      lineEnding: flags['line-ending'],
      columnDelimiter: flags['column-delimiter'],
      externalId: flags['external-id'],
      conn: flags['target-org'].getConnection(flags['api-version']),
      cache: await BulkUpsertRequestCache.create(),
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

    return {
      jobInfo: await job.check(),
      records: transformResults(await job.getAllResults()),
    };
  }
}
