/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { Transform, Readable } from 'stream';
import { pipeline } from 'node:stream/promises';
import { json2csv } from 'json-2-csv';

import { IngestJobV2, IngestJobV2Results, IngestOperation, JobInfoV2 } from 'jsforce/lib/api/bulk';
import { Schema } from 'jsforce';
import { Connection, Messages } from '@salesforce/core';
import { BulkProcessedRecordV2, BulkRecordsV2 } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export const POLL_FREQUENCY_MS = 5000;

export const isBulkV2RequestDone = (jobInfo: JobInfoV2): boolean =>
  ['Aborted', 'Failed', 'JobComplete'].includes(jobInfo.state);

export const didBulkV2RequestJobFail = (jobInfo: JobInfoV2): boolean => ['Aborted', 'Failed'].includes(jobInfo.state);

export const transformResults = (results: IngestJobV2Results<Schema>): BulkRecordsV2 => ({
  successfulResults: results.successfulResults.map((record) => record as unknown as BulkProcessedRecordV2),
  failedResults: results.failedResults.map((record) => record as unknown as BulkProcessedRecordV2),
  unprocessedRecords: results.unprocessedRecords.map((record) => record as unknown as BulkProcessedRecordV2),
});

export const validateSobjectType = async (sobjectType: string, connection: Connection): Promise<void> => {
  try {
    await connection.sobject(sobjectType).describe();
  } catch (e) {
    throw new Error(messages.getMessage('invalidSobject', [sobjectType, (e as Error).message]));
  }
};

export const waitOrTimeout = async (job: IngestJobV2<Schema, IngestOperation>, wait: number): Promise<void> => {
  if (wait > 0) {
    let waitCountDown = wait;
    const progress = setInterval(() => {
      const remainingTime = (waitCountDown -= POLL_FREQUENCY_MS);
      job.emit('jobProgress', { remainingTime, stage: 'polling' });
    }, POLL_FREQUENCY_MS);
    const timeout = setTimeout(() => {
      clearInterval(progress);
      job.emit('jobTimeout');
    }, wait ?? 0);
    try {
      await job.poll(POLL_FREQUENCY_MS, wait);
    } finally {
      clearInterval(progress);
      clearTimeout(timeout);
    }
  }
};

async function createJsonFile(readStream: Readable, filePath: string): Promise<void> {
  // create an initialize array
  fs.writeFileSync(filePath, '[', { encoding: 'utf-8' });
  const writeStream = fs.createWriteStream(filePath, { flags: 'a' });

  // transform record objects into strings
  let batchCounter = 0;
  const jsonTransformer = new Transform({
    writableObjectMode: true,
    transform(records, encoding, callback): void {
      const jsonString = JSON.stringify(records)
        .replace('[', batchCounter ? ',' : '')
        .replace(']', '');
      this.push(jsonString);
      batchCounter++;
      callback();
    },
  });

  // add records to file
  await pipeline(readStream, jsonTransformer, writeStream);

  // close array
  fs.writeFileSync(filePath, ']', { encoding: 'utf-8', flag: 'a' });
}

async function createCsvFile(readStream: Readable, filePath: string): Promise<void> {
  // create csv file
  const writeStream = fs.createWriteStream(filePath);

  // transform records into csv lines
  let batchCounter = 0;
  const csvTransformer = new Transform({
    writableObjectMode: true,
    async transform(records: object[], encoding, callback): Promise<void> {
      const csvString = await json2csv(records, {
        prependHeader: !batchCounter,
      });
      this.push(csvString.concat('\n'));
      batchCounter++;
      callback();
    },
  });

  // add records to file
  await pipeline(readStream, csvTransformer, writeStream);
}

export async function createFile(readStream: Readable, filePath: string): Promise<void> {
  const fileExtension = path.extname(filePath);
  const fileCreator = fileExtension === '.json' ? createJsonFile : createCsvFile;
  await fileCreator(readStream, filePath);
}
