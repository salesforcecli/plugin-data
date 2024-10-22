/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { createIngestJob } from '../../../bulkUtils.js';
import { BulkIngestStages } from '../../../ux/bulkIngestStages.js';
import { BulkUpdateRequestCache } from '../../../bulkDataRequestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.update.bulk');

export type DataUpdateBulkResult = {
  jobId: string;
  processedRecords?: number;
  successfulRecords?: number;
  failedRecords?: number;
};

export default class DataUpdateBulk extends SfCommand<DataUpdateBulkResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
      char: 'n',
      required: false,
    }),
    async: Flags.boolean({
      summary: messages.getMessage('flags.async.summary'),
      char: 'a',
    }),
    wait: Flags.duration({
      summary: messages.getMessage('flags.wait.summary'),
      char: 'w',
      unit: 'minutes',
    }),
    file: Flags.file({
      summary: messages.getMessage('flags.file.summary'),
      char: 'f',
      required: true,
      exists: true,
    }),
    sobject: Flags.string({
      summary: messages.getMessage('flags.sobject.summary'),
      char: 's',
      required: true,
    }),
    'api-version': Flags.orgApiVersion(),
    'target-org': Flags.requiredOrg(),
    'line-ending': Flags.option({
      summary: messages.getMessage('flags.line-ending.summary'),
      dependsOn: ['file'],
      options: ['CRLF', 'LF'] as const,
    })(),
  };

  public async run(): Promise<DataUpdateBulkResult> {
    const { flags } = await this.parse(DataUpdateBulk);

    const conn = flags['target-org'].getConnection(flags['api-version']);

    const timeout = flags.async ? Duration.minutes(0) : flags.wait ?? Duration.minutes(0);
    const async = timeout.milliseconds === 0;

    const baseUrl = flags['target-org'].getField<string>(Org.Fields.INSTANCE_URL).toString();

    const stages = new BulkIngestStages({
      resume: false,
      title: async ? 'Updating data (async)' : 'Updating data',
      baseUrl,
      jsonEnabled: this.jsonEnabled(),
    });

    stages.start();

    if (async) {
      const job = await createIngestJob(conn, 'update', flags.sobject, flags.file, flags['line-ending']);

      stages.update(job.getInfo());

      stages.stop();

      const cache = await BulkUpdateRequestCache.create();
      await cache.createCacheEntryForRequest(job.id, ensureString(conn.getUsername()), conn.getApiVersion());

      this.log(messages.getMessage('export.resume', [job.id]));

      return {
        jobId: job.id,
      };
    }

    // synchronous flow
    const job = await createIngestJob(conn, 'update', flags.sobject, flags.file, flags['line-ending']);

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
        throw messages.createError('error.timeout', [timeout.minutes, job.id]);
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
}
