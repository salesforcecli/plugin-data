/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { QueryJobInfoV2, QueryJobV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Parsable } from '@jsforce/jsforce-node/lib/record-stream.js';
import { ResumeOptions } from '../../../types.js';
import { BulkExportRequestCache } from '../../../bulkDataRequestCache.js';
import { JsonWritable } from './bulk.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.export.resume');

export type DataExportResumeResult = {
  totalSize: number;
  path: string;
};

export default class DataExportResume extends SfCommand<DataExportResumeResult> {
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
    'target-org': Flags.requiredOrg(),
    'bulk-query-id': Flags.salesforceId({
      length: 18,
      char: 'i',
      startsWith: '750',
      summary: 'hehehe',
      exactlyOne: ['bulk-query-id', 'use-most-recent'],
    }),
    'use-most-recent': Flags.boolean({
      summary: 'hehe',
      exactlyOne: ['bulk-query-id', 'use-most-recent'],
    }),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<DataExportResumeResult> {
    const { flags } = await this.parse(DataExportResume);

    const cache = await BulkExportRequestCache.create();

    const resumeOptions = await cache.resolveResumeOptionsFromCache(
      flags['bulk-query-id'],
      flags['use-most-recent'],
      flags['target-org'],
      flags['api-version']
    );

    const queryJob = new QueryJobV2(resumeOptions.options.connection, {
      id: resumeOptions.jobInfo.id,
      pollingOptions: getNonZeroTimeoutPollingOptions(resumeOptions.options.pollingOptions),
    });

    const recordStream = new Parsable();
    const dataStream = recordStream.stream('csv');

    // switch stream into flowing mode
    recordStream.on('record', () => {});

    let jobInfo: QueryJobInfoV2 | undefined;

    try {
      queryJob.on('jobComplete', (completedJob: QueryJobInfoV2) => {
        jobInfo = completedJob;
      });
      await queryJob.poll();

      const queryRecordsStream = await queryJob.result().then((s) => s.stream());
      queryRecordsStream.pipe(dataStream);
    } catch (error) {
      const err = error as Error;
      // this.logger.error(`bulk query failed due to: ${err.message}`);

      if (err.name !== 'JobPollingTimeoutError') {
        // fires off one last attempt to clean up and ignores the result | error
        queryJob.delete().catch((ignored: Error) => ignored);
      }

      throw err;
    }

    if (typeof jobInfo === 'undefined') {
      throw new Error('could not get jobinfo');
    }

    if (!resumeOptions.outputFormat) {
      throw new Error('output format was not cached');
    }

    if (!resumeOptions.outputFile) {
      throw new Error('output format was not cached');
    }

    if (resumeOptions.outputFormat) {
      const fileStream = new JsonWritable(resumeOptions.outputFile, jobInfo.numberRecordsProcessed);
      recordStream.pipe(fileStream);
    } else {
      const fileStream = fs.createWriteStream(resumeOptions.outputFile);
      recordStream.stream().pipe(fileStream);
    }

    return {
      totalSize: jobInfo.numberRecordsProcessed,
      path: resumeOptions.outputFile,
    };
  }
}

/**
 * polling options are retrieved from the cache.
 * If the data:query used `--async` or `--wait` 0, we'd be passing that to the jsforce poll method,
 * which means it would never check the actual result, and always throw a timeout error */
const getNonZeroTimeoutPollingOptions = (
  pollingOptions: ResumeOptions['options']['pollingOptions']
): ResumeOptions['options']['pollingOptions'] => ({
  ...pollingOptions,
  pollTimeout: Math.max(pollingOptions.pollTimeout, 1000),
});
