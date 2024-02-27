/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand } from '@salesforce/sf-plugins-core';
import { IngestJobV2, JobInfoV2 } from 'jsforce/lib/api/bulk2.js';
import { Duration } from '@salesforce/kit';
import { capitalCase } from 'change-case';
import { Connection, Messages } from '@salesforce/core';
import { Schema } from 'jsforce';
import { getResultMessage } from './reporters.js';
import { BulkResultV2 } from './types.js';
import { BulkDataRequestCache } from './bulkDataRequestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.base.command');

export abstract class BulkBaseCommand extends SfCommand<BulkResultV2> {
  protected job!: IngestJobV2<Schema>;
  protected connection: Connection | undefined;
  protected cache: BulkDataRequestCache | undefined;
  protected isAsync = false;
  protected endWaitTime = 0;

  protected displayBulkV2Result(jobInfo: JobInfoV2): void {
    if (this.isAsync) {
      this.logSuccess(messages.getMessage('success', [jobInfo.operation, jobInfo.id]));
      this.info(messages.getMessage('checkStatus', [jobInfo.operation, jobInfo.id, this.connection?.getUsername()]));
    } else {
      this.log();
      this.info(getResultMessage(jobInfo));
      if ((jobInfo.numberRecordsFailed ?? 0) > 0 || jobInfo.state === 'Failed') {
        this.info(messages.getMessage('checkJobViaUi', [this.connection?.getUsername(), jobInfo.id]));
        process.exitCode = 1;
      }
      if (jobInfo.state === 'InProgress' || jobInfo.state === 'Open') {
        this.info(messages.getMessage('checkStatus', [jobInfo.operation, jobInfo.id, this.connection?.getUsername()]));
      }
      if (jobInfo.state === 'Failed') {
        throw messages.createError('bulkJobFailed', [jobInfo.id]);
      }
    }
  }

  protected setupLifecycleListeners(): void {
    this.job.on('jobProgress', () => {
      const handler = async (): Promise<void> => {
        const jobInfo = await this.job.check();
        this.spinner.status = `${getRemainingTimeStatus(this.isAsync, this.endWaitTime)}${getStage(
          jobInfo.state
        )}${getRemainingRecordsStatus(jobInfo)}`;
      };
      handler().catch((err) => this.eventListenerErrorHandler(err));
    });

    this.job.on('failed', (err: Error) => {
      try {
        this.error(err);
      } finally {
        this.spinner.stop();
      }
    });

    this.job.on('error', (message: string) => {
      try {
        this.error(message);
      } finally {
        this.spinner.stop();
      }
    });

    this.job.once('jobTimeout', () => {
      const handler = async (): Promise<void> => {
        await this.cache?.createCacheEntryForRequest(
          this.job.id ?? '',
          this.connection?.getUsername(),
          this.connection?.getApiVersion()
        );
        this.displayBulkV2Result(await this.job.check());
      };
      handler().catch((err) => this.eventListenerErrorHandler(err));
    });
  }

  private eventListenerErrorHandler(err: unknown): void {
    return err instanceof Error || typeof err === 'string' ? this.error(err) : this.error(JSON.stringify(err));
  }
}

export const getRemainingTimeStatus = (isAsync: boolean, endWaitTime: number): string =>
  isAsync ? '' : messages.getMessage('remainingTimeStatus', [Duration.milliseconds(endWaitTime - Date.now()).minutes]);

const getStage = (state: JobInfoV2['state']): string => ` Stage: ${capitalCase(state)}.`;

const getRemainingRecordsStatus = (jobInfo: JobInfoV2): string => {
  const numberRecordsProcessed = jobInfo.numberRecordsProcessed ?? 0;
  const numberRecordsFailed = jobInfo.numberRecordsFailed ?? 0;
  const numberRecordSucceeded = numberRecordsProcessed - numberRecordsFailed;

  // the leading space is intentional
  return ` ${messages.getMessage('remainingRecordsStatus', [
    numberRecordSucceeded,
    numberRecordsFailed,
    numberRecordsProcessed,
  ])}`;
};
