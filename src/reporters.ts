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
import { get, getNumber, isString, Optional } from '@salesforce/ts-types';
import { BasicRecord, Field, FieldType, hasNestedRecords, SoqlQueryResult } from './dataSoqlQueryTypes';

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
  protected data: SoqlQueryResult;

  public constructor(data: SoqlQueryResult, columns: Field[], ux: UX, logger: Logger) {
    super(ux, logger);
    this.columns = columns;
    this.data = data;
  }
}

type ParsedFields = {
  attributeNames: Array<Optional<string>>;
  children: string[];
  aggregates: Field[];
};

type ColumnAttributes = {
  key: string;
  label: string;
};

export class HumanReporter extends QueryReporter {
  public constructor(data: SoqlQueryResult, columns: Field[], ux: UX, logger: Logger) {
    super(data, columns, ux, logger);
  }

  public display(): void {
    const { attributeNames, children, aggregates } = this.parseFields();
    // in case of count() there are no records, but there is a totalSize
    const totalCount = this.data.result.records.length || this.data.result.totalSize;
    this.soqlQuery(attributeNames, this.massageRows(this.data.result.records, children, aggregates), totalCount);
  }

  public parseFields(): ParsedFields {
    const fields = this.columns;
    // Field names
    const attributeNames: string[] = [];

    // For subqueries. Display the children under the parents
    const children: string[] = [];

    // For function fields, like avg(total).
    const aggregates: Field[] = [];

    if (fields) {
      this.logger.info(`Found fields ${JSON.stringify(fields.map((field) => `${typeof field}.${field.name}`))}`);

      fields.forEach((field) => {
        if (field.fieldType === FieldType.subqueryField) {
          children.push(field.name);
          (field.fields ?? []).forEach((subfield) => attributeNames.push(`${field.name}.${subfield.name}`));
        } else if (field.fieldType === FieldType.functionField) {
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

  public soqlQuery(columns: Array<Optional<string>>, records: BasicRecord[], totalCount: number): void {
    this.prepNullValues(records);
    this.ux.table(records, { columns: this.prepColumns(columns) });
    this.log(chalk.bold(messages.getMessage('displayQueryRecordsRetrieved', [totalCount])));
  }

  public prepNullValues(records: unknown[]): void {
    records.forEach((record): void => {
      const recordAsObject = record as never;
      Reflect.ownKeys(recordAsObject).forEach((propertyKey) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const value = Reflect.get(recordAsObject, propertyKey);
        if (value === null) {
          Reflect.set(recordAsObject, propertyKey, chalk.bold('null'));
        } else if (typeof value === 'object') {
          this.prepNullValues([value]);
        }
      });
    });
  }

  public prepColumns(columns: Array<Optional<string>>): ColumnAttributes[] {
    return columns
      .map((field: Optional<string>) => field as string)
      .filter((field): string => field)
      .map(
        (field: string): ColumnAttributes => ({
          key: field,
          label: field.toUpperCase(),
        })
      );
  }

  public massageRows(queryResults: BasicRecord[], children: string[], aggregates: Field[]): BasicRecord[] {
    // some fields will return a JSON object that isn't accessible via the query (SELECT Metadata FROM RemoteProxy)
    // some will return a JSON that IS accessible via the query (SELECT owner.Profile.Name FROM Lead)
    // querying (SELECT Metadata.isActive FROM RemoteProxy) throws a SOQL validation error, so we have to display the entire Metadata object
    queryResults.map((qr) => {
      const result = qr as Record<string, unknown>;
      this.data.columns.forEach((col) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const entry = Reflect.get(result, col.name);
        if (typeof entry === 'object' && col.fieldType === FieldType.field) {
          Reflect.set(result, col.name, JSON.stringify(entry, null, 2));
        } else if (typeof entry === 'object' && col.fields?.length && entry) {
          col.fields.forEach((field) => {
            Reflect.set(result, `${col.name}.${field.name}`, get(result, `${col.name}.records[0].${field.name}`));
          });
        }
      });
    });

    // There are subqueries or aggregates. Massage the data.
    let qr;
    if (children.length > 0 || aggregates.length > 0) {
      qr = queryResults.reduce((newResults, result) => {
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
          const childrenRows: Record<string, unknown> = {};
          children.forEach((child) => {
            const aChild = result[child];
            Reflect.set(childrenRows, child, aChild);
            Reflect.deleteProperty(result, child);
          });

          Object.keys(childrenRows).forEach((child) => {
            const childObject = childrenRows[child];
            if (childObject && hasNestedRecords<BasicRecord>(childObject)) {
              childObject.records.forEach((childRecord) => {
                const newRecord: Record<string, unknown> = {};

                Object.entries(childRecord).forEach(([key, value]) => {
                  Reflect.defineProperty(newRecord, `${child.toString()}.${key}`, { value });
                });
                // I guarantee that one of the keys will be the `attributes`
                newResults.push(newRecord as BasicRecord);
              });
            }
          });
        }
        return newResults;
      }, [] as BasicRecord[]);
    }
    return qr ?? queryResults;
  }
}

const SEPARATOR = ',';
const DOUBLE_QUOTE = '"';
const SHOULD_QUOTE_REGEXP = new RegExp(`[${SEPARATOR}${DOUBLE_QUOTE}${EOL}]`);

export class CsvReporter extends QueryReporter {
  public constructor(data: SoqlQueryResult, columns: Field[], ux: UX, logger: Logger) {
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
    const attributeNames: string[] = this.massageRows();

    // begin output
    this.log(
      attributeNames
        .map((name) => {
          return this.escape(name);
        })
        .join(SEPARATOR)
    );

    this.data.result.records.forEach((row) => {
      const values = attributeNames.map((name) => {
        const value = get(row, name);
        if (isString(value)) {
          return this.escape(value);
        } else if (typeof value === 'object') {
          return this.escape(JSON.stringify(value));
        }
        return value;
      });
      this.log(values.join(SEPARATOR));
    });
  }

  public massageRows(): string[] {
    const fields = this.columns;
    const hasSubqueries = fields.some((field) => field.fieldType === FieldType.subqueryField);
    const hasFunctions = fields.some((field) => field.fieldType === FieldType.functionField);

    const attributeNames: string[] = [];

    if (fields) {
      this.logger.info(`Found fields ${JSON.stringify(fields.map((field) => `${typeof field}.${field.name}`))}`);
    } else {
      this.logger.info(`No fields found for query "${this.data.query}"`);
    }

    if (hasSubqueries || hasFunctions) {
      // If there are subqueries, we need to get the max child length for each subquery.
      const typeLengths = new Map<string, number>();
      // For function fields, like avg(total).
      const aggregates: Field[] = [];

      fields.forEach((field) => {
        if (field.fieldType === FieldType.subqueryField) {
          typeLengths.set(field.name, 0);
        }
        if (field.fieldType === FieldType.functionField) {
          aggregates.push(field);
        }
      });

      // Get max lengths by iterating over the records once
      this.data.result.records.forEach((result) => {
        [...typeLengths.keys()].forEach((key) => {
          const record = result[key];
          const totalSize = getNumber(record, 'totalSize');
          if (!!totalSize && totalSize > (typeLengths.get(key) ?? 0)) {
            typeLengths.set(key, totalSize);
          }
        });

        // Aggregates are soql functions that aggregate data, like "SELECT avg(total)" and
        // are returned in the data as exprX. Aggregates can have aliases, like "avg(total) totalAverage"
        // and are returned in the data as the alias.
        if (aggregates.length > 0) {
          for (let i = 0; i < aggregates.length; i++) {
            const aggregate = aggregates[i];
            if (!aggregate.alias) {
              Reflect.set(result as never, aggregate.name, Reflect.get(result as never, `expr${i}`));
            }
          }
        }
      });

      fields.forEach((field) => {
        if (typeLengths.get(field.name)) {
          for (let i = 0; i < (typeLengths.get(field.name) ?? 0); i++) {
            attributeNames.push(`${field.name}.totalSize`);
            (field.fields ?? []).forEach((subfield) => {
              attributeNames.push(`${field.name}.records.${i}.${subfield.name}`);
            });
          }
        } else if (field.fieldType === FieldType.functionField) {
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
      attributeNames.push(...fields.map((field) => field.name));
    }
    return attributeNames;
  }
}

export class JsonReporter extends QueryReporter {
  public constructor(data: SoqlQueryResult, columns: Field[], ux: UX, logger: Logger) {
    super(data, columns, ux, logger);
  }

  public log(): void {
    return;
  }

  public display(): void {
    this.ux.styledJSON({ status: 0, result: this.data.result });
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
