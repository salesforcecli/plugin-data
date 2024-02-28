/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { ReadStream } from 'node:fs';
import os from 'node:os';

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Duration } from '@salesforce/kit';
import { Connection, Messages } from '@salesforce/core';
import { ux } from '@oclif/core';
import { Schema } from 'jsforce';
import { IngestJobV2, IngestJobV2FailedResults, IngestOperation, JobInfoV2 } from 'jsforce/lib/api/bulk2.js';
import { orgFlags } from './flags.js';
import { BulkDataRequestCache, BulkDeleteRequestCache, BulkUpsertRequestCache } from './bulkDataRequestCache.js';
import { BulkResultV2 } from './types.js';
import {
  POLL_FREQUENCY_MS,
  isBulkV2RequestDone,
  transformResults,
  validateSobjectType,
  remainingTime,
} from './bulkUtils.js';
import { displayBulkV2Result, getRemainingTimeStatus, setupLifecycleListeners } from './BulkBaseCommand.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.operation.command');

type CreateJobOptions = {
  object: string;
  operation: IngestOperation;
  externalIdFieldName?: string;
  lineEnding?: 'CRLF';
};

export const baseFlags = {
  ...orgFlags,
  file: Flags.file({
    char: 'f',
    summary: messages.getMessage('flags.csvfile.summary'),
    required: true,
    exists: true,
    aliases: ['csvfile'],
    deprecateAliases: true,
  }),
  sobject: Flags.string({
    char: 's',
    summary: messages.getMessage('flags.sobject.summary'),
    required: true,
    aliases: ['sobjecttype'],
    deprecateAliases: true,
  }),
  wait: Flags.duration({
    char: 'w',
    unit: 'minutes',
    summary: messages.getMessage('flags.wait.summary'),
    min: 0,
    defaultValue: 0,
    exclusive: ['async'],
  }),
  async: Flags.boolean({
    char: 'a',
    summary: messages.getMessage('flags.async.summary'),
    exclusive: ['wait'],
  }),
  verbose: Flags.boolean({
    summary: messages.getMessage('flags.verbose.summary'),
  }),
};

type SupportedOperations = Extract<IngestOperation, 'delete' | 'upsert'>;

export const runBulkOperation = async ({
  sobject,
  csvFileName,
  connection,
  wait,
  verbose,
  operation,
  options,
  cmd,
}: {
  sobject: string;
  csvFileName: string;
  connection: Connection;
  wait: Duration;
  verbose: boolean;
  operation: SupportedOperations;
  options?: { extIdField: string };
  cmd: SfCommand<unknown>;
}): Promise<BulkResultV2> => {
  const isAsync = !wait;
  try {
    const [cache] = await Promise.all([getCache(operation), validateSobjectType(sobject, connection)]);
    const csvRecords: ReadStream = fs.createReadStream(csvFileName, { encoding: 'utf-8' });
    cmd.spinner.start(`Running ${isAsync ? 'async ' : ''}bulk ${operation} request`);
    const endWaitTime = Date.now() + wait.milliseconds;
    cmd.spinner.status = getRemainingTimeStatus({ isAsync, endWaitTime });
    const createJobOptions: CreateJobOptions = {
      object: sobject,
      operation,
      externalIdFieldName: options?.extIdField,
    };
    if (os.platform() === 'win32') {
      createJobOptions.lineEnding = 'CRLF';
    }
    const job = connection.bulk2.createJob(createJobOptions);

    setupLifecycleListeners({
      job,
      cache,
      username: connection.getUsername(),
      apiVersion: connection.getApiVersion(),
      isAsync,
      cmd,
      endWaitTime,
    });
    try {
      const jobInfo = await executeBulkV2DataRequest(job, csvRecords, endWaitTime);
      if (isAsync) {
        await cache?.createCacheEntryForRequest(job.id ?? '', connection?.getUsername(), connection?.getApiVersion());
      }
      displayBulkV2Result({ jobInfo, isAsync, cmd, username: connection.getUsername() });
      const result = { jobInfo } as BulkResultV2;
      if (!isBulkV2RequestDone(jobInfo)) {
        return result;
      }
      if (cmd.jsonEnabled()) {
        result.records = transformResults(await job.getAllResults());
      }
      // We only print human readable error outputs if --json is not specified.
      // The JSON result itself will already contain the error information (see above).
      else if (verbose) {
        const records = await job.getAllResults();
        if (records?.failedResults?.length > 0) {
          printBulkErrors(records.failedResults);
        }
      }
      return result;
    } catch (err) {
      cmd.spinner.stop();
      throw err;
    }
  } finally {
    cmd.spinner.stop();
  }
};
const getCache = async (operation: SupportedOperations): Promise<BulkDataRequestCache> => {
  switch (operation) {
    case 'delete':
      return BulkDeleteRequestCache.create();
    case 'upsert':
      return BulkUpsertRequestCache.create();
  }
};
/**
 * create and execute batches based on the record arrays; wait for completion response if -w flag is set with > 0 minutes
 * to get proper logging/printing to console pass the instance of UX that called this method
 *
 * @param job {IngestJobV2}
 * @param input
 * @param sobjectType {string}
 * @param wait {number}
 */
const executeBulkV2DataRequest = async <J extends Schema>(
  job: IngestJobV2<J>,
  input: ReadStream,
  endWaitTime?: number
): Promise<JobInfoV2> => {
  await job.open();
  job.emit('jobProgress', { remainingTime: remainingTime(Date.now())(endWaitTime), stage: 'uploading' });
  await job.uploadData(input);
  job.emit('jobProgress', { remainingTime: remainingTime(Date.now())(endWaitTime), stage: 'uploadComplete' });
  await job.close();
  if (endWaitTime && Date.now() < endWaitTime) {
    await job.poll(POLL_FREQUENCY_MS, remainingTime(Date.now())(endWaitTime));
  }
  return job.check();
};

const printBulkErrors = (failedResults: IngestJobV2FailedResults<Schema>): void => {
  const columns = {
    id: { header: 'Id' },
    sfId: { header: 'Sf_Id' },
    error: { header: 'Error' },
  };
  const options = { title: `Bulk Failures [${failedResults.length}]` };
  ux.log();
  ux.table(
    failedResults.map((f) => ({ id: 'Id' in f ? f.Id : '', sfId: f.sf__Id, error: f.sf__Error })),
    columns,
    options
  );
};
