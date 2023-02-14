/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { ReadStream } from 'fs';
import * as os from 'os';
import { Flags } from '@salesforce/sf-plugins-core';
import { Duration } from '@salesforce/kit';
import { Connection, Messages } from '@salesforce/core';
import { BulkOperation, IngestJobV2, IngestOperation, JobInfoV2 } from 'jsforce/api/bulk';
import { Schema } from 'jsforce';
import { orgFlags } from './flags';
import { BulkDataRequestCache } from './bulkDataRequestCache';
import { BulkResultV2 } from './types';
import { isBulkV2RequestDone, transformResults, waitOrTimeout } from './bulkUtils';
import { BulkBaseCommand } from './BulkBaseCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.operation.command');

type CreateJobOptions = {
  object: string;
  operation: BulkOperation;
  externalIdFieldName?: string;
  lineEnding?: 'CRLF';
};

export abstract class BulkOperationCommand extends BulkBaseCommand {
  public static readonly baseFlags = {
    ...orgFlags,
    file: Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.csvfile'),
      required: true,
      exists: true,
      aliases: ['csvfile'],
      deprecateAliases: true,
    }),
    sobject: Flags.string({
      char: 's',
      summary: messages.getMessage('flags.sobjecttype'),
      required: true,
      aliases: ['sobjecttype'],
      deprecateAliases: true,
    }),
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      summary: messages.getMessage('flags.wait'),
      min: 0,
      default: Duration.minutes(0),
      exclusive: ['async'],
    }),
    async: Flags.boolean({
      char: 'a',
      summary: messages.getMessage('flags.async.summary'),
      default: false,
      exclusive: ['wait'],
    }),
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
  private static async executeBulkV2DataRequest<J extends Schema, T extends IngestOperation>(
    job: IngestJobV2<J, T>,
    input: ReadStream,
    sobjectType: string,
    wait?: number
  ): Promise<JobInfoV2> {
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
  }

  public async runBulkOperation(
    sobject: string,
    csvFileName: string,
    connection: Connection,
    wait: number,
    operation: BulkOperation,
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
      this.spinner.status = this.getRemainingTimeStatus();
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
        const jobInfo = await BulkOperationCommand.executeBulkV2DataRequest(this.job, csvRecords, sobject, this.wait);
        if (this.isAsync) {
          await this.cache?.createCacheEntryForRequest(
            this.job.id ?? '',
            this.connection?.getUsername(),
            this.connection?.getApiVersion()
          );
        }
        this.displayBulkV2Result(jobInfo);
        const result = { jobInfo } as BulkResultV2;
        if (!isBulkV2RequestDone(jobInfo) || !this.jsonEnabled()) {
          return result;
        }
        result.records = transformResults(await this.job.getAllResults());
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
