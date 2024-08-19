/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { Writable } from 'node:stream';
import { EOL } from 'node:os';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Logger, Messages } from '@salesforce/core';
import { QueryJobInfoV2, QueryJobV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Duration } from '@salesforce/kit';
import { Parsable } from '@jsforce/jsforce-node/lib/record-stream.js';
import { Schema, Record as SfRecord } from '@jsforce/jsforce-node';
import ansis from 'ansis';
import { BulkExportRequestCache } from '../../../bulkDataRequestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.export.bulk');

export type DataExportBulkResult = {
  totalSize: number;
  filePath: string;
};

export enum ColumnDelimiter {
  BACKQUOTE = '`',
  CARET = '^',
  COMMA = ',',
  PIPE = '|',
  SEMICOLON = ';',
  TAB = '	',
}

export type ColumnDelimiterKeys = keyof typeof ColumnDelimiter;

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
  };

  private logger!: Logger;

  public async run(): Promise<DataExportBulkResult> {
    const { flags } = await this.parse(DataExportBulk);

    this.logger = await Logger.child('data:export:bulk');

    const conn = flags['target-org'].getConnection(flags['api-version']);

    const timeout = flags.async ? Duration.minutes(0) : flags.wait ?? Duration.minutes(0);

    // async: create query job in the org but don't poll for its status
    if (timeout.milliseconds === 0) {
      const job = new QueryJobV2(conn, {
        bodyParams: {
          query: flags.query,
          operation: flags['all-rows'] ? 'queryAll' : 'query',
          columnDelimiter: flags['column-delimiter'],
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
        query: flags.query,
        operation: flags['all-rows'] ? 'queryAll' : 'query',
        columnDelimiter: flags['column-delimiter'],
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

export async function getQueryStream(
  queryJob: QueryJobV2<Schema>,
  columnDelimiter: ColumnDelimiterKeys,
  logger: Logger
): Promise<[Parsable, QueryJobInfoV2]> {
  const recordStream = new Parsable();
  const dataStream = recordStream.stream('csv', {
    delimiter: ColumnDelimiter[columnDelimiter],
  });

  let jobInfo: QueryJobInfoV2 | undefined;

  try {
    queryJob.on('jobComplete', (completedJob: QueryJobInfoV2) => {
      jobInfo = completedJob;
    });
    await queryJob.poll();

    const queryRecordsStream = await queryJob.result().then((s) => s.stream());
    queryRecordsStream.pipe(dataStream);
  } catch (error) {
    const err = error as Error;
    // TODO: improve log messages
    logger.error(`bulk query failed due to: ${err.message}`);

    if (err.name !== 'JobPollingTimeoutError') {
      // fires off one last attempt to clean up and ignores the result | error
      queryJob.delete().catch((ignored: Error) => ignored);
    }

    throw err;
  }
  if (!jobInfo) {
    throw new Error('could not get jobinfo');
  }

  return [recordStream, jobInfo];
}
// eslint-disable-next-line sf-plugin/only-extend-SfCommand
export class JsonWritable extends Writable {
  private recordsQty: number;
  private recordsWritten = 0;
  private filePath: fs.PathLike;
  private fileStream!: fs.WriteStream;

  public constructor(filePath: fs.PathLike, recordsQty: number) {
    super({ objectMode: true });
    this.recordsQty = recordsQty;
    this.filePath = filePath;
  }

  public _construct(callback: () => void): void {
    this.fileStream = fs.createWriteStream(this.filePath);
    this.fileStream.write(`[${EOL}`);
    callback();
  }

  public _write(chunk: SfRecord, encoding: BufferEncoding, callback: () => void): void {
    if (this.recordsQty - 1 === this.recordsWritten) {
      // last record, close JSON array
      this.fileStream.write(`  ${JSON.stringify(chunk)}${EOL}]`, encoding, callback);
      this.fileStream.end();
    } else {
      this.fileStream.write(`  ${JSON.stringify(chunk)},${EOL}`, encoding, callback);
      this.recordsWritten++;
    }
  }
}
