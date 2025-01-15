/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Transform, Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import * as fs from 'node:fs';
import { EOL, platform } from 'node:os';
import { HttpApi } from '@jsforce/jsforce-node/lib/http-api.js';
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

async function bulkRequest(conn: Connection, url: string): Promise<{ body: string; headers: HttpResponse['headers'] }> {
  const httpApi = new HttpApi(conn, {
    responseType: 'text/plain', // this ensures jsforce doesn't try parsing the body
  });

  let headers: HttpResponse['headers'] | undefined;

  httpApi.on('response', (response: HttpResponse) => {
    headers = response.headers;
  });

  const body = await httpApi.request<string>({
    url: conn.normalizeUrl(url),
    method: 'GET',
  });

  if (!headers) throw new Error('failed to get HTTP headers for bulk query');

  return {
    body,
    headers,
  };
}

export async function exportRecords(
  conn: Connection,
  queryJob: QueryJobV2<Schema>,
  outputInfo: {
    filePath: string;
    format: 'csv' | 'json';
    lineEnding: 'CRLF' | 'LF';
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

  const lineEndingsMap = {
    CRLF: '\r\n',
    LF: '\n',
  };

  let locator: string | undefined;

  let recordsWritten = 0;

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
        Readable.from(res.body),
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
              Readable.from(
                res.body.slice(
                  res.body.indexOf(EOL) + 1,
                  platform() === 'win32' ? res.body.lastIndexOf(lineEndingsMap['LF']) : undefined
                )
              ),
              fs.createWriteStream(outputInfo.filePath, {
                // Open file for appending. The file is created if it does not exist.
                // https://nodejs.org/api/fs.html#file-system-flags
                flags: 'a', // append mode
              }),
            ]
          : [
              Readable.from(
                res.body.slice(0, platform() === 'win32' ? res.body.lastIndexOf(lineEndingsMap['LF']) : undefined)
              ),
              fs.createWriteStream(outputInfo.filePath),
            ]
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
