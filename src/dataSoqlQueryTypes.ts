/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { QueryResult, Record } from 'jsforce';
import { Optional } from '@salesforce/ts-types';

export enum FieldType {
  field,
  subqueryField,
  functionField,
}

/**
 * interface to represent a field when describing the fields that make up a query result
 */
export interface Field {
  fieldType: FieldType;
  name: string;
  fields?: Field[];
  alias?: Optional<string>;
}

/**
 * Type to define SoqlQuery results
 */
export type SoqlQueryResult = {
  query: string;
  // an id can be present when a bulk query times out
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore jsforce v2 types are too strict for running general queries
  result: QueryResult<Record> & { id?: string };
  columns: Field[];
};

export type BasicRecord = {
  [index: string]: unknown;
  attributes: {
    type: string;
    url: string;
  };
};

export type SObjectTreeInput = Omit<BasicRecord, 'attributes'> & {
  attributes: Omit<BasicRecord['attributes'], 'url'> & {
    referenceId: string;
  };
};
export interface DataPlanPart {
  sobject: string;
  saveRefs: boolean;
  resolveRefs: boolean;
  files: Array<string | (DataPlanPart & { file: string })>;
}

export type SObjectTreeFileContents = {
  records: SObjectTreeInput[];
};

export type ElementWithRecords<T> = { records: T[] };

/** element: a field value from the sobject.  Empty arrays return true */
export const hasNestedRecords = <T>(element: unknown): element is { records: T[] } =>
  Array.isArray((element as { records: T[] })?.records);

/** element: a field value from the sobject.  Empty arrays return false */
export const hasNonEmptyNestedRecords = <T>(element: unknown): element is ElementWithRecords<T> =>
  Array.isArray((element as ElementWithRecords<T>)?.records) && (element as ElementWithRecords<T>).records.length > 0;

/** convenience method for array filtering */
export const hasNestedRecordsFilter = <T>(tuple: [string, unknown]): tuple is [string, ElementWithRecords<T>] =>
  typeof tuple[0] === 'string' && hasNonEmptyNestedRecords(tuple[1]);

export const isAttributesElement = (element: unknown): element is SObjectTreeInput['attributes'] =>
  !!(element as SObjectTreeInput['attributes']).referenceId && !!(element as SObjectTreeInput['attributes']).type;
