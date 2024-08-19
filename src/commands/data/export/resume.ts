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
  filePath: string;
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
      flags['api-version']
    );

    const queryJob = new QueryJobV2(resumeOpts.options.connection, {
      id: resumeOpts.jobInfo.id,
      pollingOptions: {
        // TODO:
        // this will always be `0` (set in BulkExportRequestCache.resolveResumeOptionsFromCache), should be increased or polling might burn API quota
        pollInterval: resumeOpts.options.pollingOptions.pollInterval,
        // polling options are retrieved from the cache.
        // If `--async` or `--wait 0` were used, we'd be passing `0` (set in BulkExportRequestCache.resolveResumeOptionsFromCache)
        // to the jsforce poll method, which means it would never check the actual result, and always throw a timeout error */
        //
        // TODO: big export queries can take a while to get processed, 1s might cause `export resume` to timeout before the query job is done
        pollTimeout: Math.max(resumeOpts.options.pollingOptions.pollTimeout, 1000),
      },
    });

    const [recordStream, jobInfo] = await getQueryStream(queryJob, resumeOpts.outputInfo.columnDelimiter, this.logger);

    // switch stream into flowing mode
    recordStream.on('record', () => {});

    if (resumeOpts.outputInfo.format === 'json') {
      const fileStream = new JsonWritable(resumeOpts.outputInfo.filePath, jobInfo.numberRecordsProcessed);
      recordStream.pipe(fileStream);
    } else {
      const fileStream = fs.createWriteStream(resumeOpts.outputInfo.filePath);
      recordStream.stream().pipe(fileStream);
    }

    this.log(ansis.bold(`${jobInfo.numberRecordsProcessed} records written to ${resumeOpts.outputInfo.filePath}`));

    return {
      totalSize: jobInfo.numberRecordsProcessed,
      filePath: resumeOpts.outputInfo.filePath,
    };
  }
}
