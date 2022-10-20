/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { Messages } from '@salesforce/core';
import { QueryJobV2 } from 'jsforce/lib/api/bulk';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { DataSoqlQueryCommand, displayResults, transformBulkResults } from '../query';
import { FormatTypes } from '../../../../../reporters';

Messages.importMessagesDirectory(__dirname);
const reportMessages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.report');
// needed by the flags loaded from the other command
Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

export class BulkQueryReport extends SfCommand<unknown> {
  public static readonly summary = reportMessages.getMessage('summary');
  public static readonly description = reportMessages.getMessage('description');
  public static readonly examples = reportMessages.getMessage('examples').split(os.EOL);
  public static flags = {
    'target-org': DataSoqlQueryCommand.flags['target-org'],
    resultformat: DataSoqlQueryCommand.flags.resultformat,
    bulkqueryid: Flags.salesforceId({
      char: 'i',
      required: true,
      summary: reportMessages.getMessage('bulkQueryIdDescription'),
    }),
  };

  public async run(): Promise<unknown> {
    const { flags } = await this.parse(BulkQueryReport);
    const job = new QueryJobV2({
      operation: 'query',
      pollingOptions: { pollTimeout: 0, pollInterval: 0 },
      query: '',
      connection: flags['target-org'].getConnection(),
    });
    job.jobInfo = { id: flags.bulkqueryid };
    const results = await job.getResults();
    const queryResult = transformBulkResults(results, '');

    displayResults({ ...queryResult }, flags.resultformat as keyof typeof FormatTypes);
    return queryResult.result;
  }
}
