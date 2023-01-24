/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Record } from 'jsforce';
import { Field, FieldType, SoqlQueryResult } from './dataSoqlQueryTypes';
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

