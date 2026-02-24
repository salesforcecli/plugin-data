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

import { Transform, Readable, TransformCallback } from 'node:stream';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import * as fs from 'node:fs';
import { EOL } from 'node:os';
import { fetch } from 'undici';
import { HttpResponse } from '@jsforce/jsforce-node';
import {
  IngestJobV2Results,
  IngestJobV2SuccessfulResults,
  IngestJobV2FailedResults,
  IngestJobV2UnprocessedRecords,
  QueryJobV2,
  QueryJobInfoV2,
} from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Parser as csvParse } from 'csv-parse';
import type { Schema } from '@jsforce/jsforce-node';
import { Connection, Messages, SfError } from '@salesforce/core';
import type { BulkProcessedRecordV2, BulkRecordsV2 } from './types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export const transformResults = (results: IngestJobV2Results<Schema>): BulkRecordsV2 => ({
  // ensureArray is used to handle the undefined or non-array case
  successfulResults: results.successfulResults.map(anyRecordToBulkProcessedRecordV2),
  failedResults: results.failedResults.map(anyRecordToBulkProcessedRecordV2),
  // if the csv can't be read, it returns a string that is the csv body
  ...(typeof results.unprocessedRecords === 'string'
    ? { unprocessedRecords: [], unparsed: results.unprocessedRecords }
    : { unprocessedRecords: results.unprocessedRecords.map(anyRecordToBulkProcessedRecordV2) }),
});

const anyRecordToBulkProcessedRecordV2 = (
  record:
    | IngestJobV2SuccessfulResults<Schema>[number]
    | IngestJobV2UnprocessedRecords<Schema>[number]
    | IngestJobV2FailedResults<Schema>[number]
): BulkProcessedRecordV2 => record as unknown as BulkProcessedRecordV2;

/** call the describe to verify the object exists in the org  */
export const validateSobjectType = async (sobjectType: string, connection: Connection): Promise<string> => {
  try {
    await connection.sobject(sobjectType).describe();
    return sobjectType;
  } catch (e) {
    throw new Error(messages.getMessage('invalidSobject', [sobjectType, (e as Error).message]));
  }
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

/**
 * Transform stream that skips the first line of CSV data (the header row).
 * Used when processing subsequent bulk result pages to avoid duplicate headers.
 */
export class SkipFirstLineTransform extends Transform {
  private firstLineSkipped = false;
  private buffer = '';

  public constructor() {
    super();
  }

  public _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.firstLineSkipped) {
      // After first line is skipped, pass through all subsequent data
      callback(null, chunk);
      return;
    }

    // Buffer incoming data until we find the first newline
    this.buffer += chunk.toString('utf8');

    const newlineIndex = this.buffer.indexOf('\n');

    if (newlineIndex === -1) {
      // No newline yet, keep buffering
      callback();
      return;
    }

    // Found the newline, skip everything up to and including it
    const remainingData = this.buffer.slice(newlineIndex + 1);
    this.firstLineSkipped = true;
    this.buffer = ''; // Clear buffer to free memory

    callback(null, Buffer.from(remainingData, 'utf8'));
  }

  public _flush(callback: TransformCallback): void {
    // If we reach the end without finding a newline, clear buffer and finish
    this.buffer = '';
    callback();
  }
}

async function bulkRequest(
  conn: Connection,
  url: string
): Promise<{ stream: Readable; headers: HttpResponse['headers'] }> {
  // Bypass jsforce entirely and use undici fetch to avoid any buffering.
  // jsforce's Transport.httpRequest() adds a 'complete' listener which triggers readAll() buffering.
  // Using undici fetch directly gives us the raw response stream without any intermediate buffering.

  const normalizedUrl = conn.normalizeUrl(url);

  // Prepare request headers with authorization
  const headers: { [name: string]: string } = {
    'content-Type': 'text/csv',
  };

  if (conn.accessToken) {
    headers.Authorization = `Bearer ${conn.accessToken}`;
  }

  const response = await fetch(normalizedUrl, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No body was returned');
  }
  const stream = Readable.fromWeb(response.body);

  // Extract headers in the format jsforce expects
  const responseHeaders: HttpResponse['headers'] = {};
  response.headers.forEach((value: string, key: string) => {
    responseHeaders[key] = value;
  });

  return { stream, headers: responseHeaders };
}

