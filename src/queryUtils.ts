/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Record } from '@jsforce/jsforce-node';
import { Field, FieldType, SoqlQueryResult } from './types.js';
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

/**
 * transforms Bulk 2.0 results to match the SOQL query results
 *
 * @param results results object
 * @param query query string
 */
export const transformBulkResults = (results: Record[], query: string): SoqlQueryResult => {
  /*
    bulk queries return a different payload, it's a [{column: data}, {column: data}]
    so we just need to grab the first object, find the keys (columns) and create the columns
     */
  const columns: Field[] = Object.keys(results[0] ?? {}).map((name) => ({
    fieldType: FieldType.field,
    name,
  }));

  return {
    columns,
    result: { done: true, records: results, totalSize: results.length },
    query,
  };
};
