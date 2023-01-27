/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { ReadStream } from 'fs';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Duration } from '@salesforce/kit';
import { Connection, Lifecycle, Messages } from '@salesforce/core';
import { BulkOperation, IngestJobV2, IngestOperation, JobInfoV2, JobStateV2 } from 'jsforce/api/bulk';
import { Schema } from 'jsforce';
import { capitalCase } from 'change-case';
import { orgFlags } from './flags';
import { BulkDataRequestCache } from './bulkDataRequestCache';
import { BulkResultV2 } from './types';
import { isBulkV2RequestDone, transformResults } from './bulkUtils';
import { getResultMessage } from './reporters';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.operation.command');

const POLL_FREQUENCY_MS = 5000;

export abstract class BulkOperationCommand extends SfCommand<BulkResultV2> {
  public static readonly globalFlags = {
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

  protected lifeCycle = Lifecycle.getInstance();
  protected job!: IngestJobV2<Schema, IngestOperation>;
  protected connection: Connection | undefined;
  protected cache: BulkDataRequestCache | undefined;
  private numberRecordsProcessed = 0;
  private numberRecordsFailed = 0;
  private numberRecordSuceeded = 0;
  private isAsync = false;
  private operation!: BulkOperation;
  private endWaitTime = 0;
  private wait = 0;
  private timeout = false;

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
      await BulkOperationCommand.waitOrTimeout(job, remainingTime);
    }
    return job.check();
  }

  private static async waitOrTimeout(job: IngestJobV2<Schema, IngestOperation>, wait: number): Promise<void> {
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
      this.job = connection.bulk2.createJob({ object: sobject, operation, externalIdFieldName: options?.extIdField });
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

  private displayBulkV2Result(jobInfo: JobInfoV2): void {
    if (this.isAsync) {
      this.logSuccess(messages.getMessage('success', [this.operation, jobInfo.id]));
      this.info(
        messages.getMessage('checkStatus', [
          this.config.bin,
          this.operation,
          jobInfo.id,
          this.connection?.getUsername(),
        ])
      );
    } else {
      this.log();
      this.info(getResultMessage(jobInfo));
      if ((jobInfo.numberRecordsFailed ?? 0) > 0) {
        this.info(messages.getMessage('checkJobViaUi', [this.config.bin, this.connection?.getUsername(), jobInfo.id]));
      }
      if (jobInfo.state === 'InProgress' || jobInfo.state === 'Open') {
        this.info(
          messages.getMessage('checkStatus', [
            this.config.bin,
            this.operation,
            jobInfo.id,
            this.connection?.getUsername(),
          ])
        );
      }
    }
  }

  private setupLifecycleListeners(): void {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.job.on('jobProgress', async () => {
      const jobInfo = await this.job.check();
      this.numberRecordsProcessed = jobInfo.numberRecordsProcessed ?? 0;
      this.numberRecordsFailed = jobInfo.numberRecordsFailed ?? 0;
      this.numberRecordSuceeded = this.numberRecordsProcessed - this.numberRecordsFailed;
      this.spinner.status = `${this.getRemainingTimeStatus()}${this.getStage(
        jobInfo.state
      )}${this.getRemainingRecordsStatus()}`;
    });

    this.job.on('error', (message: string) => {
      try {
        this.error(message);
      } finally {
        this.spinner.stop();
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.job.on('jobTimeout', async () => {
      if (!this.timeout) {
        this.timeout = true;
        await this.cache?.createCacheEntryForRequest(
          this.job.id ?? '',
          this.connection?.getUsername(),
          this.connection?.getApiVersion()
        );
        this.displayBulkV2Result(await this.job.check());
      }
    });
  }

  private getRemainingTimeStatus(): string {
    return this.isAsync
      ? ''
      : messages.getMessage('remainingTimeStatus', [Duration.milliseconds(this.endWaitTime - Date.now()).minutes]);
  }

  private getRemainingRecordsStatus(): string {
    // the leading space is intentional
    return ` ${messages.getMessage('remainingRecordsStatus', [
      this.numberRecordSuceeded,
      this.numberRecordsFailed,
      this.numberRecordsProcessed,
    ])}`;
  }

  // eslint-disable-next-line class-methods-use-this
  private getStage(state: JobStateV2): string {
    return ` Stage: ${capitalCase(state)}.`;
  }

  protected abstract getCache(): Promise<BulkDataRequestCache>;
}
