/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'os';
import { Logger, Messages } from '@salesforce/core';
import { UX } from '@salesforce/command';
import * as chalk from 'chalk';
import { Field, FunctionField, SubqueryField } from '@salesforce/data';
import { upperFirst } from '@salesforce/kit';
import { DataSoqlQueryResult } from './dataSoqlQueryTypes';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

export class Reporter {
  protected ux: UX;
  protected logger: Logger;

  public constructor(ux: UX, logger: Logger) {
    this.ux = ux;
    this.logger = logger.child('reporter');
  }

  public log(...args: string[]): void {
    this.ux.log(...args);
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

type ParsedFields = {
  attributeNames: string[];
  children: string[];
  aggregates: FunctionField[];
};

type ColumnAttributes = {
  key: string;
  label: string;
};

export class HumanReporter extends QueryReporter {
  public constructor(data: DataSoqlQueryResult, columns: Field[], ux: UX, logger: Logger) {
    super(data, columns, ux, logger);
  }

  public display(): void {
    const { attributeNames, children, aggregates } = this.parseFields();
    const totalCount = this.data.result.records.length;
    this.soqlQuery(attributeNames, this.massageRows(this.data.result.records, children, aggregates), totalCount);
  }

  private parseFields(): ParsedFields {
    const fields = this.columns;
    // Field names
    const attributeNames: string[] = [];

    // For subqueries. Display the children under the parents
    const children: string[] = [];

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
      this.logger.info(`No fields found for query "${this.data.query}"`);
    }

    return { attributeNames, children, aggregates };
  }

  private soqlQuery(columns: string[], records: object[], totalCount: number): void {
    this.prepNullValues(records);
    this.log(chalk.bold(this.data.query));
    this.ux.table(records, { columns: this.prepColumns(columns) });
    this.log(chalk.bold(messages.getMessage('displayQueryRecordsRetrieved', [totalCount])));
  }

  private prepNullValues(records: object[]): void {
    records.forEach((record): void => {
      Reflect.ownKeys(record).forEach((propertyKey) => {
        const value = Reflect.get(record, propertyKey);
        if (value === null) {
          Reflect.set(record, propertyKey, chalk.bold('null'));
        } else if (typeof value === 'object') {
          this.prepNullValues([value]);
        }
      });
    });
  }

  private prepColumns(columns: string[]): ColumnAttributes[] {
    return columns.map(
      (field: string): ColumnAttributes => ({
        key: field,
        label: field
          .replace(/([A-Z])/g, ' $1')
          .split(/\s+/)
          .filter((s) => s && s.length > 0)
          .map((s) => upperFirst())
          .join(' '),
      })
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
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
              Reflect.set(result, aggregate.name, Reflect.get(result, `expr${i}`));
            }
          }
        }

        if (children.length > 0) {
          const childrenRows = Object.assign({});
          children.forEach((child) => {
            Reflect.set(childrenRows, child, Reflect.get(result, child));
            Reflect.deleteProperty(result, child);
          });

          Reflect.ownKeys(childrenRows).forEach((child) => {
            if (childrenRows[child]) {
              childrenRows[child].records.forEach((record: any) => {
                const newRecord = Object.assign({});
                Object.entries(record).forEach(([key, value]) => {
                  Reflect.defineProperty(newRecord, `${child.toString()}.${key}`, { value });
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
/* eslint-enable @typescript-eslint/no-explicit-any */

const SEPARATOR = ',';
const DOUBLE_QUOTE = '"';
const SHOULD_QUOTE_REGEXP = new RegExp(`[${SEPARATOR}${DOUBLE_QUOTE}${EOL}]`);

export class CsvReporter extends QueryReporter {
  public constructor(data: DataSoqlQueryResult, columns: Field[], ux: UX, logger: Logger) {
    super(data, columns, ux, logger);
  }

  /**
   * Escape a value to be placed in a CSV row. We follow rfc 4180
   * https://tools.ietf.org/html/rfc4180#section-2 and will not surround the
   * value in quotes if it doesn't contain the separator, double quote, or EOL.
   *
   * @param value The escaped value
   */
  public escape(value: string): string {
    if (value && SHOULD_QUOTE_REGEXP.test(value)) {
      return `"${value.replace(/"/gi, '""')}"`;
    }
    return value;
  }

  public display(): void {
    const fields = this.columns;
    const hasSubqueries = fields.some((field) => field instanceof SubqueryField);
    const hasFunctions = fields.some((field) => field instanceof FunctionField);

    let attributeNames: string[] = [];

    if (fields) {
      this.logger.info(`Found fields ${JSON.stringify(fields.map((field) => `${typeof field}.${field.name}`))}`);
    } else {
      this.logger.info(`No fields found for query "${this.data.query}"`);
    }

    if (hasSubqueries || hasFunctions) {
      // If there are subqueries, we need to get the max child length for each subquery.
      const typeLengths = new Map<string, number>();
      // For function fields, like avg(total).
      const aggregates: FunctionField[] = [];

      fields.forEach((field) => {
        if (field instanceof SubqueryField) {
          typeLengths.set(field.name, 0);
        }
        if (field instanceof FunctionField) {
          aggregates.push(field);
        }
      });

      // Get max lengths by iterating over the records once
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      this.data.result.records.forEach((result: any) => {
        [...typeLengths.keys()].forEach((key) => {
          const record = Reflect.get(result, key);
          if (record?.totalSize > (typeLengths.get(key) ?? 0)) {
            typeLengths.set(key, record.totalSize);
          }
        });

        // Aggregates are soql functions that aggregate data, like "SELECT avg(total)" and
        // are returned in the data as exprX. Aggregates can have aliases, like "avg(total) totalAverage"
        // and are returned in the data as the alias.
        if (aggregates.length > 0) {
          for (let i = 0; i < aggregates.length; i++) {
            const aggregate = aggregates[i];
            if (!aggregate.alias) {
              Reflect.set(result, aggregate.name, Reflect.get(result, `expr${i}`));
            }
          }
        }
      });

      fields.forEach((field) => {
        if (typeLengths.get(field.name)) {
          for (let i = 0; i < (typeLengths.get(field.name) ?? 0); i++) {
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

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    this.data.result.records.forEach((row: any) => {
      const values = attributeNames.map((name) => {
        return this.escape(Reflect.get(row, name));
      });
      this.log(values.join(SEPARATOR));
    });
  }
}

export class JsonReporter extends QueryReporter {
  public constructor(data: DataSoqlQueryResult, columns: Field[], ux: UX, logger: Logger) {
    super(data, columns, ux, logger);
  }

  public log(): void {
    return;
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
