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

  public async runBulkOperation(sobject: string,
                                csvFileName: string,
                                connection: Connection,
                                wait: number,
                                operation: BulkOperation,
                                options?: { extIdField: string; concurrencyMode?: 'Serial' | 'Parallel' }): Promise<BatcherReturnType> {
    this.cache = await this.getCache();
    this.isAsync = !wait;
    this.operation = operation;
    let result: BatcherReturnType;
    try {
      const csvRecords: ReadStream = fs.createReadStream(csvFileName, { encoding: 'utf-8' });
      if (wait > 0) {
        this.progress.start(0, { title: operation }, {
          title: `Bulk ${operation} Progress`,
          format: '%s | {bar} | {value} records of {total} processed',
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          linewrap: true
        });
      } else {
        this.spinner.start(`Creating async bulk ${operation} request`);
      }

      this.job = connection.bulk.createJob(sobject, operation, options);
      this.connection = connection;

      const batcher: Batcher = new Batcher(connection);
      this.setupLifecycleListeners(batcher);

      result = await batcher.createAndExecuteBatches(this.job, csvRecords, sobject, wait);
      const jobInfo = await this.job.check();
      const inProgress = result.some((batch) => batch.state in ['InProgress', 'Queued']);
      if (!inProgress) {
        const cache = await this.getCache();
        await cache.createCacheEntryForRequest(jobInfo.id, connection.getUsername(), connection.getApiVersion());
      }
      this.progress.stop();
      return result;
    } catch (e) {
      this.progress.stop();
      if (!(e instanceof Error)) {
        throw e;
      }
      throw SfError.wrap(e);
    } finally {
      this.spinner.stop();
      this.progress.stop();
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
        if (jobInfo.state !== 'Closed') {
          this.info(`To review the details of this job, run:\n${this.config.bin} org open --target-org ${this.connection?.getUsername()} --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F${jobInfo.id}"`);
        }
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
      this.progress.setTotal(this.totalRecords);
      this.progress.update(0);
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
      this.progress.update(this.recordsProcessed);
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    batcher.on('allBatchesDone', async (): Promise<void> => {
      await this.displayResult();
      this.progress.stop();
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    batcher.on('allBatchesQueued', async (): Promise<void> => {
      await this.displayResult();
      this.spinner.stop();
    });

    batcher.on('bulkJobError', (data: Error) => {
      this.progress.stop();
      throw SfError.wrap(data);
    });
    batcher.on('bulkOperationTimeout', (data: Error) => {
      this.progress.stop();
      throw SfError.wrap(data);
    });
  }

  protected abstract getCache(): Promise<BulkDataRequestCache>;

}
