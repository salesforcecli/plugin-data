/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { platform } from 'node:os';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as fs from 'node:fs';
import { EOL } from 'node:os';
import { HttpApi } from '@jsforce/jsforce-node/lib/http-api.js';
import { HttpResponse } from '@jsforce/jsforce-node';
import {
  JobInfoV2,
  IngestJobV2Results,
  IngestJobV2SuccessfulResults,
  IngestJobV2FailedResults,
  IngestJobV2UnprocessedRecords,
  QueryJobV2,
  QueryJobInfoV2,
} from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Parser as csvParse } from 'csv-parse';
import type { Schema } from '@jsforce/jsforce-node';
import { Connection, Messages } from '@salesforce/core';
import { IngestJobV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { SfCommand, Spinner } from '@salesforce/sf-plugins-core';
import { Duration } from '@salesforce/kit';
import { capitalCase } from 'change-case';
import { getResultMessage } from './reporters/query/reporters.js';
import { BulkDataRequestCache } from './bulkDataRequestCache.js';
import type { BulkProcessedRecordV2, BulkRecordsV2 } from './types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export const setupLifecycleListeners = ({
  job,
  cache,
  username,
  apiVersion,
  cmd,
  isAsync,
  endWaitTime,
}: {
  job: IngestJobV2<Schema>;
  cache?: BulkDataRequestCache;
  username?: string;
  apiVersion?: string;
  cmd: SfCommand<unknown>;
  isAsync: boolean;
  endWaitTime: number;
}): void => {
  // the event emitted by jsforce's polling function
  job.on('inProgress', (jobInfo: JobInfoV2) => {
    cmd.spinner.status = formatSpinnerProgress(isAsync, endWaitTime, jobInfo);
  });
  // the event emitted other places in the plugin
  job.on('jobProgress', () => {
    const handler = async (): Promise<void> => {
      const jobInfo = await job.check();
      cmd.spinner.status = formatSpinnerProgress(isAsync, endWaitTime, jobInfo);
    };
    handler().catch((err) => eventListenerErrorHandler(err));
  });

  job.on('failed', throwAndStopSpinner(cmd.spinner));
  job.on('error', throwAndStopSpinner(cmd.spinner));

  job.once('jobTimeout', () => {
    const handler = async (): Promise<void> => {
      await cache?.createCacheEntryForRequest(job.id ?? '', username, apiVersion);
      displayBulkV2Result({ jobInfo: await job.check(), username, isAsync, cmd });
    };
    handler().catch((err) => eventListenerErrorHandler(err));
  });
};

export const displayBulkV2Result = ({
  jobInfo,
  isAsync,
  cmd,
  username = 'unspecified user',
}: {
  jobInfo: JobInfoV2;
  isAsync: boolean;
  cmd: SfCommand<unknown>;
  username?: string;
}): void => {
  // if we just read from jobInfo.operation it may suggest running the nonexistent `sf data hardDelete resume` command
  const operation = jobInfo.operation === 'hardDelete' || jobInfo.operation === 'delete' ? 'delete' : jobInfo.operation;
  if (isAsync && jobInfo.state !== 'JobComplete' && jobInfo.state !== 'Failed') {
    cmd.logSuccess(messages.getMessage('success', [operation, jobInfo.id]));
    cmd.info(messages.getMessage('checkStatus', [operation, jobInfo.id, username]));
  } else {
    cmd.log();
    cmd.info(getResultMessage(jobInfo));
    if ((jobInfo.numberRecordsFailed ?? 0) > 0 || jobInfo.state === 'Failed') {
      cmd.info(messages.getMessage('checkJobViaUi', [username, jobInfo.id]));
      process.exitCode = 1;
    }
    if (jobInfo.state === 'InProgress' || jobInfo.state === 'Open') {
      cmd.info(messages.getMessage('checkStatus', [operation, jobInfo.id, username]));
    }
    if (jobInfo.state === 'Failed') {
      throw messages.createError('bulkJobFailed', [jobInfo.id]).setData(jobInfo);
    }
  }
};

const eventListenerErrorHandler = (err: unknown): never => {
  throw err instanceof Error || typeof err === 'string' ? err : JSON.stringify(err);
};

const throwAndStopSpinner =
  (spinner: Spinner) =>
  (err: Error): void => {
    try {
      throw err;
    } finally {
      spinner.stop();
    }
  };

export const getRemainingTimeStatus = ({ isAsync, endWaitTime }: { isAsync: boolean; endWaitTime: number }): string =>
  isAsync ? '' : messages.getMessage('remainingTimeStatus', [Duration.milliseconds(endWaitTime - Date.now()).minutes]);

const formatSpinnerProgress = (isAsync: boolean, endWaitTime: number, jobInfo: JobInfoV2): string =>
  `${getRemainingTimeStatus({
    isAsync,
    endWaitTime,
  })} | ${getStage(jobInfo.state)} | ${getRemainingRecordsStatus(jobInfo)}`;

const getStage = (state: JobInfoV2['state']): string => ` Stage: ${capitalCase(state)}`;

const getRemainingRecordsStatus = (jobInfo: JobInfoV2): string => {
  const numberRecordsProcessed = jobInfo.numberRecordsProcessed ?? 0;
  const numberRecordsFailed = jobInfo.numberRecordsFailed ?? 0;
  const numberRecordSucceeded = numberRecordsProcessed - numberRecordsFailed;

  // the leading space is intentional
  return ` ${messages.getMessage('remainingRecordsStatus', [
    numberRecordsProcessed,
    numberRecordSucceeded,
    numberRecordsFailed,
  ])}`;
};
export const POLL_FREQUENCY_MS = 5000;

export const isBulkV2RequestDone = (jobInfo: JobInfoV2): boolean =>
  ['Aborted', 'Failed', 'JobComplete'].includes(jobInfo.state);

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

/** calculate ms between the "now" time and the endWaitTime */
export const remainingTime =
  (now: number) =>
  (endWaitTime?: number): number =>
    Math.max((endWaitTime ?? now) - now, 0);

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
        // Open file for reading and appending. The file is created if it does not exist but fails if the path exists.
        // https://nodejs.org/api/fs.html#file-system-flags
        flags: 'ax+',
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
              Readable.from(res.body.slice(res.body.indexOf(EOL) + 1)),
              fs.createWriteStream(outputInfo.filePath, {
                flags: 'a', // append mode
              }),
            ]
          : [Readable.from(res.body), fs.createWriteStream(outputInfo.filePath)]
      );
    }

    locator = res.headers['sforce-locator'];
  }

  return jobInfo;
}

/**
 * Create an ingest job, upload data and mark it as ready for processing
 *
 * */
export async function createIngestJob(
  conn: Connection,
  operation: JobInfoV2['operation'],
  object: string,
  csvFile: string,
  lineEnding: JobInfoV2['lineEnding'] | undefined
): Promise<IngestJobV2<Schema>> {
  const job = conn.bulk2.createJob({
    operation,
    object,
    lineEnding: lineEnding ?? platform() === 'win32' ? 'CRLF' : 'LF',
  });

  // create the job in the org
  await job.open();

  // upload data
  await job.uploadData(fs.createReadStream(csvFile));

  // mark the job to be ready to be processed
  await job.close();

  return job;
}
