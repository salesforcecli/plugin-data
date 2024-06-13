/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { QueryJobV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import type { Record as jsforceRecord } from '@jsforce/jsforce-node';
import {
  Flags,
  loglevel,
  optionalOrgFlagWithDeprecations,
  orgApiVersionFlagWithDeprecations,
  SfCommand,
} from '@salesforce/sf-plugins-core';
import { ResumeOptions } from '../../../types.js';
import { resultFormatFlag } from '../../../flags.js';
import { displayResults, transformBulkResults } from '../../../queryUtils.js';
import { BulkQueryRequestCache } from '../../../bulkDataRequestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const reportMessages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.report');
// needed by the flags loaded from the other command
const queryMessages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.resume.command');

export class BulkQueryReport extends SfCommand<unknown> {
  public static readonly summary = reportMessages.getMessage('summary');
  public static readonly description = reportMessages.getMessage('description');
  public static readonly examples = reportMessages.getMessages('examples');
  public static readonly aliases = ['force:data:soql:bulk:report'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    'target-org': { ...optionalOrgFlagWithDeprecations, summary: queryMessages.getMessage('flags.targetOrg.summary') },
    'api-version': orgApiVersionFlagWithDeprecations,
    loglevel,
    'result-format': resultFormatFlag,
    'bulk-query-id': Flags.salesforceId({
      length: 18,
      char: 'i',
      startsWith: '750',
      summary: reportMessages.getMessage('flags.bulkQueryId.summary'),
      aliases: ['bulkqueryid'],
      exactlyOne: ['bulk-query-id', 'use-most-recent'],
      deprecateAliases: true,
    }),
    'use-most-recent': Flags.boolean({
      summary: reportMessages.getMessage('flags.useMostRecent.summary'),
      exactlyOne: ['bulk-query-id', 'use-most-recent'],
    }),
  };

  public async run(): Promise<unknown> {
    const [{ flags }, cache] = await Promise.all([this.parse(BulkQueryReport), BulkQueryRequestCache.create()]);
    const resumeOptions = await cache.resolveResumeOptionsFromCache(
      flags['bulk-query-id'],
      flags['use-most-recent'],
      flags['target-org'],
      flags['api-version']
    );
    const job = new QueryJobV2(resumeOptions.options.connection, {
      id: resumeOptions.jobInfo.id,
      pollingOptions: getNonZeroTimeoutPollingOptions(resumeOptions.options.pollingOptions),
    });
    await job.poll();
    const results = await job.result();
    const queryResult = transformBulkResults((await results.toArray()) as jsforceRecord[], resumeOptions.options.query);

    if (!this.jsonEnabled()) {
      displayResults({ ...queryResult }, flags['result-format']);
    }

    if (queryResult.result.done) {
      await BulkQueryRequestCache.unset(resumeOptions.jobInfo.id);
    }

    return queryResult.result;
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
