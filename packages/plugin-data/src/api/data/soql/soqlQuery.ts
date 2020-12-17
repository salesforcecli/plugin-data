/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { QueryResult } from 'jsforce';
import { Connection, Logger } from '@salesforce/core';
import { Tooling } from '@salesforce/core/lib/connection';
import { Field, retrieveColumns } from './queryFields';

/**
 * Type to define SoqlQuery results
 */
export type SoqlQueryResult = {
  query: string;
  result: QueryResult<unknown>;
  columns: Field[];
};

/**
 * Class to handle a soql query
 *
 * Will collect all records and the column metadata of the query
 */
export class SoqlQuery {
  public constructor(
    private readonly connection: Connection | Tooling,
    private readonly query: string,
    private readonly logger: Logger
  ) {
    this.logger = logger.child('soqlQuery');
  }

  public async runSoqlQuery(): Promise<SoqlQueryResult> {
    let columns: Field[] = [];
    this.logger.debug('running query');

    const result = await this.connection.autoFetchQuery(this.query, { autoFetch: true, maxFetch: 50000 });
    this.logger.debug(`Query complete with ${result.totalSize} records returned`);
    if (result.totalSize) {
      this.logger.debug('fetching columns for query');
      columns = await retrieveColumns(this.connection, this.query);
    }

    // remove nextRecordsUrl and force done to true
    delete result.nextRecordsUrl;
    result.done = true;
    return {
      query: this.query,
      columns,
      result,
    };
  }
}
