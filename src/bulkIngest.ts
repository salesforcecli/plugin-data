/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { platform } from 'node:os';
import { Flags } from '@salesforce/sf-plugins-core';
import { IngestJobV2, JobInfoV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Connection, Messages, SfError } from '@salesforce/core';
import { Schema } from '@jsforce/jsforce-node';
import { Duration } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { BulkIngestStages } from './ux/bulkIngestStages.js';
import { BulkUpdateRequestCache, BulkImportRequestCache, BulkUpsertRequestCache } from './bulkDataRequestCache.js';
import { detectDelimiter } from './bulkUtils.js';

const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulkIngest');

type BulkIngestInfo = {
  jobId: string;
  processedRecords?: number;
  successfulRecords?: number;
  failedRecords?: number;
};

type ResumeCommandIDs = 'data import resume' | 'data update resume' | 'data upsert resume';

/**
 * Bulk API 2.0 ingest handler for `sf` bulk commands
 *
 * This function should be used exclusively by `sf data bulk` commands that:
 * - do a bulk ingest operation
 * - have a `resume` command
 *
 * It will create the specified bulk ingest job, set up the oclif/MSO stages and return the job info.
 * */
export async function bulkIngest(opts: {
  resumeCmdId: ResumeCommandIDs;
  stageTitle: string;
  object: string;
  operation: JobInfoV2['operation'];
  lineEnding: JobInfoV2['lineEnding'] | undefined;
  columnDelimiter: JobInfoV2['columnDelimiter'] | undefined;
  externalId?: JobInfoV2['externalIdFieldName'];
  conn: Connection;
  cache: BulkUpdateRequestCache | BulkImportRequestCache | BulkUpsertRequestCache;
  async: boolean;
  wait: Duration;
  file: string;
  jsonEnabled: boolean;
  logFn: (message: string) => void;
}): Promise<BulkIngestInfo> {
  const {
    conn,
    operation,
    object,
    lineEnding = platform() === 'win32' ? 'CRLF' : 'LF',
    columnDelimiter,
    file,
    logFn,
  } = opts;

  // validation
  if (opts.externalId && opts.operation !== 'upsert') {
    // TODO: update error msg
    throw new SfError('yadayadayda');
  }

  const timeout = opts.async ? Duration.minutes(0) : opts.wait ?? Duration.minutes(0);
  const async = timeout.milliseconds === 0;

  const baseUrl = ensureString(opts.conn.getAuthInfoFields().instanceUrl);

  const stages = new BulkIngestStages({
    resume: false,
    title: async ? `${opts.stageTitle} (async)` : opts.stageTitle,
    baseUrl,
    jsonEnabled: opts.jsonEnabled,
  });

  stages.start();

  if (async) {
    const job = await createIngestJob(conn, file, {
      object,
      operation,
      lineEnding,
      externalIdFieldName: opts.externalId,
      columnDelimiter: columnDelimiter ?? (await detectDelimiter(file)),
    });

    stages.update(job.getInfo());

    stages.stop();

    await opts.cache.createCacheEntryForRequest(job.id, ensureString(conn.getUsername()), conn.getApiVersion());

    logFn(messages.getMessage('export.resume', [opts.resumeCmdId, job.id]));

    return {
      jobId: job.id,
    };
  }

  // synchronous flow
  const job = await createIngestJob(conn, file, {
    object,
    operation,
    lineEnding,
    externalIdFieldName: opts.externalId,
    columnDelimiter: columnDelimiter ?? (await detectDelimiter(file)),
  });

  stages.setupJobListeners(job);
  stages.processingJob();

  try {
    await job.poll(5000, timeout.milliseconds);

    const jobInfo = job.getInfo();

    // send last data update so job status/num. of records processed/failed represent the last update
    stages.update(jobInfo);

    if (jobInfo.numberRecordsFailed) {
      stages.error();
      throw messages.createError(
        'error.failedRecordDetails',
        [jobInfo.numberRecordsFailed],
        // remove after W-17099874 gets fixed
        // eslint-disable-next-line sf-plugin/no-missing-messages
        [conn.getUsername(), job.id]
      );
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
      // eslint-disable-next-line sf-plugin/no-missing-messages
      throw messages.createError('error.jobFailed', [jobInfo.errorMessage], [conn.getUsername(), job.id]);
    }

    if (jobInfo.state === 'Aborted') {
      stages.stop('aborted');
      // eslint-disable-next-line sf-plugin/no-missing-messages
      throw messages.createError('error.jobAborted', [], [conn.getUsername(), job.id]);
    }

    throw err;
  }
}

/**
 * Bulk API 2.0 ingest resume handler for `sf` bulk commands
 *
 * This function should be used exclusively by `sf data bulk` commands that can resume a bulk ingest operation.
 *
 * It will set up the oclif/MSO stages, poll for the job status and return the job info.
 * */
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
      throw messages.createError(
        'error.failedRecordDetails',
        [jobInfo.numberRecordsFailed],
        // eslint-disable-next-line sf-plugin/no-missing-messages
        [conn.getUsername(), job.id]
      );
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
        [jobInfo.errorMessage],
        // eslint-disable-next-line sf-plugin/no-missing-messages
        [conn.getUsername(), job.id],
        err as Error
      );
    }

    if (jobInfo.state === 'Aborted') {
      stages.stop('aborted');
      // eslint-disable-next-line sf-plugin/no-missing-messages
      throw messages.createError('error.jobAborted', [], [conn.getUsername(), job.id], err as Error);
    }

    throw err;
  }
}

/**
 * Create an ingest job, upload data and mark it as ready for processing
 *
 * */
export async function createIngestJob(
  conn: Connection,
  csvFile: string,
  jobOpts: {
    object: string;
    operation: JobInfoV2['operation'];
    lineEnding: JobInfoV2['lineEnding'];
    externalIdFieldName?: JobInfoV2['externalIdFieldName'];
    columnDelimiter: JobInfoV2['columnDelimiter'];
  }
): Promise<IngestJobV2<Schema>> {
  const job = conn.bulk2.createJob(jobOpts);

  // create the job in the org
  await job.open();

  // upload data
  await job.uploadData(fs.createReadStream(csvFile));

  // mark the job to be ready to be processed
  await job.close();

  return job;
}

export const columnDelimiterFlag = Flags.option({
  summary: messages.getMessage('flags.column-delimiter.summary'),
  options: ['BACKQUOTE', 'CARET', 'COMMA', 'PIPE', 'SEMICOLON', 'TAB'] as const,
})();

export const lineEndingFlag = Flags.option({
  summary: messages.getMessage('flags.line-ending.summary'),
  dependsOn: ['file'],
  options: ['CRLF', 'LF'] as const,
})();
