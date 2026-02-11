/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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

/** find null/undefined and replace it with a styled string */
export const prepNullValues = <T>(record: T): T =>
  isPlainObject(record)
    ? (Object.fromEntries(
        Object.entries(record).map(([key, value]) => [key, maybeReplaceNulls(maybeRecurseNestedObjects(value))])
      ) as T)
    : record;

const maybeReplaceNulls = <T>(value: T): T | string => value ?? nullString;
const maybeRecurseNestedObjects = <T>(value: T): T => (isPlainObject(value) ? prepNullValues(value) : value);

function prepData(
  records: GenericObject[],
  columns: Array<Optional<string>>
): { data: Array<Record<string, unknown>>; columns: Array<{ key: string; name: string }> } {
  const fields = columns.filter(isString);
  const data = records.map(prepNullValues).map((record) => {
    const row: Record<string, unknown> = {};
    fields.forEach((field) => {
      if (field in record) {
        row[field] = (record[field] as string) ?? '';
      } else {
        // if not, try to find it query
        row[field] = (get(record, field) as string) ?? '';
      }
    });
    return row;
  });
  return { data, columns: fields.map((field) => ({ key: field, name: field.toUpperCase() })) };
}

const printTable = (records: GenericObject[], cols: Array<Optional<string>>, totalCount: number): void => {
  const ux = new Ux();
  const { data, columns } = prepData(records, cols);
  ux.table({
    data,
    columns,
    overflow: 'wrap',
  });
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
