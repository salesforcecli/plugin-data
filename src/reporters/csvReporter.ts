/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'node:os';
import { ux } from '@oclif/core';
import { get, getNumber, isString } from '@salesforce/ts-types';
import { Record as jsforceRecord } from '@jsforce/jsforce-node';
import { Field, SoqlQueryResult } from '../dataSoqlQueryTypes.js';
import { getAggregateAliasOrName, maybeMassageAggregates } from './reporters.js';
import { QueryReporter, logFields, isSubquery, isAggregate } from './reporters.js';

export class CsvReporter extends QueryReporter {
  public constructor(data: SoqlQueryResult, columns: Field[]) {
    super(data, columns);
  }

  public display(): void {
    const fields = logFields(this.logger)(this.data.query)(this.columns);
    const aggregates = fields.filter(isAggregate);
    const preppedData = this.data.result.records.map(maybeMassageAggregates(aggregates));
    const attributeNames = getColumns(preppedData)(fields);

    [
      // header row
      attributeNames.map(escape).join(SEPARATOR),
      // data
      ...preppedData.map((row): string => attributeNames.map(getFieldValue(row)).join(SEPARATOR)),
    ].map((line) => ux.log(line));
  }
}

const getFieldValue =
  (row: jsforceRecord) =>
  (fieldName: string): unknown => {
    // try get(row, name) first, then if it fails, default to row[name]. The default will happen in bulk cases.
    // the standard case returns {field:{nested: 'value'}}, while the bulk will return {field.nested: 'value'}
    const value = get(row, fieldName, row[fieldName]);
    if (isString(value)) {
      return escape(value);
      // if value is null, then typeof value === 'object' so check before typeof to avoid illegal csv
    } else if (value === null) {
      return;
    } else if (typeof value === 'object') {
      return escape(JSON.stringify(value));
    }
    return value;
  };

export const getMaxRecord =
  (allRecords: jsforceRecord[]) =>
  (fieldName: string): number =>
    allRecords.reduce((max, record) => Math.max(max, getNumber(get(record, fieldName), 'totalSize', 0)), 0);

export const getColumns =
  (records: jsforceRecord[]) =>
  (fields: Field[]): string[] => {
    // If there are subqueries, we need to get the max child length for each subquery.
    // For function fields, like avg(total).
    const maxRecordsPerField = new Map<string, number>(
      fields.filter(isSubquery).map((field) => [field.name, getMaxRecord(records)(field.name)])
    );

    return [...maxRecordsPerField.values()].some((n) => n > 0)
      ? fields.flatMap(csvAttributeNamesFromField(maxRecordsPerField)) // flatten nested objects from the query down to a flat file
      : fields.map((field) => field.name); // simple case, no aggregates or subqueries
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

const SEPARATOR = ',';
const DOUBLE_QUOTE = '"';
const SHOULD_QUOTE_REGEXP = new RegExp(`[${SEPARATOR}${DOUBLE_QUOTE}${EOL}]`);

const csvAttributeNamesFromField =
  (typeLengths: Map<string, number>) =>
  (field: Field): string[] =>
    typeLengths.has(field.name)
      ? subQueryAttributeNames(typeLengths.get(field.name) ?? 0)(field)
      : [getAggregateAliasOrName(field)];

// to flatten nested objects from the query down to a flat file, we need to construct column names
const subQueryAttributeNames =
  (length: number) =>
  (field: Field): string[] =>
    Array.from({ length }).flatMap((v, index) => [
      `${field.name}.totalSize`,
      ...(field.fields ?? []).map((subfield) => `${field.name}.records.${index}.${subfield.name}`),
    ]);
