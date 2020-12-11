/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseConnection, QueryResult } from 'jsforce';
import { Logger, Messages, SfdxError } from '@salesforce/core';
import { ensureJsonArray, ensureJsonMap, ensureString, isJsonArray, toJsonMap } from '@salesforce/ts-types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/data', 'soql');

export type QueryOptions = {
  connection: BaseConnection;
  query: string;
  logger?: Logger;
};

export type SoqlQueryResult = {
  query: string;
  result: QueryResult<unknown>;
  columns: Field[];
};

export class Field {
  public name: string;

  public constructor(name: string) {
    this.name = name;
  }
}

export class SubqueryField extends Field {
  public fields: Field[] = [];
}

export class FunctionField extends Field {
  public alias: string | undefined;
}

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
    const result = await this.connection.query(this.query);

    if (result.records && result.records.length > 0) {
      this.logger.debug('fetching columns for query');
      columns = await this.retrieveColumns();

      // get all result batches
      let moreResults: QueryResult<unknown> = result;
      this.logger.debug(`Result has queryMore ${!moreResults.done}`);
      while (!moreResults.done) {
        // TODO: emit message for query more
        if (moreResults.nextRecordsUrl) {
          moreResults = await this.connection.queryMore(moreResults.nextRecordsUrl);
          if (moreResults.records) {
            result.records = result.records.concat(moreResults.records);
          } else {
            throw new SfdxError(messages.getMessage('queryMoreMissingRecords'));
          }
        } else {
          throw new SfdxError(messages.getMessage('queryMoreMissingUrl'));
        }
        this.logger.debug(`Result has queryMore ${!moreResults.done}`);
      }
      if (!result.records) {
        throw new SfdxError(messages.getMessage('queryMoreMissingRecords'));
      }
    }
    // Clean result for consumer
    delete result.nextRecordsUrl;
    result.done = true;

    return {
      query: this.query,
      columns,
      result,
    };
  }
  private getBaseUrl(): string {
    // eslint-disable-next-line no-underscore-dangle
    return this.connection._baseUrl();
  }

  private async retrieveColumns(): Promise<Field[]> {
    const columnUrl = `${this.getBaseUrl()}/query?q=${encodeURIComponent(this.query)}&columns=true`;
    const results = toJsonMap(await this.connection.request(columnUrl));
    const columns: Field[] = [];
    for (let column of ensureJsonArray(results.columnMetadata)) {
      column = ensureJsonMap(column);
      const name = ensureString(column.columnName);

      if (isJsonArray(column.joinColumns) && column.joinColumns.length > 0) {
        if (column.aggregate) {
          const field = new SubqueryField(name);
          for (const subcolumn of column.joinColumns) {
            field.fields.push(new Field(ensureString(ensureJsonMap(subcolumn).columnName)));
          }
          columns.push(field);
        } else {
          for (const subcolumn of column.joinColumns) {
            columns.push(new Field(`${name}.${ensureString(ensureJsonMap(subcolumn).columnName)}`));
          }
        }
      } else if (column.aggregate) {
        const field = new FunctionField(ensureString(column.displayName));
        // If it isn't an alias, skip so the display name is used when messaging rows
        if (!/expr[0-9]+/.test(name)) {
          field.alias = name;
        }
        columns.push(field);
      } else {
        columns.push(new Field(name));
      }
    }
    return columns;
  }
}
