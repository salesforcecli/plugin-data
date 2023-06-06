/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '@salesforce/core';
import { QueryJobV2 } from 'jsforce/lib/api/bulk';
import {
  Flags,
  loglevel,
  optionalOrgFlagWithDeprecations,
  orgApiVersionFlagWithDeprecations,
  SfCommand,
} from '@salesforce/sf-plugins-core';
import { resultFormatFlag } from '../../../flags';
import { displayResults, transformBulkResults } from '../../../queryUtils';
import { FormatTypes } from '../../../reporters';
import { BulkQueryRequestCache } from '../../../bulkDataRequestCache';

Messages.importMessagesDirectory(__dirname);
const reportMessages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.report');
// needed by the flags loaded from the other command
const queryMessages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

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
      summary: reportMessages.getMessage('flags.bulkQueryId'),
      aliases: ['bulkqueryid'],
      deprecateAliases: true,
    }),
    'use-most-recent': Flags.boolean({
      summary: reportMessages.getMessage('flags.useMostRecent.summary'),
      exclusive: ['bulk-query-id'],
    }),
  };

  public async run(): Promise<unknown> {
    const { flags } = await this.parse(BulkQueryReport);
    const cache = await BulkQueryRequestCache.create();
    const resumeOptions = await cache.resolveResumeOptionsFromCache(
      flags['bulk-query-id'],
      flags['use-most-recent'],
      flags['target-org'],
      flags['api-version']
    );
    const job = new QueryJobV2({ ...resumeOptions.options, operation: 'query' });
    job.jobInfo = resumeOptions.jobInfo;
    const results = await job.getResults();
    const queryResult = transformBulkResults(results, '');

    if (!this.jsonEnabled()) {
      displayResults({ ...queryResult }, flags['result-format'] as FormatTypes);
    }

    if (queryResult.result.done) {
      await BulkQueryRequestCache.unset(resumeOptions.jobInfo.id);
    }

    return queryResult.result;
  }
}
