/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Logger, Messages } from '@salesforce/core';
import { QueryJobV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import ansis from 'ansis';
import { BulkExportRequestCache } from '../../../bulkDataRequestCache.js';
import { getQueryStream, JsonWritable } from './bulk.js';

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

  private logger!: Logger;

  public async run(): Promise<DataExportResumeResult> {
    const { flags } = await this.parse(DataExportResume);

    this.logger = await Logger.child('data:export:resume');

    const cache = await BulkExportRequestCache.create();

    const resumeOpts = await cache.resolveResumeOptionsFromCache(
      flags['bulk-query-id'],
      flags['use-most-recent'],
      flags['target-org'],
      flags['api-version']
    );

    const queryJob = new QueryJobV2(resumeOpts.options.connection, {
      id: resumeOpts.jobInfo.id,
      pollingOptions: {
        pollInterval: resumeOpts.options.pollingOptions.pollInterval,
        // TODO: maybe do this check on `export bulk` and cache 1s if async?
        // polling options are retrieved from the cache.
        // If `--async` or `--wait 0` were used, we'd be passing that to the jsforce poll method,
        // which means it would never check the actual result, and always throw a timeout error */
        pollTimeout: Math.max(resumeOpts.options.pollingOptions.pollTimeout, 1000),
      },
    });

    const [recordStream, jobInfo] = await getQueryStream(queryJob, this.logger);

    // switch stream into flowing mode
    recordStream.on('record', () => {});

    if (!resumeOpts.outputFormat) {
      throw new Error('output format was not cached');
    }

    if (!resumeOpts.outputFile) {
      throw new Error('output format was not cached');
    }

    if (resumeOpts.outputFormat) {
      const fileStream = new JsonWritable(resumeOpts.outputFile, jobInfo.numberRecordsProcessed);
      recordStream.pipe(fileStream);
    } else {
      const fileStream = fs.createWriteStream(resumeOpts.outputFile);
      recordStream.stream().pipe(fileStream);
    }

    this.log(ansis.bold(`${jobInfo.numberRecordsProcessed} records written to ${resumeOpts.outputFile}`));

    return {
      totalSize: jobInfo.numberRecordsProcessed,
      path: resumeOpts.outputFile,
    };
  }
}
