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
import { Connection, Lifecycle, Messages, SfError } from '@salesforce/core';
import { BulkOperation, Job, JobInfo } from 'jsforce/api/bulk';
import { BatchInfo, BulkIngestBatchResult } from 'jsforce/lib/api/bulk';
import { Schema } from 'jsforce';
import { Batcher, BatcherReturnType } from './batcher';
import { orgFlags } from './flags';
import { BulkDataRequestCache } from './bulkDataRequestCache';
import { BatchInfoColumns, getBatchTotals, getFailedBatchesForDisplay } from './reporters';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.operation.command');

export abstract class BulkOperationCommand extends SfCommand<BatcherReturnType> {
  public static readonly globalFlags = {
    ...orgFlags,
    file: Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.csvfile'),
      required: true,
      exists: true,
      aliases: ['csvfile'],
      deprecateAliases: true
    }),
    sobject: Flags.string({
      char: 's',
      summary: messages.getMessage('flags.sobjecttype'),
      required: true,
      aliases: ['sobjecttype'],
      deprecateAliases: true
    }),
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      summary: messages.getMessage('flags.wait'),
      min: 0,
      default: Duration.minutes(0),
      exclusive: ['async']
    }),
    async: Flags.boolean({
      char: 'a',
      summary: messages.getMessage('flags.async.summary'),
      description: messages.getMessage('flags.async.description'),
      default: false,
      exclusive: ['wait']
    })
  };

  protected lifeCycle = Lifecycle.getInstance();
  protected job!: Job<Schema, BulkOperation>;
  protected connection: Connection | undefined;
  protected cache: BulkDataRequestCache | undefined;
  private totalRecords = 0;
  private recordsProcessed = 0;
  private isAsync = false;
  private operation!: BulkOperation;
  private endWaitTime = 0;
  private wait = 0;
  private timeout = false;

  public async runBulkOperation(sobject: string,
                                csvFileName: string,
                                connection: Connection,
                                wait: number,
                                operation: BulkOperation,
                                options?: { extIdField: string; concurrencyMode?: 'Serial' | 'Parallel' }): Promise<BatcherReturnType> {
    this.cache = await this.getCache();
    this.isAsync = !wait;
    this.operation = operation;
    this.wait = wait;
    try {
      const csvRecords: ReadStream = fs.createReadStream(csvFileName, { encoding: 'utf-8' });
      this.spinner.start(`Running ${this.isAsync ? 'async ' : ''}bulk ${operation} request`);
      this.endWaitTime = Date.now() + Duration.minutes(this.wait).milliseconds;
      this.spinner.status = this.getRemainingTimeStatus();

      this.job = connection.bulk.createJob(sobject, operation, options);
      this.connection = connection;

      const batcher: Batcher = new Batcher(connection);
      this.setupLifecycleListeners(batcher);

      return await batcher.createAndExecuteBatches(this.job, csvRecords, sobject, this.wait);
    } finally {
      this.spinner.stop();
    }
  }

  private async displayResult(): Promise<void> {

    const jobInfo = await this.job.info();
    const batches = await this.job.list();

    const ttls = getBatchTotals(batches);
    if (this.isAsync) {
      this.logSuccess(`Bulk ${this.operation} request ${jobInfo.id} started successfully.`);
      this.info(`Run command '${this.config.bin} data ${this.operation} resume -i ${jobInfo.id} -o ${this.connection?.getUsername()}' to check status.`);
    } else {
      this.log();
      const failedBatches = getFailedBatchesForDisplay(batches);
      const resultMessage = `Job ${jobInfo.id} Status ${jobInfo.state} Total Records ${ttls.total} Success ${ttls.success} Failed ${ttls.failed}. Number of Batches ${batches.length}. Number of failed batches ${failedBatches.length}`;
      this.info(resultMessage);
      if (failedBatches.length > 0) {
        this.table(failedBatches, BatchInfoColumns);
        this.info(`To review the details of this job, run:\n${this.config.bin} org open --target-org ${this.connection?.getUsername()} --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F${jobInfo.id}"`);
      }
      if (jobInfo.state !== 'Closed') {
        this.info(`Run command '${this.config.bin} data ${this.operation} resume -i ${jobInfo.id} -o ${this.connection?.getUsername()}' to check status.\n`);
      }
    }
  }

  private setupLifecycleListeners(batcher: Batcher): void {
    /* eslint-disable @typescript-eslint/require-await */
    batcher.on('bulkStatusTotals', (totals: { totalRecords: number; totalBatches: number }) => {
      this.totalRecords = totals.totalRecords;
      this.spinner.status = `${this.getRemainingTimeStatus()}${this.getRemainingRecordsStatus()}`;
    });
    batcher.on('bulkBatchStatus', (data: {
      summary: JobInfo | BatchInfo;
      results?: BulkIngestBatchResult;
      batchNum?: number;
      isJob?: boolean;
      errorMessages: string[];
    }) => {
      const batchInfo = !data.isJob ? data.summary as BatchInfo : undefined;
      if (batchInfo && batchInfo.state === 'Completed') {
        this.recordsProcessed += batchInfo ? parseInt(batchInfo.numberRecordsProcessed, 10) : 0;
      }
      this.spinner.status = `${this.getRemainingTimeStatus()}${this.getRemainingRecordsStatus()}`;
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    batcher.on('allBatchesDone', async (): Promise<void> => {
      await this.displayResult();
      this.spinner.stop();
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    batcher.on('allBatchesQueued', async (): Promise<void> => {
      await this.displayResult();
      this.spinner.stop();
    });

    batcher.on('batchError', (message: string) => {
      try {
        this.error(message);
      } finally {
        this.spinner.stop();
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    batcher.on('batchTimeout', async () => {
      if (!this.timeout) {
        this.timeout = true;
        await this.cache?.createCacheEntryForRequest(this.job.id ?? '', this.connection?.getUsername(), this.connection?.getApiVersion());
        await this.displayResult();
      }
    });
    batcher.on('bulkOperationTimeout', (data: Error) => {
      throw SfError.wrap(data);
    });
  }

  private getRemainingTimeStatus(): string {
    return this.isAsync ? '' : `Remaining time: ${Duration.milliseconds(this.endWaitTime - Date.now()).minutes} minutes. `;
  }

  private getRemainingRecordsStatus(): string {
    return `${this.recordsProcessed}/${this.totalRecords} records processed`;
  }

  protected abstract getCache(): Promise<BulkDataRequestCache>;

}
