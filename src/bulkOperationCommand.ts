/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { ReadStream } from 'node:fs';
import os from 'node:os';

import { Flags } from '@salesforce/sf-plugins-core';
import { Duration } from '@salesforce/kit';
import { Connection, Messages } from '@salesforce/core';
import { ux } from '@oclif/core';
import { Schema } from 'jsforce';
import { IngestJobV2, IngestJobV2FailedResults, IngestOperation, JobInfoV2 } from 'jsforce/lib/api/bulk2.js';
import { orgFlags } from './flags.js';
import { BulkDataRequestCache } from './bulkDataRequestCache.js';
import { BulkResultV2 } from './types.js';
import { isBulkV2RequestDone, transformResults, waitOrTimeout } from './bulkUtils.js';
import { BulkBaseCommand, getRemainingTimeStatus } from './BulkBaseCommand.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.operation.command');

type CreateJobOptions = {
  object: string;
  operation: IngestOperation;
  externalIdFieldName?: string;
  lineEnding?: 'CRLF';
};

export abstract class BulkOperationCommand extends BulkBaseCommand {
  public static readonly baseFlags = {
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

  public async runBulkOperation(
    sobject: string,
    csvFileName: string,
    connection: Connection,
    wait: number,
    verbose: boolean,
    operation: IngestOperation,
    options?: { extIdField: string }
  ): Promise<BulkResultV2> {
    this.cache = await this.getCache();
    this.isAsync = !wait;
    this.operation = operation;
    this.wait = wait;
    try {
      const csvRecords: ReadStream = fs.createReadStream(csvFileName, { encoding: 'utf-8' });
      this.spinner.start(`Running ${this.isAsync ? 'async ' : ''}bulk ${operation} request`);
      this.endWaitTime = Date.now() + Duration.minutes(this.wait).milliseconds;
      this.spinner.status = getRemainingTimeStatus(this.isAsync, this.endWaitTime);
      const createJobOptions: CreateJobOptions = {
        object: sobject,
        operation,
        externalIdFieldName: options?.extIdField,
      };
      if (os.platform() === 'win32') {
        createJobOptions.lineEnding = 'CRLF';
      }
      this.job = connection.bulk2.createJob(createJobOptions);
      this.connection = connection;

      this.setupLifecycleListeners();
      try {
        const jobInfo = await executeBulkV2DataRequest(this.job, csvRecords, this.wait);
        if (this.isAsync) {
          await this.cache?.createCacheEntryForRequest(
            this.job.id ?? '',
            this.connection?.getUsername(),
            this.connection?.getApiVersion()
          );
        }
        this.displayBulkV2Result(jobInfo);
        const result = { jobInfo } as BulkResultV2;
        if (!isBulkV2RequestDone(jobInfo)) {
          return result;
        }
        if (this.jsonEnabled()) {
          result.records = transformResults(await this.job.getAllResults());
        }
        // We only print human readable error outputs if --json is not specified.
        // The JSON result itself will already contain the error information (see above).
        else if (verbose) {
          const records = await this.job.getAllResults();
          if (records?.failedResults?.length > 0) {
            printBulkErrors(records.failedResults);
          }
        }
        return result;
      } catch (err) {
        this.spinner.stop();
        throw err;
      }
    } finally {
      this.spinner.stop();
    }
  }

  protected abstract getCache(): Promise<BulkDataRequestCache>;
}

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
  wait?: number
): Promise<JobInfoV2> => {
  await job.open();
  const timeNow = Date.now();
  let remainingTime = wait ? Duration.minutes(wait).milliseconds : 0;
  job.emit('jobProgress', { remainingTime, stage: 'uploading' });
  await job.uploadData(input);
  remainingTime = remainingTime - (Date.now() - timeNow);
  job.emit('jobProgress', { remainingTime, stage: 'uploadComplete' });
  await job.close();
  if (remainingTime > 0) {
    job.emit('startPolling');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await waitOrTimeout(job, remainingTime);
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
