/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SearchResult } from '@jsforce/jsforce-node';
import { HumanSearchReporter } from './reporters/search/humanSearchReporter.js';
import { JsonSearchReporter } from './reporters/search/reporter.js';
import { CsvSearchReporter } from './reporters/search/csvSearchReporter.js';

export const displaySearchResults = (queryResult: SearchResult, resultFormat: 'human' | 'json' | 'csv'): void => {
  let reporter: HumanSearchReporter | JsonSearchReporter | CsvSearchReporter;

  switch (resultFormat) {
    case 'human':
      reporter = new HumanSearchReporter(queryResult);
      break;
    case 'csv':
      reporter = new CsvSearchReporter(queryResult);
      break;
    case 'json':
      reporter = new JsonSearchReporter(queryResult);
      break;
  }
  // delegate to selected reporter
  reporter.display();
};
