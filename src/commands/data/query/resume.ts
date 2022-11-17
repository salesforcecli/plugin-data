/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '@salesforce/core';
import { QueryJobV2 } from 'jsforce/lib/api/bulk';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { orgFlags } from '../../../flags';
import { DataSoqlQueryCommand, displayResults, transformBulkResults } from '../query';
import { FormatTypes } from '../../../reporters';

Messages.importMessagesDirectory(__dirname);
const reportMessages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.report');
// needed by the flags loaded from the other command
Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

export class BulkQueryReport extends SfCommand<unknown> {
  public static readonly summary = reportMessages.getMessage('summary');
  public static readonly description = reportMessages.getMessage('description');
  public static readonly examples = reportMessages.getMessages('examples');
  public static readonly aliases = ['force:data:soql:bulk:report'];

  public static flags = {
    ...orgFlags,
    'result-format': DataSoqlQueryCommand.flags['result-format'],
    'bulk-query-id': Flags.salesforceId({
      char: 'i',
      required: true,
      startsWith: '750',
      summary: reportMessages.getMessage('flags.bulkQueryId'),
      aliases: ['bulkqueryid'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<unknown> {
    const { flags } = await this.parse(BulkQueryReport);
    const job = new QueryJobV2({
      operation: 'query',
      pollingOptions: { pollTimeout: 0, pollInterval: 0 },
      query: '',
      connection: flags['target-org'].getConnection(flags['api-version']),
    });
    job.jobInfo = { id: flags['bulk-query-id'] };
    const results = await job.getResults();
    const queryResult = transformBulkResults(results, '');

    if (!this.jsonEnabled()) {
      displayResults({ ...queryResult }, flags['result-format'] as keyof typeof FormatTypes);
    }
    return queryResult.result;
  }
}
