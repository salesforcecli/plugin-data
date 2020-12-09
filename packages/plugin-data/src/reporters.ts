/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as util from 'util';
import { EOL } from 'os';
import { Dictionary, ensureJsonArray, ensureJsonMap, ensureString, isJsonArray, toJsonMap } from '@salesforce/ts-types';
import { Logger, Messages } from '@salesforce/core';
import * as lodash from 'lodash';
import { Connection } from 'jsforce';
import * as _ from 'lodash';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

const logger = Logger.childFromRoot('reporters');

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

export class Reporter {
  // TODO: proper property typing
  [property: string]: any;
  protected static Types: Dictionary<any>;

  protected context: any;
  protected logger: Logger;
  protected streams: any[];
  protected operations: [];

  public constructor(context?: any) {
    this.context = context;
    this.logger = context?.logger || Logger.child('reporter');
    this.streams = [];
    this.operations = [];
  }

  /**
   * We must pipe stdout to the stream while this reporter lives because
   * there are several calls to logger (like table) which does a lot of logic
   * before writing directly to stdout.
   */
  public addStream(stream: any): void {
    if (stream) {
      this.streams.push(stream);
    }
  }

  public log(msg?: string): void {
    this.logger.info(msg);
    this.logToStreams(msg ?? '');
  }

  public logToStreams(msg: string): void {
    this.streams.forEach((stream: any) => stream.write(`${msg}\n`));
  }

  /**
   * Log some test information to the console, but only log when json is not
   * specified. Otherwise the only output should be in json format which will
   * print to the console when the command returns on the command handler.
   *
   * @param {string} header The header for the table OR a string if no table
   * (object) is specified.
   * @param {object|array} data The data to display in the table. Data will be
   * converted to an array if an object is passed in.
   * @param {array} columns An array of column information, such as key, label,
   * and formatter.
   */
  public logTable(header: any, data: any, columns: any): void {
    let rows = data;

    // Tables require arrays, so convert objects to arrays
    if (util.isObject(data) && !util.isArray(data)) {
      rows = [];
      Object.keys(data).forEach((key) => {
        // Turn keys into titles; i.e. testRunId to Test Run Id
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const title = lodash.map(lodash.kebabCase(key).split('-'), lodash.capitalize).join(' ');
        rows.push({ key: title, value: `${data[key]} ` });
      });
    }

    this.log(`=== ${this.context.ux.color.blue(header)}`);
    this.context.ux.table(rows, {
      columns,
      printLine: (...args: string[]) => {
        this.log(...args);
      },
    });
    this.log('');
  }

  public onStart(data?: any): void {
    // noop
  }

  /**
   * Does this Reporter need progress information.
   */
  public get progressRequired(): boolean {
    return typeof this.onProgress === 'function';
  }

  /**
   * Determine if this is a specific Reporter type instance.
   *
   * @param {class} type The type of Reporter to check if this is an instanceof.
   */
  public isType(type: any): boolean {
    return this instanceof type;
  }

  /**
   * The function to call when the command has finished.
   *
   * @param {Object} results The completed results
   */
  // Adding data here so prevent typescript errors when including data
  // in onFinished.
  public onFinished(data?: any): Promise<void> {
    // eslint-disable-line no-unused-vars
    this.streams.forEach((stream: any) => stream.close());

    let promise = Promise.resolve();

    this.operations.forEach((op: any) => {
      promise = promise.then(() => op);
    });
    return promise;
  }

  /**
   * The type of output this reporter produces, like the file format which
   * makes this useful for file extensions.
   * i.e. xml, json, txt, etc.
   *
   * This method must be implemented.
   *
   * @param {Object} results The completed results
   */
  public getFormat(): any {
    throw new Error('NOT IMPLEMENTED');
  }

  public emit(event: any, data: any): Promise<void> {
    const funcName = `on${lodash.capitalize(event)}`;
    if (lodash.isFunction(this[funcName])) {
      return this[funcName](data);
    }
    return Promise.resolve();
  }
}

export class QueryReporter extends Reporter {
  public columns: Field[] = [];

  public constructor(protected conn: Connection, protected query: string, context?: any) {
    super(context);
  }

