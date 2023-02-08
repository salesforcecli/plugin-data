/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'os';
import { Logger, Messages } from '@salesforce/core';
import { ux } from '@oclif/core';
import * as chalk from 'chalk';
import { get, getArray, getNumber, isString, Optional } from '@salesforce/ts-types';
import { BatchInfo, IngestJobV2Results, JobInfoV2 } from 'jsforce/lib/api/bulk';
import { BatchState } from 'jsforce/api/bulk';
import { Schema } from 'jsforce';
import { capitalCase } from 'change-case';
import { Field, FieldType, SoqlQueryResult } from './dataSoqlQueryTypes';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');
const reporterMessages = Messages.loadMessages('@salesforce/plugin-data', 'reporter');

class Reporter {
  protected logger: Logger;

  public constructor() {
    this.logger = Logger.childFromRoot('reporter');
  }
}

class QueryReporter extends Reporter {
  protected columns: Field[] = [];
  protected data: SoqlQueryResult;

  public constructor(data: SoqlQueryResult, columns: Field[]) {
    super();
    this.columns = columns;
    this.data = data;
  }
}

type ParsedFields = {
  attributeNames: Array<Optional<string>>;
  children: string[];
  aggregates: Field[];
};

export class HumanReporter extends QueryReporter {
  public constructor(data: SoqlQueryResult, columns: Field[]) {
    super(data, columns);
  }

