/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SoqlQueryResult } from './types.js';
import { FormatTypes, JsonReporter } from './reporters/query/reporters.js';
import { CsvReporter } from './reporters/query/csvReporter.js';
import { HumanReporter } from './reporters/query/humanReporter.js';

export const displayResults = (queryResult: SoqlQueryResult, resultFormat: FormatTypes, outputFile?: string): void => {
  let reporter: HumanReporter | JsonReporter | CsvReporter;
  switch (resultFormat) {
    case 'human':
      reporter = new HumanReporter(queryResult, queryResult.columns);
      break;
    case 'json':
      reporter = new JsonReporter(queryResult, queryResult.columns, outputFile);
      break;
    case 'csv':
      reporter = new CsvReporter(queryResult, queryResult.columns, outputFile);
      break;
  }
  // delegate to selected reporter
  reporter.display();
};
