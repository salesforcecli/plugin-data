/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { QueryJobInfoV2, QueryJobV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { BulkExportRequestCache } from '../../../bulkDataRequestCache.js';
import { exportRecords } from '../../../bulkUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.export.resume');

export type DataExportResumeResult = {
  totalSize: number;
  filePath: string;
};

export default class DataExportResume extends SfCommand<DataExportResumeResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'job-id': Flags.salesforceId({
      length: 18,
      char: 'i',
      startsWith: '750',
      summary: messages.getMessage('flags.job-id.summary'),
      exactlyOne: ['job-id', 'use-most-recent'],
    }),
    'use-most-recent': Flags.boolean({
      summary: messages.getMessage('flags.use-most-recent.summary'),
      exactlyOne: ['job-id', 'use-most-recent'],
    }),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<DataExportResumeResult> {
    const { flags } = await this.parse(DataExportResume);

    const cache = await BulkExportRequestCache.create();

    const resumeOpts = await cache.resolveResumeOptionsFromCache(
      flags['job-id'] ?? flags['use-most-recent'],
      flags['api-version']
    );

    const queryJob = new QueryJobV2(resumeOpts.options.connection, {
      id: resumeOpts.jobInfo.id,
      pollingOptions: {
        pollInterval: Math.max(5000),
        pollTimeout: Math.max(30_000),
      },
    });

    const ms = new MultiStageOutput<QueryJobInfoV2>({
      title: 'Exporting data',
      jsonEnabled: flags.json ?? false,
      stages: ['checking query job status', 'exporting records'],
      postStagesBlock: [
        {
          label: 'Status',
          type: 'dynamic-key-value',
          bold: true,
          get: (data) => data?.state,
        },
      ],
    });
    ms.goto('checking query job status');

    queryJob.on('jobComplete', (jobInfo: QueryJobInfoV2) => {
      ms.goto('exporting records', { state: jobInfo.state });
    });

    queryJob.on('error', (err) => {
      ms.stop('failed');
      throw err;
    });

    try {
      const jobInfo = await exportRecords(resumeOpts.options.connection, queryJob, resumeOpts.outputInfo);

      ms.stop();

      this.log(`${jobInfo.numberRecordsProcessed} records written to ${resumeOpts.outputInfo.filePath}`);

      return {
        totalSize: jobInfo.numberRecordsProcessed,
        filePath: resumeOpts.outputInfo.filePath,
      };
    } catch (err) {
      ms.stop('failed');
      throw err;
    }
  }
}
