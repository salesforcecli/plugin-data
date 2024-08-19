/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { platform } from 'node:os';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Logger, Messages } from '@salesforce/core';
import { QueryJobV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Duration } from '@salesforce/kit';
import ansis from 'ansis';
import { BulkExportRequestCache } from '../../../bulkDataRequestCache.js';
import { getQueryStream, JsonWritable } from '../../../bulkUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.export.bulk');

export type DataExportBulkResult = {
  totalSize: number;
  filePath: string;
};

export default class DataExportBulk extends SfCommand<DataExportBulkResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    wait: Flags.duration({
      summary: messages.getMessage('flags.wait.summary'),
      char: 'w',
      unit: 'minutes',
      exclusive: ['async'],
    }),
    async: Flags.boolean({
      summary: messages.getMessage('flags.async.summary'),
      exclusive: ['wait'],
    }),
    query: Flags.string({
      summary: messages.getMessage('flags.query.summary'),
      char: 'q',
      exclusive: ['query-file'],
    }),
    'query-file': Flags.file({
      summary: messages.getMessage('flags.query-file.summary'),
      exists: true,
      exclusive: ['query'],
    }),
    'all-rows': Flags.boolean({
      summary: messages.getMessage('flags.all-rows.summary'),
    }),
    'output-file': Flags.file({
      summary: messages.getMessage('flags.output-file.summary'),
      required: true,
    }),
    'result-format': Flags.option({
      required: true,
      options: ['csv', 'json'] as const,
      default: 'csv',
      summary: messages.getMessage('flags.result-format.summary'),
      char: 'r',
    })(),
    'column-delimiter': Flags.option({
      options: ['BACKQUOTE', 'CARET', 'COMMA', 'PIPE', 'SEMICOLON', 'TAB'] as const,
      default: 'COMMA',
      summary: messages.getMessage('flags.column-delimiter.summary'),
    })(),
    'line-ending': Flags.option({
      summary: messages.getMessage('flags.line-ending.summary'),
      options: ['LF', 'CRLF'] as const,
      relationships: [
        {
          type: 'some',
          flags: [
            {
              name: 'result-format',
              // eslint-disable-next-line @typescript-eslint/require-await
              when: async (flags): Promise<boolean> => flags['result-format'] === 'csv',
            },
          ],
        },
      ],
    })(),
  };

  private logger!: Logger;

  public async run(): Promise<DataExportBulkResult> {
    const { flags } = await this.parse(DataExportBulk);

    this.logger = await Logger.child('data:export:bulk');

    const conn = flags['target-org'].getConnection(flags['api-version']);

    const timeout = flags.async ? Duration.minutes(0) : flags.wait ?? Duration.minutes(0);

    // `flags['query-file']` will be present if `flags.query` isn't. oclif's `exclusive` isn't quite that clever
    const soqlQuery = flags.query ?? fs.readFileSync(flags['query-file'] as string, 'utf8');

    const lineEnding = flags['line-ending'] ?? platform() === 'win32' ? 'CRLF' : 'LF';

    // async: create query job in the org but don't poll for its status
    if (timeout.milliseconds === 0) {
      const job = new QueryJobV2(conn, {
        bodyParams: {
          query: soqlQuery,
          operation: flags['all-rows'] ? 'queryAll' : 'query',
          columnDelimiter: flags['column-delimiter'],
          lineEnding,
        },
        pollingOptions: {
          pollTimeout: timeout.milliseconds,
          pollInterval: 5000,
        },
      });

      const jobInfo = await job.open();

      const cache = await BulkExportRequestCache.create();
      await cache.createCacheEntryForRequest(
        jobInfo.id,
        {
          filePath: flags['output-file'],
          format: flags['result-format'],
          columnDelimiter: flags['column-delimiter'],
        },
        conn.getUsername(),
        conn.getApiVersion()
      );

      this.log(messages.getMessage('export.timeout', [jobInfo.id, jobInfo.id, conn.getUsername()]));

      return {
        totalSize: 0,
        filePath: '',
      };
    }

    const queryJob = new QueryJobV2(conn, {
      bodyParams: {
        query: soqlQuery,
        operation: flags['all-rows'] ? 'queryAll' : 'query',
        columnDelimiter: flags['column-delimiter'],
        lineEnding,
      },
      pollingOptions: {
        pollTimeout: timeout.milliseconds,
        pollInterval: 5000,
      },
    });

    await queryJob.open();

    const [recordStream, jobInfo] = await getQueryStream(queryJob, flags['column-delimiter'], this.logger);

    // switch stream into flowing mode
    recordStream.on('record', () => {});

    if (flags['result-format'] === 'json') {
      const fileStream = new JsonWritable(flags['output-file'], jobInfo.numberRecordsProcessed);
      recordStream.pipe(fileStream);
    } else {
      const fileStream = fs.createWriteStream(flags['output-file']);
      recordStream.stream().pipe(fileStream);
    }

    this.log(ansis.bold(`${jobInfo.numberRecordsProcessed} records written to ${flags['output-file']}`));

    return {
      totalSize: jobInfo.numberRecordsProcessed,
      filePath: flags['output-file'],
    };
  }
}