  public getBaseUrl(): string {
    // eslint-disable-next-line no-underscore-dangle
    return this.conn._baseUrl();
  }

  public async retrieveColumns(): Promise<Field[]> {
    const columnUrl = `${this.getBaseUrl()}/query?q=${encodeURIComponent(this.query)}&columns=true`;
    const results = toJsonMap(await this.conn.request(columnUrl));
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
}

export class HumanReporter extends QueryReporter {
  public constructor(protected conn: Connection, protected query: string, context?: any) {
    super(conn, query, context);
  }

  public parseFields(): any {
    const fields = this.columns;
    // Field names
    const attributeNames: string[] = [];

    // For subqueries. Display the children under the parents
    const children: unknown[] = [];

    // For function fields, like avg(total).
    const aggregates: FunctionField[] = [];

    if (fields) {
      logger.info(`Found fields ${JSON.stringify(fields.map((field) => `${typeof field}.${field.name}`))}`);

      fields.forEach((field) => {
        if (field instanceof SubqueryField) {
          children.push(field.name);
          field.fields.forEach((subfield) => attributeNames.push(`${field.name}.${subfield.name}`));
        } else if (field instanceof FunctionField) {
          if (field.alias) {
            attributeNames.push(field.alias);
          } else {
            attributeNames.push(field.name);
          }
          aggregates.push(field);
        } else {
          attributeNames.push(field.name);
        }
      });
    } else {
      logger.info(`No fields found for query "${this.query}"`);
    }

    return { attributeNames, children, aggregates };
  }

  public onFinished(queryResults: any): Promise<void> {
    const { attributeNames, children, aggregates } = this.parseFields();
    const totalCount = queryResults.length;

    this.display(attributeNames, this.massageRows(queryResults, children, aggregates), totalCount);

    return super.onFinished(queryResults);
  }

  public display(attributeNames: string[], queryResults: any, totalCount: number): void {
    this.soqlQuery(attributeNames, queryResults, totalCount);
  }

  public getFormat(): string {
    return 'txt';
  }

  private soqlQuery(columns: string[], records: Array<Record<string, any>>, totalCount: number): void {
    this.prepNullValues(records);
    this.context.ux.table(records, { columns });
    logger.info(this.context.color.bold(messages.getMessage('displayQueryRecordsRetrieved', [totalCount])));
  }

  private prepNullValues(records: Array<Record<string, any>>): void {
    records.forEach((record: Record<string, any>): void => {
      for (const propertyKey in record) {
        if (Reflect.has(record, propertyKey)) {
          if (record[propertyKey] === null) {
            record[propertyKey] = this.context.color.bold('null');
          } else if (typeof record[propertyKey] === 'object') {
            this.prepNullValues([record[propertyKey]]);
          }
        }
      }
    });
  }

  private massageRows(queryResults: any[], children: any[], aggregates: FunctionField[]): any {
    // There are subqueries or aggregates. Massage the data.
    if (children.length > 0 || aggregates.length > 0) {
      queryResults = queryResults.reduce((newResults, result) => {
        newResults.push(result);

        // Aggregates are soql functions that aggregate data, like "SELECT avg(total)" and
        // are returned in the data as exprX. Aggregates can have aliases, like "avg(total) totalAverage"
        // and are returned in the data as the alias.
        if (aggregates.length > 0) {
          for (let i = 0; i < aggregates.length; i++) {
            const aggregate = aggregates[i];
            if (!aggregate.alias) {
              result[aggregate.name] = result[`expr${i}`];
            }
          }
        }

        if (children.length > 0) {
          const childrenRows = Object.assign({});
          children.forEach((child) => {
            childrenRows[child] = result[child];
            delete result[child];
          });

          Reflect.ownKeys(childrenRows).forEach((child) => {
            if (childrenRows[child]) {
              childrenRows[child].records.forEach((record: any) => {
                const newRecord = Object.assign({});
                _.each(record, (value, key) => {
                  newRecord[`${child.toString()}.${key}`] = value;
                });
                newResults.push(newRecord);
              });
            }
          });
        }
        return newResults;
      }, []);
    }
    return queryResults;
  }
}

const SEPARATOR = ',';
const DOUBLE_QUOTE = '"';
const SHOULD_QUOTE_REGEXP = new RegExp(`[${SEPARATOR}${DOUBLE_QUOTE}${EOL}]`);

export class CsvReporter extends QueryReporter {
  public constructor(protected conn: Connection, protected query: string, context?: any) {
    super(conn, query, context);
  }

