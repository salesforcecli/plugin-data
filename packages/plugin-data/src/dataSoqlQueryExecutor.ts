/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseConnection, QueryResult } from 'jsforce';
import { Logger, Messages, SfdxError } from '@salesforce/core';
import { UX } from '@salesforce/command';
import { ensureJsonArray, ensureJsonMap, ensureString, isJsonArray, toJsonMap } from '@salesforce/ts-types';
import { Field, FunctionField, SubqueryField } from './reporters';
import { QueryOptions, SoqlQueryResult } from './commands/force/data/soql/query';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/restrict-template-expressions */
export class DataSoqlQueryExecutor {
  private readonly childLogger: Logger;
  private readonly ux: UX;
  private readonly resultFormat: string;
  private readonly query: string;
  private readonly connection: BaseConnection;
  private readonly json: boolean;
  private columns: Field[];
  public constructor(options: QueryOptions) {
    this.ux = options.ux;
    this.childLogger = options.logger.child('dataSoqlExecutor');
    this.resultFormat = options.resultFormat;
    this.query = options.query;
    this.connection = options.connection;
    this.json = options.json;
    this.columns = [];
  }
  public async execute(): Promise<SoqlQueryResult> {
    const queryResult = await this.runQuery(this.connection, this.query);
    return {
      query: this.query,
      columns: this.columns,
      result: queryResult,
      resultFormat: this.resultFormat,
      json: this.json,
      logger: this.childLogger,
    };
  }

  private async runQuery(conn: BaseConnection, query: string): Promise<QueryResult<unknown>> {
    try {
      this.runIf(this.resultFormat !== 'json', () => this.ux.startSpinner('Running SOQL Query'));
      const result = await this.handleQueryMore(conn, await conn.query(query));
      return result;
    } catch (err) {
      throw new SfdxError(err.message ?? err);
    } finally {
      this.runIf(this.resultFormat !== 'json', () => this.ux.stopSpinner());
    }
  }
  private async handleQueryMore(conn: BaseConnection, result: QueryResult<unknown>): Promise<QueryResult<unknown>> {
    if (result.records && result.records.length > 0) {
      this.childLogger.debug('fetching columns for query');
      await this.retrieveColumns();

      // get all result batches
      let moreResults: QueryResult<unknown> = result;
      this.childLogger.debug(`Result has queryMore ${!moreResults.done}`);
      while (!moreResults.done) {
        if (moreResults.nextRecordsUrl) {
          moreResults = await conn.queryMore(moreResults.nextRecordsUrl);
          if (moreResults.records) {
            result.records = result.records.concat(moreResults.records);
          } else {
            throw Error(messages.getMessage('queryMoreMissingRecords'));
          }
        } else {
          throw Error(messages.getMessage('queryMoreMissingUrl'));
        }
        this.childLogger.debug(`Result has queryMore ${!moreResults.done}`);
      }
      if (!result.records) {
        throw Error(messages.getMessage('queryMoreMissingRecords'));
      }
    }
    // Clean result for consumer
    delete result.nextRecordsUrl;
    result.done = true;
    return result;
  }
  private getBaseUrl(): string {
    // eslint-disable-next-line no-underscore-dangle
    return this.connection._baseUrl();
  }

  private async retrieveColumns(): Promise<Field[]> {
    const columnUrl = `${this.getBaseUrl()}/query?q=${encodeURIComponent(this.query)}&columns=true`;
    const results = toJsonMap(await this.connection.request(columnUrl));
    this.columns = [];
    for (let column of ensureJsonArray(results.columnMetadata)) {
      column = ensureJsonMap(column);
      const name = ensureString(column.columnName);

      if (isJsonArray(column.joinColumns) && column.joinColumns.length > 0) {
        if (column.aggregate) {
          const field = new SubqueryField(name);
          for (const subcolumn of column.joinColumns) {
            field.fields.push(new Field(ensureString(ensureJsonMap(subcolumn).columnName)));
          }
          this.columns.push(field);
        } else {
          for (const subcolumn of column.joinColumns) {
            this.columns.push(new Field(`${name}.${ensureString(ensureJsonMap(subcolumn).columnName)}`));
          }
        }
      } else if (column.aggregate) {
        const field = new FunctionField(ensureString(column.displayName));
        // If it isn't an alias, skip so the display name is used when messaging rows
        if (!/expr[0-9]+/.test(name)) {
          field.alias = name;
        }
        this.columns.push(field);
      } else {
        this.columns.push(new Field(name));
      }
    }
    return this.columns;
  }

  private runIf(condition: boolean, callback: Function): void {
    if (condition) {
      callback();
    }
  }
}
