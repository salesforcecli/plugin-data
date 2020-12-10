/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import * as os from 'os';
import { flags, FlagsConfig, SfdxResult, UX } from '@salesforce/command';
import { Logger, Messages } from '@salesforce/core';
import { BaseConnection, QueryResult } from 'jsforce';
import { asPlainObject, toJsonMap } from '@salesforce/ts-types';
import { DataCommand } from '../../../../dataCommand';
import { DataSoqlQueryExecutor } from '../../../../dataSoqlQueryExecutor';
import { CsvReporter, FormatTypes, HumanReporter, JsonReporter } from '../../../../reporters';
import { Field } from '../../../../reporters';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

export type QueryOptions = {
  connection: BaseConnection;
  query: string;
  ux: UX;
  logger: Logger;
  resultFormat: string;
  json: boolean;
};

export type SoqlQueryResult = {
  query: string;
  result: QueryResult<unknown>;
  columns: Field[];
  resultFormat: string;
  json: boolean;
  logger: Logger;
};

export class DataSoqlQueryCommand extends DataCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly longDescription = messages.getMessage('longDescription');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly examples = messages.getMessage('examples').split(os.EOL);

  public static readonly flagsConfig: FlagsConfig = {
    query: flags.string({
      char: 'q',
      required: true,
      hidden: false,
      description: messages.getMessage('queryToExecute'),
      longDescription: messages.getMessage('queryLongDescription'),
    }),
    usetoolingapi: flags.boolean({
      char: 't',
      required: false,
      hidden: false,
      description: messages.getMessage('queryToolingDescription'),
      longDescription: messages.getMessage('queryToolingLongDescription'),
    }),
    resultformat: flags.enum({
      char: 'r',
      description: messages.getMessage('resultFormatDescription'),
      longDescription: messages.getMessage('resultFormatLongDescription'),
      options: ['human', 'csv', 'json'],
      default: 'human',
    }),
  };

  protected static readonly result: SfdxResult = {
    display(): void {
      const results = asPlainObject(this.data) as SoqlQueryResult;
      let reporter;
      switch (results.resultFormat as keyof typeof FormatTypes) {
        case 'human':
          reporter = new HumanReporter(results, results.columns, this.ux, results.logger);
          break;
        case 'json':
          reporter = new JsonReporter(results, results.columns, this.ux, results.logger);
          break;
        case 'csv':
          reporter = new CsvReporter(results, results.columns, this.ux, results.logger);
          break;
      }
      reporter.display();
    },
  };

  public async run(): Promise<SoqlQueryResult | SfdxResult> {
    try {
      const options: QueryOptions = {
        connection: this.getConnection(),
        logger: this.logger,
        query: this.flags.query,
        // force result format to 'json' if --json true
        resultFormat: this.flags.json ? 'json' : this.flags.resultformat,
        ux: this.ux,
        json: this.flags.json,
      };
      /* hand no results
       *  else if (!(reporter instanceof JsonReporter)) {
      this.childLogger.info(messages.getMessage('queryNoResults'));
    }
       */
      const dataSoqlQueryExecutor = new DataSoqlQueryExecutor(options);
      const results = await dataSoqlQueryExecutor.execute();
      return this.normilizeIfJson(results);
    } finally {
      this.ux.stopSpinner();
    }
  }

  private normilizeIfJson(results: SoqlQueryResult): SoqlQueryResult | SfdxResult {
    if (this.flags.json) {
      return {
        data: toJsonMap(results.result),
      };
    }
    return results;
  }
}