export async function exportRecords(
  conn: Connection,
  queryJob: QueryJobV2<Schema>,
  outputInfo: {
    filePath: string;
    format: 'csv' | 'json';
    columnDelimiter: ColumnDelimiterKeys;
  }
): Promise<QueryJobInfoV2> {
  let jobInfo: QueryJobInfoV2 | undefined;

  queryJob.on('jobComplete', (completedJob: QueryJobInfoV2) => {
    jobInfo = completedJob;
  });

  await queryJob.poll();

  if (jobInfo === undefined) {
    throw new Error('could not get job info after polling');
  }

  let locator: string | undefined;

  let recordsWritten = 0;

  // refresh here because `bulkRequest` uses undici for fetching results.
  await conn.refreshAuth();

  while (locator !== 'null') {
    // we can't parallelize this because we:
    // 1. need to get 1 batch to know the locator for the next one
    // 2. merge all batches into one csv or json file
    //
    // eslint-disable-next-line no-await-in-loop
    const res = await bulkRequest(
      conn,
      locator ? `/jobs/query/${jobInfo.id}/results?locator=${locator}` : `/jobs/query/${jobInfo.id}/results`
    );

    if (outputInfo.format === 'json') {
      const jsonWritable = fs.createWriteStream(outputInfo.filePath, {
        // Open file for appending. The file is created if it does not exist.
        // https://nodejs.org/api/fs.html#file-system-flags
        flags: 'a', // append mode
      });

      const totalRecords = jobInfo.numberRecordsProcessed;

      if (!locator) {
        // first write, start JSON array
        jsonWritable.write(`[${EOL}`);
      }

      // eslint-disable-next-line no-await-in-loop
      await pipeline(
        res.stream,
        new csvParse({ columns: true, delimiter: ColumnDelimiter[outputInfo.columnDelimiter] }),
        new Transform({
          objectMode: true,
          // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
          transform(chunk, _encoding, callback) {
            if (recordsWritten === totalRecords - 1) {
              callback(null, `  ${JSON.stringify(chunk)}${EOL}]`);
            } else {
              recordsWritten++;
              callback(null, `  ${JSON.stringify(chunk)},${EOL}`);
            }
          },
        }),
        jsonWritable
      );
    } else {
      // csv
      // eslint-disable-next-line no-await-in-loop
      await pipeline(
        locator
          ? [
              res.stream,
              new SkipFirstLineTransform(),
              fs.createWriteStream(outputInfo.filePath, {
                // Open file for appending. The file is created if it does not exist.
                // https://nodejs.org/api/fs.html#file-system-flags
                flags: 'a', // append mode
              }),
            ]
          : [res.stream, fs.createWriteStream(outputInfo.filePath)]
      );
    }

    locator = res.headers['sforce-locator'];
  }

  return jobInfo;
}

async function readFirstFiveLines(filePath: string): Promise<string[]> {
  const fileStream = fs.createReadStream(filePath);

  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Recognizes both CRLF and LF line endings
  });

  const lines = [];

  for await (const line of rl) {
    lines.push(line);
    if (lines.length === 5) break;
  }

  return lines;
}

export async function detectDelimiter(filePath: string): Promise<ColumnDelimiterKeys> {
  const delimiterMap = new Map<string, ColumnDelimiterKeys>();
  delimiterMap.set('`', 'BACKQUOTE');
  delimiterMap.set('^', 'CARET');
  delimiterMap.set(',', 'COMMA');
  delimiterMap.set('|', 'PIPE');
  delimiterMap.set(';', 'SEMICOLON');
  delimiterMap.set('	', 'TAB');

  const delimiters = ['`', '^', ',', '|', ';', '	'];
  const delimiterCounts: { [key: string]: number } = {};

  // Initialize counts
  for (const delimiter of delimiters) {
    delimiterCounts[delimiter] = 0;
  }

  // Read the first few lines of the file
  const data = await readFirstFiveLines(filePath);

  data.forEach((line) => {
    // Ignore empty lines
    if (line.trim() === '') return;

    delimiters.forEach((delimiter) => {
      // Use regex to avoid counting delimiters inside quotes
      const regexDelimiter = delimiter === '^' || delimiter === '|' ? `\\${delimiter}` : delimiter;
      const regex = new RegExp(`(?<=^|[^"']|")${regexDelimiter}(?=(?:(?:[^"]*"[^"]*")*[^"]*$))`, 'g');
      const count = (line.match(regex) ?? []).length;
      delimiterCounts[delimiter] += count;
    });
  });

  // Find the delimiter with the highest count
  let detectedDelimiter: string | undefined;
  let maxCount = 0;

  for (const [delimiter, count] of Object.entries(delimiterCounts)) {
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  }

  // default to `COMMA` if no delimiter was found in the CSV file (1 column)
  const columDelimiter = delimiterMap.get(detectedDelimiter ?? ',');

  if (columDelimiter === undefined) {
    throw new SfError(`Failed to detect column delimiter used in ${filePath}.`);
  }

  return columDelimiter;
}
