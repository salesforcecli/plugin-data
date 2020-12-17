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
 * Type to define SoqlQuert results
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
    // the new way - autofetch, but not working right now for some reason
    const result = await this.connection.autoFetchQuery(this.query, { autoFetch: true, maxFetch: 50000 });
    this.logger.debug(`Query complete with ${result.totalSize} records returned`);
    if (result.totalSize) {
      this.logger.debug('fetching columns for query');
      columns = await retrieveColumns(this.connection, this.query);
    }
    // old way
    // const result = await this.connection.query(this.query);
    // if (result.totalSize) {
    //   this.logger.debug('fetching columns for query');
    //   columns = await retrieveColumns(this.connection, this.query);
    //
    //   // get all result batches
    //   let moreResults: QueryResult<unknown> = result;
    //   this.logger.debug(`Result has queryMore ${!moreResults.done}`);
    //   while (!moreResults.done) {
    //     if (moreResults.nextRecordsUrl) {
    //       moreResults = await this.connection.queryMore(moreResults.nextRecordsUrl);
    //       if (moreResults.records) {
    //         result.records = result.records.concat(moreResults.records);
    //       } else {
    //         throw new SfdxError('query more is missing records');
    //       }
    //     } else {
    //       throw new SfdxError('query more URL is missing');
    //     }
    //     this.logger.debug(`Result has queryMore ${!moreResults.done}`);
    //   }
    //   if (!result.records) {
    //     throw new SfdxError('query more is missing records');
    //   }
    // }

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
