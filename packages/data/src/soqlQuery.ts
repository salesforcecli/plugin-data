/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseConnection, QueryResult } from 'jsforce';
import { Logger, SfdxError } from '@salesforce/core';
import { Field, retrieveColumns } from './queryFields';

/**
 * Type to define expected parameters to SoqlQuery constructor
 */
export type QueryOptions = {
  connection: BaseConnection;
  query: string;
  logger?: Logger;
};

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
  private readonly query: string;
  private readonly connection: BaseConnection;
  private logger: Logger;
  public constructor(options: QueryOptions) {
    this.query = options.query;
    this.connection = options.connection;
    this.logger = options.logger ? options.logger.child('soqlQuery') : Logger.childFromRoot('soqlQuery');
  }

  public async runSoqlQuery(): Promise<SoqlQueryResult> {
    let columns: Field[] = [];
    this.logger.debug('running query');
    // the new way - autofetch, but not working right now for some reason
    // const records = [];
    // const result = await this.connection
    //   .query(this.query, { autoFetch: true, maxFetch: 10000 })
    //   .on('record', function (record) {
    //     records.push(record);
    //   })
    //   // eslint-disable-next-line @typescript-eslint/no-empty-function
    //   .on('end', function () {})
    //   .on('error', function (err) {
    //     throw new SfdxError(err.message ?? err);
    //   });
    // this.logger.debug(`Query complete with ${result.totalSize} records returned`);
    // if (result.totalSize) {
    //   this.logger.debug('fetching columns for query');
    //   columns = await retrieveColumns(this.connection, this.query);
    // }
    // old way
    const result = await this.connection.query(this.query);
    if (result.totalSize) {
      this.logger.debug('fetching columns for query');
      columns = await retrieveColumns(this.connection, this.query);

      // get all result batches
      let moreResults: QueryResult<unknown> = result;
      this.logger.debug(`Result has queryMore ${!moreResults.done}`);
      while (!moreResults.done) {
        if (moreResults.nextRecordsUrl) {
          moreResults = await this.connection.queryMore(moreResults.nextRecordsUrl);
          if (moreResults.records) {
            result.records = result.records.concat(moreResults.records);
          } else {
            throw new SfdxError('query more is missing records');
          }
        } else {
          throw new SfdxError('query more URL is missing');
        }
        this.logger.debug(`Result has queryMore ${!moreResults.done}`);
      }
      if (!result.records) {
        throw new SfdxError('query more is missing records');
      }
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