  /**
   * Escape a value to be placed in a CSV row. We follow rfc 4180
   * https://tools.ietf.org/html/rfc4180#section-2 and will not surround the
   * value in quotes if it doesn't contain the separator, double quote, or EOL.
   *
   * @param value The escaped value
   */
  public escape(value: any): any {
    if (value && _.isFunction(value.match) && value.match(SHOULD_QUOTE_REGEXP)) {
      return `"${value.replace(/"/gi, '""')}"`;
    }
    return value;
  }

  public onFinished(queryResults: any): Promise<void> {
    const fields = this.columns;
    const hasSubqueries = _.some(fields, (field) => field instanceof SubqueryField);
    const hasFunctions = _.some(fields, (field) => field instanceof FunctionField);

    let attributeNames: string[] = [];

    if (fields) {
      logger.info(`Found fields ${JSON.stringify(fields.map((field) => `${typeof field}.${field.name}`))}`);
    } else {
      logger.info(`No fields found for query "${this.query}"`);
    }

    if (hasSubqueries || hasFunctions) {
      // If there are subqueries, we need to get the max child length for each subquery.
      const typeLengths = Object.assign({});
      // For function fields, like avg(total).
      const aggregates: any[] = [];

      fields.forEach((field) => {
        if (field instanceof SubqueryField) {
          typeLengths[field.name] = 0;
        }
        if (field instanceof FunctionField) {
          aggregates.push(field);
        }
      });

      // Get max lengths by iterating over the records once
      queryResults.forEach((result: any) => {
        Reflect.ownKeys(typeLengths).forEach((key) => {
          if (result[key] && result[key].totalSize > typeLengths[key]) {
            typeLengths[key] = result[key].totalSize;
          }
        });

        // Aggregates are soql functions that aggregate data, like "SELECT avg(total)" and
        // are returned in the data as exprX. Aggregates can have aliases, like "avg(total) totalAverage"
        // and are returned in the data as the alias.
        if (aggregates.length > 0) {
          for (let i = 0; i < aggregates.length; i++) {
            const aggregate = aggregates[i];
            if (!aggregate.alias) {
              result[aggregate.name] = result[`expr${i}`];
            }
          }
        }
      });

      fields.forEach((field) => {
        if (typeLengths[field.name]) {
          for (let i = 0; i < typeLengths[field.name]; i++) {
            attributeNames.push(`${field.name}.totalSize`);
            (field as SubqueryField).fields.forEach((subfield) => {
              attributeNames.push(`${field.name}.records.${i}.${subfield.name}`);
            });
          }
        } else if (field instanceof FunctionField) {
          if (field.alias) {
            attributeNames.push(field.alias);
          } else {
            attributeNames.push(field.name);
          }
        } else {
          attributeNames.push(field.name);
        }
      });
    } else {
      attributeNames = fields.map((field) => field.name);
    }

    this.log(
      attributeNames
        .map((name) => {
          return this.escape(name);
        })
        .join(SEPARATOR)
    );

    queryResults.forEach((row: any) => {
      const values = attributeNames.map((name) => {
        return this.escape(_.get(row, name));
      });
      this.log(values.join(SEPARATOR));
    });

    return super.onFinished(queryResults);
  }

  public getFormat(): string {
    return 'csv';
  }
}

export class JsonReporter extends QueryReporter {
  public constructor(protected conn: Connection, protected query: string, context?: any) {
    super(conn, query, context);
  }

  public onFinished(queryResults: unknown): any {
    // We can only log to streams because the CLI process logs the json to stdout.
    this.logToStreams(JSON.stringify(queryResults));
    return super.onFinished(queryResults);
  }

  public log(msg: string): void {
    return;
  }

  public logTable(header: any, data: any, columns: any): void {
    return;
  }

  public getFormat(): string {
    return 'json';
  }
}

/**
 * A list of the accepted reporter types
 */
export const FormatTypes = {
  human: HumanReporter,
  csv: CsvReporter,
  json: JsonReporter,
};
