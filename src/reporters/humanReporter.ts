/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ux } from '@oclif/core';
import chalk from 'chalk';
import { get, getArray, isPlainObject, isString, Optional } from '@salesforce/ts-types';
import { Messages } from '@salesforce/core';
import { Field, FieldType, SoqlQueryResult } from '../dataSoqlQueryTypes.js';
import { QueryReporter, logFields, isSubquery, isAggregate, getAggregateAliasOrName } from './reporters.js';
import { massageAggregates } from './reporters.js';

type ParsedFields = {
  /** Field names */
  attributeNames: Array<Optional<string>>;
  /** For subqueries. Display the children under the parents */
  children: string[];
  /** For function fields, like avg(total). */
  aggregates: Field[];
};

type FieldsMappedByName = Map<string, Field>;

export const nullString = chalk.bold('null');

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
export const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

export class HumanReporter extends QueryReporter {
  public constructor(data: SoqlQueryResult, columns: Field[]) {
    super(data, columns);
  }

  public display(): void {
    logFields(this.logger)(this.data.query)(this.columns);
    const { attributeNames, children, aggregates } = parseFields(this.columns);
    const fieldMap = mapFieldsByName(this.columns);
    // in case of count() there are no records, but there is a totalSize
    const totalCount = this.data.result.records.length ? this.data.result.records.length : this.data.result.totalSize;
    const preppedData = this.data.result.records
      .map(massageAggregates(aggregates))
      .flatMap(maybeMassageSubqueries(children))
      .map(massageJson(fieldMap));

    printTable(attributeNames, preppedData, totalCount);
  }
}

export const parseFields = (fields: Field[]): ParsedFields => ({
  attributeNames: fields.flatMap(humanNamesFromField),
  children: fields.filter(isSubquery).map((field) => field.name),
  aggregates: fields.filter(isAggregate),
});

export const prepColumns = (columns: Array<Optional<string>>): ux.Table.table.Columns<Record<string, unknown>> => {
  const formattedColumns: ux.Table.table.Columns<Record<string, unknown>> = {};
  columns.filter(isString).map(
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

/** find null/undefined and replace it with a styled string */
export const prepNullValues = <T>(record: T): T =>
  isPlainObject(record)
    ? (Object.fromEntries(
        Object.entries(record).map(([key, value]) => [key, maybeReplaceNulls(maybeRecurseNestedObjects(value))])
      ) as T)
    : record;

const maybeReplaceNulls = <T>(value: T): T | string => value ?? nullString;
const maybeRecurseNestedObjects = <T>(value: T): T => (isPlainObject(value) ? prepNullValues(value) : value);

const printTable = (
  columns: Array<Optional<string>>,
  records: Array<Record<string, unknown>>,
  totalCount: number
): void => {
  ux.table(records.map(prepNullValues), prepColumns(columns));
  ux.log(chalk.bold(messages.getMessage('displayQueryRecordsRetrieved', [totalCount])));
};

const humanNamesFromField = (field: Field): string[] =>
  isSubquery(field)
    ? (field.fields ?? [])?.map((subfield) => `${field.name}.${subfield.name}`)
    : [getAggregateAliasOrName(field)];

/**
 * some fields will return a JSON object that isn't accessible via the query (SELECT Metadata FROM RemoteProxy)
 * some will return a JSON that IS accessible via the query (SELECT owner.Profile.Name FROM Lead)
 * querying (SELECT Metadata.isActive FROM RemoteProxy) throws a SOQL validation error, so we have to display the entire Metadata object
 */
export const massageJson =
  (fieldMap: FieldsMappedByName) =>
  (queryRow: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(queryRow).flatMap(([k, v]) => maybeReplaceJson(fieldMap.get(k))([k, v])));

const maybeReplaceJson =
  (field?: Field) =>
  ([key, value]: [key: string, value: unknown]): Array<[string, unknown]> => {
    if (isPlainObject(value) && field?.fieldType === FieldType.field) {
      return [[key, JSON.stringify(value, null, 2)]];
    }
    if (isPlainObject(value) && field?.fields?.length && value) {
      return field.fields.map((subfield) => [`${key}.${subfield.name}`, get(value, `records[0].${subfield.name}`)]);
    }
    return [[key, value]];
  };

export const mapFieldsByName = (fields: Field[]): FieldsMappedByName =>
  new Map(fields.map((field) => [field.name, field]));

const maybeMassageSubqueries =
  (children: string[]) =>
  (queryRow: Record<string, unknown>): Array<Record<string, unknown>> =>
    children.length ? massageSubqueries(children)(queryRow) : [queryRow];

const prependParentWithDotAndReplaceNull =
  (parent: string) =>
  ([k, v]: [string, unknown]): [string, unknown] =>
    [`${parent}.${k}`, v ?? nullString];

const massageSubqueries =
  (children: string[]) =>
  (queryRow: Record<string, unknown>): Array<Record<string, unknown>> => {
    const childrenSet = new Set(children);
    const childrenRows = new Map(children.map(getChildRecords(queryRow)));

    // all other children are added to a new array of Objects
    const subResults = Array.from(childrenRows.entries())
      .map(([childFieldName, childRecords]) =>
        childRecords.slice(1).flatMap(Object.entries).map(prependParentWithDotAndReplaceNull(childFieldName))
      )
      .map((entries) => Object.fromEntries(entries));

    // the first (0-index) child's keys are renamed and transferred onto the parent
    const childEntriesForParent = Array.from(childrenRows.entries()).flatMap(([childFieldName, childRecords]) =>
      Object.entries(childRecords[0] ?? {}).map(prependParentWithDotAndReplaceNull(childFieldName))
    );

    const parentEntries = Object.entries(queryRow)
      // remove known children from the original object
      .filter(([key]) => !childrenSet.has(key))
      .concat(childEntriesForParent);

    return [Object.fromEntries(parentEntries), ...subResults];
  };

const getChildRecords =
  (queryRow: unknown) =>
  (child: string): [key: string, records: Array<Record<string, unknown>>] =>
    [child, getArray(get(queryRow, child), 'records', []) as Array<Record<string, unknown>>];
