/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import terminalLink from 'terminal-link';
import { JobInfoV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { BulkImportRequestCache } from '../../../bulkDataRequestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.import.resume');

export type DataImportResumeResult = {
  jobId: string;
  processedRecords?: number;
  successfulRecords?: number;
  failedRecords?: number;
};

export default class DataImportResume extends SfCommand<DataImportResumeResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'use-most-recent': Flags.boolean({
      summary: messages.getMessage('flags.use-most-recent.summary'),
      exactlyOne: ['job-id'],
    }),
    'job-id': Flags.salesforceId({
      summary: messages.getMessage('flags.job-id.summary'),
      char: 'i',
      length: 18,
      startsWith: '750',
      exactlyOne: ['use-most-recent'],
    }),
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      summary: messages.getMessage('flags.wait.summary'),
      defaultValue: 5,
    }),
  };

  public async run(): Promise<DataImportResumeResult> {
    const { flags } = await this.parse(DataImportResume);

    const cache = await BulkImportRequestCache.create();

    const resumeOpts = await cache.resolveResumeOptionsFromCache(
      flags['job-id'],
      flags['use-most-recent'],
      undefined,
      undefined
    );

    const conn = resumeOpts.options.connection;

    const ms = new MultiStageOutput<JobInfoV2>({
      jsonEnabled: this.jsonEnabled(),
      stages: ['Creating ingest job', 'Processing the job'],
      title: 'Importing data',
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
            const numberRecordsFailed = data?.numberRecordsFailed ?? 0;

            if (data?.numberRecordsProcessed) {
              return numberRecordsFailed.toString();
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
              `${
                conn.getAuthInfoFields().instanceUrl as string
              }/lightning/setup/AsyncApiJobStatus/page?address=${encodeURIComponent(`/${data.id}`)}`
            ),
        },
      ],
    });

    ms.skipTo('Processing the job');

    const job = conn.bulk2.job('ingest', {
      id: resumeOpts.jobInfo.id,
    });

    job.on('inProgress', (res: JobInfoV2) => {
      ms.goto('Processing the job', res);
    });

    try {
      await job.poll(5000, flags.wait.milliseconds);

      const jobInfo = await job.check();

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
        ms.stop('failed');
        throw messages.createError('error.timeout', [flags.wait.minutes, job.id]);
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