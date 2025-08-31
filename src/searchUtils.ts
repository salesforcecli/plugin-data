/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
