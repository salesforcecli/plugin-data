/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JobInfoV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Connection, Messages } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { BulkIngestStages } from './ux/bulkIngestStages.js';
import { createIngestJob } from './bulkUtils.js'; // TODO: move this function here?
import { BulkUpdateRequestCache, BulkImportRequestCache } from './bulkDataRequestCache.js';

const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulkIngest');

type BulkIngestInfo = {
  jobId: string;
  processedRecords?: number;
  successfulRecords?: number;
  failedRecords?: number;
};

type ResumeCommandIDs = 'data import resume' | 'data update resume';

export async function bulkIngest(opts: {
  resumeCmdId: ResumeCommandIDs;
  stageTitle: string;
  object: string;
  operation: JobInfoV2['operation'];
  lineEnding: JobInfoV2['lineEnding'] | undefined;
  conn: Connection;
  cache: BulkUpdateRequestCache | BulkImportRequestCache;
  async: boolean;
  wait: Duration;
  file: string;
  jsonEnabled: boolean;
  logFn: (message: string) => void;
}): Promise<BulkIngestInfo> {
  const { conn, logFn } = opts;

  const timeout = opts.async ? Duration.minutes(0) : opts.wait ?? Duration.minutes(0);
  const async = timeout.milliseconds === 0;

  const baseUrl = opts.conn.getAuthInfoFields().instanceUrl as string;

  const stages = new BulkIngestStages({
    resume: false,
    title: async ? `${opts.stageTitle} (async)` : opts.stageTitle,
    baseUrl,
    jsonEnabled: opts.jsonEnabled,
  });

  stages.start();

  if (async) {
    const job = await createIngestJob(conn, 'update', opts.object, opts.file, opts.lineEnding);

    stages.update(job.getInfo());

    stages.stop();

    await opts.cache.createCacheEntryForRequest(job.id, ensureString(conn.getUsername()), conn.getApiVersion());

    logFn(messages.getMessage('export.resume', [opts.resumeCmdId, job.id]));

    return {
      jobId: job.id,
    };
  }

  // synchronous flow
  const job = await createIngestJob(conn, 'update', opts.object, opts.file, opts.lineEnding);

  stages.setupJobListeners(job);
  stages.processingJob();

  try {
    await job.poll(5000, timeout.milliseconds);

    const jobInfo = job.getInfo();

    // send last data update so job status/num. of records processed/failed represent the last update
    stages.update(jobInfo);

    if (jobInfo.numberRecordsFailed) {
      stages.error();
      // TODO: replace this msg to point to `sf data bulk results` when it's added (W-12408034)
      throw messages.createError('error.failedRecordDetails', [
        jobInfo.numberRecordsFailed,
        conn.getUsername(),
        job.id,
      ]);
    }

    stages.stop();

    return {
      jobId: jobInfo.id,
      processedRecords: jobInfo.numberRecordsProcessed,
      successfulRecords: jobInfo.numberRecordsProcessed - (jobInfo.numberRecordsFailed ?? 0),
      failedRecords: jobInfo.numberRecordsFailed,
    };
  } catch (err) {
    const jobInfo = await job.check();

    // send last data update so job status/num. of records processed/failed represent the last update
    stages.update(jobInfo);

    if (err instanceof Error && err.name === 'JobPollingTimeout') {
      stages.stop();
      throw messages.createError('error.timeout', [timeout.minutes, opts.resumeCmdId, job.id]);
    }

    if (jobInfo.state === 'Failed') {
      stages.error();
      throw messages.createError(
        'error.jobFailed',
        [jobInfo.errorMessage, conn.getUsername(), job.id],
        [],
        err as Error
      );
    }

    if (jobInfo.state === 'Aborted') {
      stages.error();
      // TODO: replace this msg to point to `sf data bulk results` when it's added (W-12408034)
      throw messages.createError('error.jobAborted', [conn.getUsername(), job.id], [], err as Error);
    }

    throw err;
  }
}

export async function bulkIngestResume(opts: {
  cmdId: ResumeCommandIDs;
  stageTitle: string;
  cache: BulkUpdateRequestCache;
  jobIdOrMostRecent: string | boolean;
  jsonEnabled: boolean;
  wait: Duration;
}): Promise<BulkIngestInfo> {
  const resumeOpts = await opts.cache.resolveResumeOptionsFromCache(opts.jobIdOrMostRecent);

  const conn = resumeOpts.options.connection;

  const stages = new BulkIngestStages({
    resume: true,
    title: opts.stageTitle,
    baseUrl: ensureString(conn.getAuthInfoFields().instanceUrl),
    jsonEnabled: opts.jsonEnabled,
  });

  stages.start();

  const job = conn.bulk2.job('ingest', {
    id: resumeOpts.jobInfo.id,
  });

  stages.setupJobListeners(job);

  try {
    await job.poll(5000, opts.wait.milliseconds);

    const jobInfo = await job.check();

    // send last data update so job status/num. of records processed/failed represent the last update
    stages.update(jobInfo);

    if (jobInfo.numberRecordsFailed) {
      stages.error();
      // TODO: replace this msg to point to `sf data bulk results` when it's added (W-12408034)
      throw messages.createError('error.failedRecordDetails', [
        jobInfo.numberRecordsFailed,
        conn.getUsername(),
        job.id,
      ]);
    }

    stages.stop();

    return {
      jobId: jobInfo.id,
      processedRecords: jobInfo.numberRecordsProcessed,
      successfulRecords: jobInfo.numberRecordsProcessed - (jobInfo.numberRecordsFailed ?? 0),
      failedRecords: jobInfo.numberRecordsFailed,
    };
  } catch (err) {
    const jobInfo = await job.check();

    // send last data update so job status/num. of records processed/failed represent the last update
    stages.update(jobInfo);

    if (err instanceof Error && err.name === 'JobPollingTimeout') {
      stages.error();
      throw messages.createError('error.timeout', [opts.wait.minutes, opts.cmdId, job.id]);
    }

    if (jobInfo.state === 'Failed') {
      stages.error();
      throw messages.createError(
        'error.jobFailed',
        [jobInfo.errorMessage, conn.getUsername(), job.id],
        [],
        err as Error
      );
    }

    if (jobInfo.state === 'Aborted') {
      stages.error();
      // TODO: replace this msg to point to `sf data bulk results` when it's added (W-12408034)
      throw messages.createError('error.jobAborted', [conn.getUsername(), job.id], [], err as Error);
    }

    throw err;
  }
}
