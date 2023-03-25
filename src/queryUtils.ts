/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SoqlQueryResult } from './dataSoqlQueryTypes';
import { CsvReporter, FormatTypes, HumanReporter, JsonReporter } from './reporters';

export const displayResults = (queryResult: SoqlQueryResult, resultFormat: FormatTypes): void => {
  let reporter: HumanReporter | JsonReporter | CsvReporter;
  switch (resultFormat) {
    case 'human':
      reporter = new HumanReporter(queryResult, queryResult.columns);
      break;
    case 'json':
      reporter = new JsonReporter(queryResult, queryResult.columns);
      break;
    case 'csv':
      reporter = new CsvReporter(queryResult, queryResult.columns);
      break;
  }
  // delegate to selected reporter
  reporter.display();
};
