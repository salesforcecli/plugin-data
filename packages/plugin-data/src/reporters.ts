/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as util from 'util';
import { EOL } from 'os';
import { Dictionary } from '@salesforce/ts-types';
import { Logger, Messages } from '@salesforce/core';
import * as lodash from 'lodash';
import * as _ from 'lodash';
import { UX } from '@salesforce/command';
import * as chalk from 'chalk';
import { Field, FunctionField, SubqueryField } from '@salesforce/data';
import { salesforceBlue } from './dataCommand';
import { DataSoqlQueryResult } from './dataSoqlQueryTypes';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

export class Reporter {
  // TODO: proper property typing
  [property: string]: any;
  protected static Types: Dictionary<any>;

  protected ux: UX;
  protected logger: Logger;

  public constructor(ux: UX, logger: Logger) {
    this.ux = ux;
    this.logger = logger.child('reporter');
  }

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

    this.ux.log(salesforceBlue(`=== ${header}`));
    this.ux.table(rows, {
      columns,
      printLine: (args: string[]) => {
        this.ux.log(...args);
      },
    });
    this.ux.log('');
  }

  public log(...args: string[]): void {
    this.ux.log(...args);
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
}

export class QueryReporter extends Reporter {
  protected columns: Field[] = [];
  protected data: DataSoqlQueryResult;

  public constructor(data: DataSoqlQueryResult, columns: Field[], ux: UX, logger: Logger) {
    super(ux, logger);
    this.columns = columns;
    this.data = data;
  }
}

export class HumanReporter extends QueryReporter {
  public constructor(data: DataSoqlQueryResult, columns: Field[], ux: UX, logger: Logger) {
    super(data, columns, ux, logger);
  }

  public display(): void {
    const { attributeNames, children, aggregates } = this.parseFields();
    const totalCount = this.data.result.records.length;
    this.soqlQuery(attributeNames, this.massageRows(this.data.result.records, children, aggregates), totalCount);
  }

  public getFormat(): string {
    return 'txt';
  }

  private parseFields(): any {
    const fields = this.columns;
    // Field names
    const attributeNames: string[] = [];

    // For subqueries. Display the children under the parents
    const children: unknown[] = [];

    // For function fields, like avg(total).
    const aggregates: FunctionField[] = [];

    if (fields) {
      this.logger.info(`Found fields ${JSON.stringify(fields.map((field) => `${typeof field}.${field.name}`))}`);

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
      this.logger.info(`No fields found for query "${this.query}"`);
    }

    return { attributeNames, children, aggregates };
  }

  private soqlQuery(columns: string[], records: any[], totalCount: number): void {
    this.prepNullValues(records);
    this.log(chalk.bold(this.data.query));
    this.ux.table(records, { columns: this.prepColumns(columns) });
    this.log(chalk.bold(messages.getMessage('displayQueryRecordsRetrieved', [totalCount])));
  }

  private prepNullValues(records: any[]): void {
    records.forEach((record): void => {
      for (const propertyKey in record) {
        if (Reflect.has(record, propertyKey)) {
          if (record[propertyKey] === null) {
            record[propertyKey] = chalk.bold('null');
          } else if (typeof record[propertyKey] === 'object') {
            this.prepNullValues([record[propertyKey]]);
          }
        }
      }
    });
  }

  private prepColumns(columns: string[]): any[] {
    return columns.map((field) =>
      Object.assign(
        {},
        {
          key: field,
          label: field
            .replace(/([A-Z])/g, ' $1')
            .split(/\s+/)
            .filter((s) => s && s.length > 0)
            .map((s) => _.capitalize(s.trim()))
            .join(' '),
        }
      )
    );
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
  public constructor(data: any, columns: Field[], ux: UX, logger: Logger) {
    super(data, columns, ux, logger);
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

  public display(): void {
    const fields = this.columns;
    const hasSubqueries = _.some(fields, (field) => field instanceof SubqueryField);
    const hasFunctions = _.some(fields, (field) => field instanceof FunctionField);

    let attributeNames: string[] = [];

    if (fields) {
      this.logger.info(`Found fields ${JSON.stringify(fields.map((field) => `${typeof field}.${field.name}`))}`);
    } else {
      this.logger.info(`No fields found for query "${this.query}"`);
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
      this.data.result.records.forEach((result: any) => {
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

    this.data.result.records.forEach((row: any) => {
      const values = attributeNames.map((name) => {
        return this.escape(_.get(row, name));
      });
      this.log(values.join(SEPARATOR));
    });
  }

  public getFormat(): string {
    return 'csv';
  }
}

export class JsonReporter extends QueryReporter {
  public constructor(data: any, columns: Field[], ux: UX, logger: Logger) {
    super(data, columns, ux, logger);
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

  public display(): void {
    this.ux.styledJSON({ status: 0, result: { data: { ...this.data.result } } });
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
