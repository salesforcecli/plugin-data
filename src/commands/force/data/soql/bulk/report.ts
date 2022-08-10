/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { flags, FlagsConfig } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { QueryJobV2 } from 'jsforce/lib/api/bulk';
import { DataSoqlQueryCommand, SoqlQuery } from '../query';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.report');

export class BulkQueryReport extends DataSoqlQueryCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly requiresUsername = true;
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    bulkqueryid: flags.string({
      char: 'i',
      required: true,
      description: messages.getMessage('bulkQueryIdDescription'),
    }),
    resultformat: DataSoqlQueryCommand.flagsConfig.resultformat,
  };

  public async run(): Promise<unknown> {
    const job = new QueryJobV2({
      operation: 'query',
      pollingOptions: { pollTimeout: 0, pollInterval: 0 },
      query: '',
      connection: this.org!.getConnection(),
    });
    job.jobInfo = { id: this.flags.bulkqueryid as string };
    const results = await job.getResults();
    const soqlQuery = new SoqlQuery();
    const queryResult = soqlQuery.transformBulkResults(results, '');

    this.displayResults({ ...queryResult });
    return queryResult.result;
  }
}
