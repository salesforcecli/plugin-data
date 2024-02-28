/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'node:os';

import { Logger, Messages } from '@salesforce/core';
import { ux } from '@oclif/core';
import { get, getNumber, isString } from '@salesforce/ts-types';
import { JobInfoV2 } from 'jsforce/lib/api/bulk2.js';
import { capitalCase } from 'change-case';
import { Field, FieldType, SoqlQueryResult } from './dataSoqlQueryTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const reporterMessages = Messages.loadMessages('@salesforce/plugin-data', 'reporter');

export abstract class QueryReporter {
  protected logger: Logger;
  protected columns: Field[] = [];
  protected data: SoqlQueryResult;

  public constructor(data: SoqlQueryResult, columns: Field[]) {
    this.logger = Logger.childFromRoot('reporter');
    this.columns = columns;
    this.data = data;
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
    ux.log(attributeNames.map(escape).join(SEPARATOR));

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
    const fields = logFields(this.logger)(this.data.query)(this.columns);

    if (fields.some(isSubquery) || fields.some(isAggregate)) {
      // If there are subqueries, we need to get the max child length for each subquery.
      const typeLengths = new Map<string, number>(fields.filter(isSubquery).map((field) => [field.name, 0]));
      // For function fields, like avg(total).
      const aggregates = fields.filter(isAggregate);

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

      return fields.flatMap(csvAttributeNamesFromField(typeLengths));
    }
    // simple case, no aggregates or subqueries
    return fields.map((field) => field.name);
  }
}

export class JsonReporter extends QueryReporter {
  public constructor(data: SoqlQueryResult, columns: Field[]) {
    super(data, columns);
  }

  public display(): void {
    ux.styledJSON({ status: 0, result: this.data.result });
  }
}

/**
 * A list of the accepted reporter types
 */

export type FormatTypes = 'human' | 'csv' | 'json';

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

export const getResultMessage = (jobInfo: JobInfoV2): string =>
  reporterMessages.getMessage('bulkV2Result', [
    jobInfo.id,
    capitalCase(jobInfo.state),
    jobInfo.numberRecordsProcessed,
    jobInfo.numberRecordsFailed,
  ]);

export const isAggregate = (field: Field): boolean => field.fieldType === FieldType.functionField;
export const isSubquery = (field: Field): boolean => field.fieldType === FieldType.subqueryField;
const getAggregateFieldName = (field: Field): string => field.alias ?? field.name;
export const getAggregateAliasOrName = (field: Field): string =>
  isAggregate(field) ? getAggregateFieldName(field) : field.name;

const csvAttributeNamesFromField =
  (typeLengths: Map<string, number>) =>
  (field: Field): string[] =>
    typeLengths.has(field.name)
      ? subQueryAttributeNames(typeLengths.get(field.name) ?? 0)(field)
      : [getAggregateAliasOrName(field)];

const subQueryAttributeNames =
  (length: number) =>
  (field: Field): string[] =>
    Array.from({ length }).flatMap((v, index) => [
      `${field.name}.totalSize`,
      ...(field.fields ?? []).map((subfield) => `${field.name}.records.${index}.${subfield.name}`),
    ]);

export const logFields =
  (logger: Logger) =>
  (query: string) =>
  (fields?: Field[]): Field[] => {
    if (fields?.length) {
      logger?.info(`Found fields ${JSON.stringify(fields.map((field) => `${typeof field}.${field.name}`))}`);
    } else {
      logger?.info(`No fields found for query "${query}"`);
    }
    return fields ?? [];
  };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// const logFn = <T>(i: T): T => {
//   // eslint-disable-next-line no-console
//   console.log(i);
//   return i;
// };
