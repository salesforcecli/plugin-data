/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Ux } from '@salesforce/sf-plugins-core';
import ansis from 'ansis';
import { get, getArray, isPlainObject, isString, Optional } from '@salesforce/ts-types';
import { Messages } from '@salesforce/core';
import type { Record as jsforceRecord } from '@jsforce/jsforce-node';
import { GenericEntry, GenericObject, Field, FieldType, SoqlQueryResult } from '../../types.js';
import { QueryReporter, logFields, isSubquery, isAggregate, getAggregateAliasOrName } from './reporters.js';
import { maybeMassageAggregates } from './reporters.js';

type ParsedFields = {
  /** Field names */
  attributeNames: Array<Optional<string>>;
  /** For subqueries. Display the children under the parents */
  children: string[];
  /** For function fields, like avg(total). */
  aggregates: Field[];
};
type FieldsMappedByName = Map<string, Field>;

export const nullString = ansis.bold('null');

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
export const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

export class HumanReporter extends QueryReporter {
  public constructor(data: SoqlQueryResult, columns: Field[]) {
    super(data, columns);
  }

  public display(): void {
    logFields(this.logger)(this.data.query)(this.columns);
    const { attributeNames: columnNames, children, aggregates } = parseFields(this.columns);
    const fieldMap = mapFieldsByName(this.columns);
    // in case of count() there are no records, but there is a totalSize
    const totalCount = this.data.result.records.length ? this.data.result.records.length : this.data.result.totalSize;
    const preppedData = this.data.result.records
      .map(removeAttributesFromObject)
      .map(maybeMassageAggregates(aggregates))
      .flatMap(maybeMassageSubqueries(children))
      .map(massageJson(fieldMap));

    printTable(preppedData, columnNames, totalCount);
  }
}

export const parseFields = (fields: Field[]): ParsedFields => ({
  attributeNames: fields.flatMap(humanNamesFromField),
  children: fields.filter(isSubquery).map((field) => field.name),
  aggregates: fields.filter(isAggregate),
});

export const prepColumns = (columns: Array<Optional<string>>): Ux.Table.Columns<GenericObject> => {
  const formattedColumns: Ux.Table.Columns<GenericObject> = {};
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

const printTable = (records: GenericObject[], columns: Array<Optional<string>>, totalCount: number): void => {
  const ux = new Ux();
  ux.table(records.map(prepNullValues), prepColumns(columns));
  ux.log(ansis.bold(messages.getMessage('displayQueryRecordsRetrieved', [totalCount])));
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
  (queryRow: jsforceRecord): GenericObject =>
    Object.fromEntries(Object.entries(queryRow).flatMap(([k, v]) => maybeReplaceJson(fieldMap.get(k))([k, v])));

const maybeReplaceJson =
  (field?: Field) =>
  ([key, value]: GenericEntry): GenericEntry[] => {
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

export const maybeMassageSubqueries =
  (children: string[]) =>
  (queryRow: jsforceRecord): jsforceRecord[] =>
    children.length ? massageSubqueries(children)(queryRow) : [queryRow];

const prependWithDot =
  (parent: string) =>
  ([k, v]: GenericEntry): GenericEntry =>
    [`${parent}.${k}`, v];

const replaceNullValue = ([k, v]: GenericEntry): GenericEntry => [k, maybeReplaceNulls(v)];

const massageSubqueries =
  (children: string[]) =>
  (queryRow: jsforceRecord): jsforceRecord[] => {
    const childrenRows = children.map(getChildRecords(queryRow));
    const childrenSet = new Set(children);

    // the first (0-index) child's keys are renamed and transferred onto the parent
    const childEntriesForParent = childrenRows
      .flatMap(([childFieldName, childRecords]) =>
        Object.entries(childRecords[0] ?? {})
          .map(prependWithDot(childFieldName))
          .flatMap(resolveObjects)
          .map(replaceNullValue)
      )
      .filter(removeAttributesfromEntry);

    // all other children, if any, are added to a new array of Objects
    const subResults = childrenRows.flatMap(([childFieldName, childRecords]) =>
      childRecords
        .slice(1)
        .map((r) => Object.entries(r).map(prependWithDot(childFieldName)).flatMap(resolveObjects).map(replaceNullValue))
        .map((entries) => Object.fromEntries(entries))
        .filter(removeEmptyObjects)
    );

    const parentEntries = Object.entries(queryRow)
      // remove known children from the original object
      .filter(([key]) => !childrenSet.has(key))
      .concat(childEntriesForParent);

    return [Object.fromEntries(parentEntries), ...subResults];
  };

/** query has subQueries that result in arrays of records */
const getChildRecords =
  (queryRow: jsforceRecord) =>
  (child: string): [key: string, records: jsforceRecord[]] =>
    [child, (getArray(get(queryRow, child), 'records', []) as jsforceRecord[]).map(removeAttributesFromObject)];

/** Query has foo.bar.baz (upward references to parents).  This recursively flattens those object fields to match the query columns */
const resolveObjects = ([k, v]: GenericEntry): GenericEntry[] =>
  isPlainObject(v)
    ? Object.entries(v).filter(removeAttributesfromEntry).map(prependWithDot(k)).flatMap(resolveObjects)
    : [[k, v]];

const removeAttributesfromEntry = ([k]: GenericEntry): boolean => k !== 'attributes';
const removeAttributesFromObject = (record: jsforceRecord): jsforceRecord =>
  Object.fromEntries(Object.entries(record).filter(removeAttributesfromEntry));
const removeEmptyObjects = (record: jsforceRecord): boolean => Object.keys(record).length > 0;
