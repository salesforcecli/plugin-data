/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfCommand } from '@salesforce/sf-plugins-core';
import { BulkOperation, IngestJobV2, IngestOperation, JobInfoV2, JobStateV2 } from 'jsforce/lib/api/bulk';
import { Duration } from '@salesforce/kit';
import { capitalCase } from 'change-case';
import { Connection, Lifecycle, Messages } from '@salesforce/core';
import { Schema } from 'jsforce';
import { getResultMessage } from './reporters';
import { BulkResultV2 } from './types';
import { BulkDataRequestCache } from './bulkDataRequestCache';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.base.command');

export abstract class BulkBaseCommand extends SfCommand<BulkResultV2> {
  protected lifeCycle = Lifecycle.getInstance();
  protected job!: IngestJobV2<Schema, IngestOperation>;
  protected connection: Connection | undefined;
  protected cache: BulkDataRequestCache | undefined;
  protected isAsync = false;
  protected operation!: BulkOperation;
  protected endWaitTime = 0;
  protected wait = 0;
  private numberRecordsProcessed = 0;
  private numberRecordsFailed = 0;
  private numberRecordSuceeded = 0;
  private timeout = false;

  protected displayBulkV2Result(jobInfo: JobInfoV2): void {
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
      if ((jobInfo.numberRecordsFailed ?? 0) > 0 || jobInfo.state === 'Failed') {
        this.info(messages.getMessage('checkJobViaUi', [this.config.bin, this.connection?.getUsername(), jobInfo.id]));
        process.exitCode = 1;
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
      if (jobInfo.state === 'Failed') {
        throw messages.createError('bulkJobFailed', [jobInfo.id]);
      }
    }
  }

  protected setupLifecycleListeners(): void {
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

  protected getRemainingTimeStatus(): string {
    return this.isAsync
      ? ''
      : messages.getMessage('remainingTimeStatus', [Duration.milliseconds(this.endWaitTime - Date.now()).minutes]);
  }

  protected getRemainingRecordsStatus(): string {
    // the leading space is intentional
    return ` ${messages.getMessage('remainingRecordsStatus', [
      this.numberRecordSuceeded,
      this.numberRecordsFailed,
      this.numberRecordsProcessed,
    ])}`;
  }

  // eslint-disable-next-line class-methods-use-this
  protected getStage(state: JobStateV2): string {
    return ` Stage: ${capitalCase(state)}.`;
  }
}
