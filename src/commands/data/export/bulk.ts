/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { EOL } from 'node:os';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { QueryJobV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Record as SfRecord } from '@jsforce/jsforce-node';
import { Duration } from '@salesforce/kit';
import { BulkExportRequestCache } from '../../../bulkDataRequestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.export.bulk');

export type DataExportBulkResult = {
  path: string;
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
      // TODO: this shouldn't be required after adding `query-file`
      required: true,
    }),
    'all-rows': Flags.boolean({
      summary: messages.getMessage('flags.all-rows.summary'),
    }),
    'output-file': Flags.file({
      summary: messages.getMessage('flags.output-file.summary'),
      required: true,
    }),
    'result-format': Flags.custom({
      required: true,
      options: ['csv', 'json'],
      default: 'csv',
      summary: messages.getMessage('flags.result-format.summary'),
      char: 'r',
    })(),
  };

  public async run(): Promise<DataExportBulkResult> {
    const { flags } = await this.parse(DataExportBulk);

    const conn = flags['target-org'].getConnection();

    const timeout = flags.async ? Duration.minutes(0) : flags.wait ?? Duration.minutes(0);

    if (timeout.milliseconds === 0) {
      const job = new QueryJobV2(conn, {
        bodyParams: {
          query: flags.query,
          operation: flags['all-rows'] ? 'queryAll' : 'query',
        },
        pollingOptions: {
          pollTimeout: timeout.milliseconds,
          pollInterval: 5000,
        },
      });

      const jobInfo = await job.open();

      const cache = await BulkExportRequestCache.create();
      await cache.createCacheEntryForRequest(jobInfo.id, conn.getUsername(), conn.getApiVersion());
      this.log(messages.getMessage('export.timeout', [jobInfo.id, jobInfo.id, conn.getUsername()]));
      return {
        path: '',
      };
    }

    const recordStream = await conn.bulk2.query(flags.query, {
      pollTimeout: timeout.milliseconds,
      pollInterval: 5000,
    });

    const fileStream = fs.createWriteStream(flags['output-file']);

    fileStream.on('error', (error) => {
      throw SfError.wrap(error);
    });
    recordStream.on('error', (error) => {
      throw SfError.wrap(error);
    });

    if (flags['result-format'] === 'json') {
      fileStream.write(`[${EOL}`);
      recordStream.on('record', (data: SfRecord) => {
        fileStream.write(`  ${JSON.stringify(data)},${EOL}`);
      });
      recordStream.on('end', () => {
        fileStream.end();
      });

      fileStream.on('close', () => {
        fs.open(flags['output-file'], 'r+', (err, fd) => {
          if (err) throw err;

          fs.fstat(fd, (fstatError, stats) => {
            if (fstatError) throw fstatError;

            // start reading at the last 2 bytes to overwrite the trailing comma from the last record with the closing square-bracket.
            const writable = fs.createWriteStream(flags['output-file'], {
              fd,
              start: stats.size - 2,
            });

            writable.on('finish', () => {
              // TODO: this msg should include records qty
              // eslint-disable-next-line no-console
              console.log(`Records saved to ${flags['output-file']}`);
            });
            writable.write(`${EOL}]`);
            writable.end();
          });
        });
      });
    } else {
      recordStream.pipe(fileStream);
    }

    return {
      path: flags['output-file'],
    };
  }
}
