/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Spinner } from '@salesforce/sf-plugins-core';
import { IngestJobV2, JobInfoV2 } from 'jsforce/lib/api/bulk2.js';
import { Duration } from '@salesforce/kit';
import { capitalCase } from 'change-case';
import { Messages } from '@salesforce/core';
import { Schema } from 'jsforce';
import { getResultMessage } from './reporters.js';
import { BulkDataRequestCache } from './bulkDataRequestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.base.command');

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
  job.on('jobProgress', () => {
    const handler = async (): Promise<void> => {
      const jobInfo = await job.check();
      cmd.spinner.status = `${getRemainingTimeStatus({
        isAsync,
        endWaitTime,
      })}${getStage(jobInfo.state)}${getRemainingRecordsStatus(jobInfo)}`;
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
  if (isAsync && jobInfo.state !== 'JobComplete' && jobInfo.state !== 'Failed') {
    cmd.logSuccess(messages.getMessage('success', [jobInfo.operation, jobInfo.id]));
    cmd.info(messages.getMessage('checkStatus', [jobInfo.operation, jobInfo.id, username]));
  } else {
    cmd.log();
    cmd.info(getResultMessage(jobInfo));
    if ((jobInfo.numberRecordsFailed ?? 0) > 0 || jobInfo.state === 'Failed') {
      cmd.info(messages.getMessage('checkJobViaUi', [username, jobInfo.id]));
      process.exitCode = 1;
    }
    if (jobInfo.state === 'InProgress' || jobInfo.state === 'Open') {
      cmd.info(messages.getMessage('checkStatus', [jobInfo.operation, jobInfo.id, username]));
    }
    if (jobInfo.state === 'Failed') {
      const error = messages.createError('bulkJobFailed', [jobInfo.id]);
      error.setData(jobInfo);
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
