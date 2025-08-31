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
