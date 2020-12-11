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
import { flags, FlagsConfig, SfdxResult } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { asPlainObject, toJsonMap } from '@salesforce/ts-types';
import { DataCommand } from '../../../../dataCommand';
import { CsvReporter, FormatTypes, HumanReporter, JsonReporter } from '../../../../reporters';
import { DataSoqlQueryResult } from '../../../../dataSoqlQueryTypes';
import { SoqlQuery, SoqlQueryResult } from '../../../../soqlQuery';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

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
      const results = asPlainObject(this.data) as DataSoqlQueryResult;
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

  public async run(): Promise<DataSoqlQueryResult | SfdxResult> {
    try {
      /* hand no results
       *  else if (!(reporter instanceof JsonReporter)) {
      this.childLogger.info(messages.getMessage('queryNoResults'));
    }
       */
      this.runIf(this.flags.resultformat !== 'json', () =>
        this.ux.startSpinner(messages.getMessage('queryRunningMessage'))
      );
      const query = new SoqlQuery({ connection: this.getConnection(), query: this.flags.query, logger: this.logger });
      const queryResult: SoqlQueryResult = await query.runSoqlQuery();
      const results = {
        ...queryResult,
        resultFormat: this.flags.resultforma,
        json: this.flags.json,
        logger: this.logger,
      };
      return this.normilizeIfJson(results);
    } finally {
      this.runIf(this.flags.resultformat !== 'json', () => this.ux.stopSpinner());
    }
  }

  private normilizeIfJson(results: DataSoqlQueryResult): DataSoqlQueryResult | SfdxResult {
    if (this.flags.json) {
      return {
        data: toJsonMap(results.result),
      };
    }
    return results;
  }

  private runIf(condition: boolean, callback: Function): void {
    if (condition) {
      callback();
    }
  }
}