  public display(): void {
    const { attributeNames, children, aggregates } = this.parseFields();
    // in case of count() there are no records, but there is a totalSize
    const totalCount = this.data.result.records.length ? this.data.result.records.length : this.data.result.totalSize;
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

  public soqlQuery(
    columns: Array<Optional<string>>,
    records: Array<Record<string, unknown>>,
    totalCount: number
  ): void {
    this.prepNullValues(records);
    ux.table(records, prepColumns(columns));
    ux.log(chalk.bold(messages.getMessage('displayQueryRecordsRetrieved', [totalCount])));
  }

  public prepNullValues(records: unknown[]): void {
    records
      .filter((record) => record)
      .forEach((record): void => {
        if (record) {
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
        }
      });
  }

  //  public massageRows(queryResults: BasicRecord[], children: string[], aggregates: Field[]): BasicRecord[] {
  public massageRows(
    queryResults: Array<Record<string, unknown>>,
    children: string[],
    aggregates: Field[]
  ): Array<Record<string, unknown>> {
    // some fields will return a JSON object that isn't accessible via the query (SELECT Metadata FROM RemoteProxy)
    // some will return a JSON that IS accessible via the query (SELECT owner.Profile.Name FROM Lead)
    // querying (SELECT Metadata.isActive FROM RemoteProxy) throws a SOQL validation error, so we have to display the entire Metadata object
    queryResults.forEach((qr) => {
      const result = qr;
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
    if (children.length > 0 || aggregates.length > 0) {
      const qr = queryResults.reduce<Array<Record<string, unknown>>>(
        (newResults: Array<Record<string, unknown>>, result) => {
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

          const subResults: Array<Record<string, unknown>> = [];
          if (children.length > 0) {
            const childrenRows: Record<string, unknown> = {};
            children.forEach((child) => {
              const aChild = get(result as never, child);
              Reflect.set(childrenRows, child, aChild);
              Reflect.deleteProperty(result as never, child);
            });

            Reflect.ownKeys(childrenRows).forEach((child) => {
              const childO = get(childrenRows, child as string);
              if (childO) {
                const childRecords = getArray(childO, 'records', []);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                childRecords.forEach((record: unknown, index) => {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  const newResult: Record<string, unknown> = {};
                  Object.entries(record as never).forEach(([key, value]) => {
                    if (!index) {
                      Reflect.defineProperty(result, `${child.toString()}.${key}`, {
                        value: value ?? chalk.bold('null'),
                      });
                    } else {
                      Reflect.defineProperty(newResult, `${child.toString()}.${key}`, {
                        value: value ?? chalk.bold('null'),
                      });
                    }
                  });
                  if (index) {
                    subResults.push(newResult);
                  }
                });
              }
            });
          }
          newResults.push(result, ...subResults);
          return newResults;
        },
        []
      );
      return qr;
    }
    return queryResults;
  }
}

const SEPARATOR = ',';
const DOUBLE_QUOTE = '"';
const SHOULD_QUOTE_REGEXP = new RegExp(`[${SEPARATOR}${DOUBLE_QUOTE}${EOL}]`);

export class CsvReporter extends QueryReporter {
  public constructor(data: SoqlQueryResult, columns: Field[]) {
    super(data, columns);
  }

  public display(): void {
    const attributeNames = this.massageRows();

    // begin output
    ux.log(attributeNames.map((name) => escape(name)).join(SEPARATOR));

    // explained why we need this below - foreach does not allow types
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.data.result.records.forEach((row: Record<string, unknown>) => {
      const values = attributeNames.map((name) => {
        // try get(row, name) first, then if it fails, default to row[name]. The default will happen in bulk cases.
        // the standard case returns {field:{nested: 'value'}}, while the bulk will return {field.nested: 'value'}
        const value = get(row, name, row[name]);
        if (isString(value)) {
          return escape(value);
          // if value is null, then typeof value === 'object' so check before typeof to avoid illegal csv
        } else if (value === null) {
          return;
        } else if (typeof value === 'object') {
          return escape(JSON.stringify(value));
        }
        return value;
      });
      ux.log(values.join(SEPARATOR));
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
          const record = get(result as never, key);
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
  public constructor(data: SoqlQueryResult, columns: Field[]) {
    super(data, columns);
  }

  // eslint-disable-next-line class-methods-use-this
  public log(): void {
    return;
  }

  public display(): void {
    ux.styledJSON({ status: 0, result: this.data.result });
  }
}

/**
 * A list of the accepted reporter types
 */

export type FormatTypes = 'human' | 'csv' | 'json';

const prepColumns = (columns: Array<Optional<string>>): ux.Table.table.Columns<Record<string, unknown>> => {
  const formattedColumns: ux.Table.table.Columns<Record<string, unknown>> = {};
  columns
    .map((field: Optional<string>) => field)
    .filter(isString)
    .map(
      (field) =>
        (formattedColumns[field] = {
          header: field.toUpperCase(),
          get: (row): string => {
            // first test if key exists, if so, return value
            if (Reflect.has(row, field)) {
              return (Reflect.get(row, field) as string) ?? '';
            } else {
              // if not, try to find it query
              return (get(row, field) as string) ?? '';
            }
          },
        })
    );
  return formattedColumns;
};

/**
 * Escape a value to be placed in a CSV row. We follow rfc 4180
 * https://tools.ietf.org/html/rfc4180#section-2 and will not surround the
 * value in quotes if it doesn't contain the separator, double quote, or EOL.
 *
 * @param value The escaped value
 */
export const escape = (value: string): string => {
  if (value && SHOULD_QUOTE_REGEXP.test(value)) {
    return `"${value.replace(/"/gi, '""')}"`;
  }
  return value;
};

export const BatchInfoColumns = {
  id: { header: 'Batch Id' },
  state: { header: 'State' },
  failed: { header: 'Failed' },
  stateMessage: { header: 'Message' },
};

export const getBatchTotals = (batches: BatchInfo[]): { total: number; failed: number; success: number } =>
  batches.reduce(
    (acc: { total: number; failed: number; success: number }, batch) => {
      acc.total += parseInt(batch.numberRecordsProcessed, 10);
      acc.failed += parseInt(batch.numberRecordsFailed, 10);
      acc.success = acc.total - acc.failed;
      return acc;
    },
    { total: 0, failed: 0, success: 0 }
  );

export function getBulk2JobTotals<J extends Schema>(
  results: IngestJobV2Results<J>
): { total: number; failed: number; success: number; unprocessed: number } {
  const ttls = { total: 0, failed: 0, success: 0, unprocessed: 0 };
  ttls.total =
    Object.keys(results.successfulResults).length +
    Object.keys(results.failedResults).length +
    Object.keys(results.unprocessedRecords).length;
  ttls.failed = Object.keys(results.failedResults).length;
  ttls.success = Object.keys(results.successfulResults).length;
  ttls.unprocessed = Object.keys(results.unprocessedRecords).length;
  return ttls;
}

export const getFailedBatchesForDisplay = (
  batches: BatchInfo[]
): Array<{ id: string; state: BatchState; failed: string; stateMessage: string }> => {
  const failedBatches = batches.filter((batch) => parseInt(batch.numberRecordsFailed, 10) > 0);
  const batchesForTable = failedBatches.map((batch) => ({
    id: batch.id,
    state: batch.state,
    failed: `${batch.numberRecordsFailed.toString().padStart(5, ' ')}/${batch.numberRecordsProcessed
      .toString()
      .padStart(5, ' ')}`,
    stateMessage: batch.stateMessage,
  }));
  return batchesForTable;
};

export const getResultMessage = (jobInfo: JobInfoV2): string =>
  reporterMessages.getMessage('bulkV2Result', [
    jobInfo.id,
    capitalCase(jobInfo.state),
    jobInfo.numberRecordsProcessed,
    jobInfo.numberRecordsFailed,
  ]);
