/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { platform } from 'node:os';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { Connection, Messages, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import terminalLink from 'terminal-link';
import { IngestJobV2, JobInfoV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Schema } from '@jsforce/jsforce-node';
import { BulkImportRequestCache } from '../../../bulkDataRequestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.import.bulk');

export type DataImportBulkResult = {
  jobId: string;
  processedRecords?: number;
  successfulRecords?: number;
  failedRecords?: number;
};

export default class DataImportBulk extends SfCommand<DataImportBulkResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    async: Flags.boolean({
      summary: messages.getMessage('flags.async.summary'),
      char: 'a',
      exclusive: ['wait'],
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
    wait: Flags.duration({
      summary: messages.getMessage('flags.wait.summary'),
      char: 'w',
      unit: 'minutes',
      exclusive: ['async'],
    }),
    'target-org': Flags.requiredOrg(),
    'line-ending': Flags.option({
      summary: messages.getMessage('flags.line-ending.summary'),
      dependsOn: ['file'],
      options: ['CRLF', 'LF'] as const,
    })(),
  };

  public async run(): Promise<DataImportBulkResult> {
    const { flags } = await this.parse(DataImportBulk);

    const conn = flags['target-org'].getConnection(flags['api-version']);

    const timeout = flags.async ? Duration.minutes(0) : flags.wait ?? Duration.minutes(0);
    const async = timeout.milliseconds === 0;

    const baseUrl = flags['target-org'].getField<string>(Org.Fields.INSTANCE_URL).toString();

    const ms = new MultiStageOutput<JobInfoV2>({
      jsonEnabled: flags.json ?? false,
      stages: async ? ['Creating ingest job'] : ['Creating ingest job', 'Processing the job'],
      title: async ? 'Importing data (async)' : 'Importing data',
      stageSpecificBlock: [
        {
          stage: 'Processing the job',
          label: 'Processed records',
          type: 'dynamic-key-value',
          get: (data): string | undefined => {
            if (data?.numberRecordsProcessed) {
              return data.numberRecordsProcessed.toString();
            }
          },
        },
        {
          stage: 'Processing the job',
          label: 'Successful records',
          type: 'dynamic-key-value',
          get: (data): string | undefined => {
            const numberRecordsFailed = data?.numberRecordsFailed ?? 0;

            if (data?.numberRecordsProcessed) {
              return (data.numberRecordsProcessed - numberRecordsFailed).toString();
            }
          },
        },
        {
          stage: 'Processing the job',
          label: 'Failed records',
          type: 'dynamic-key-value',
          get: (data): string | undefined => {
            if (data?.numberRecordsFailed) {
              return data.numberRecordsFailed.toString();
            }
          },
        },
      ],
      postStagesBlock: [
        {
          label: 'Status',
          type: 'dynamic-key-value',
          bold: true,
          get: (data) => data?.state,
        },
        {
          label: 'Job Id',
          type: 'dynamic-key-value',
          bold: true,
          get: (data) =>
            data?.id &&
            terminalLink(
              data.id,
              `${baseUrl}/lightning/setup/AsyncApiJobStatus/page?address=${encodeURIComponent(`/${data.id}`)}`
            ),
        },
      ],
    });

    if (async) {
      ms.goto('Creating ingest job');

      const job = await createIngestJob(conn, flags.file, flags.sobject, flags['line-ending']);

      ms.goto('Creating ingest job', job.getInfo());
      ms.stop();

      const cache = await BulkImportRequestCache.create();
      await cache.createCacheEntryForRequest(job.id, conn.getUsername(), conn.getApiVersion());

      this.log(messages.getMessage('export.resume', [job.id]));

      return {
        jobId: job.id,
      };
    }

    // synchronous flow
    const job = await createIngestJob(conn, flags.file, flags.sobject, flags['line-ending']);

    ms.goto('Processing the job');

    job.on('inProgress', (res: JobInfoV2) => {
      ms.goto('Processing the job', res);
    });

    try {
      await job.poll(5000, timeout.milliseconds);

      const jobInfo = job.getInfo();

      // send last data update so job status/num. of records processed/failed represent the last update
      ms.goto('Processing the job', jobInfo);

      if (jobInfo.numberRecordsFailed) {
        ms.stop('failed');
        // TODO: replace this msg to point to `sf data bulk results` when it's added (W-12408034)
        throw messages.createError('error.failedRecordDetails', [
          jobInfo.numberRecordsFailed,
          conn.getUsername(),
          job.id,
        ]);
      }

      ms.stop();

      return {
        jobId: jobInfo.id,
        processedRecords: jobInfo.numberRecordsProcessed,
        successfulRecords: jobInfo.numberRecordsProcessed - (jobInfo.numberRecordsFailed ?? 0),
        failedRecords: jobInfo.numberRecordsFailed,
      };
    } catch (err) {
      const jobInfo = await job.check();

      // send last data update so job status/num. of records processed/failed represent the last update
      ms.goto('Processing the job', jobInfo);

      if (err instanceof Error && err.name === 'JobPollingTimeout') {
        ms.stop('paused');
        throw messages.createError('error.timeout', [timeout.minutes, job.id]);
      }

      if (jobInfo.state === 'Failed') {
        ms.stop('failed');
        throw messages.createError(
          'error.jobFailed',
          [jobInfo.errorMessage, conn.getUsername(), job.id],
          [],
          err as Error
        );
      }

      if (jobInfo.state === 'Aborted') {
        ms.stop('failed');
        // TODO: replace this msg to point to `sf data bulk results` when it's added (W-12408034)
        throw messages.createError('error.jobAborted', [conn.getUsername(), job.id], [], err as Error);
      }

      throw err;
    }
  }
}

/**
 * Create an ingest job, upload data and mark it as ready for processing
 *
 * */
async function createIngestJob(
  conn: Connection,
  csvFile: string,
  object: string,
  lineEnding: 'CRLF' | 'LF' | undefined
): Promise<IngestJobV2<Schema>> {
  const job = conn.bulk2.createJob({
    operation: 'insert',
    lineEnding: lineEnding ?? platform() === 'win32' ? 'CRLF' : 'LF',
    object,
  });

  // create the job in the org
  await job.open();

  // upload data
  await job.uploadData(fs.createReadStream(csvFile));

  // mark the job to be ready to be processed
  await job.close();

  return job;
}
