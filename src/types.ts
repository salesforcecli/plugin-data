/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BatchInfo, JobInfo } from '@jsforce/jsforce-node/lib/api/bulk.js';
import { JobInfoV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import type { QueryResult, Record as jsRecord } from '@jsforce/jsforce-node';
import { Optional } from '@salesforce/ts-types';
import { Connection } from '@salesforce/core';
import { ColumnDelimiterKeys } from './bulkUtils.js';

export type GenericEntry = [string, unknown];
export type GenericObject = Record<string, unknown>;
export enum FieldType {
  field,
  subqueryField,
  functionField,
}

/**
 * interface to represent a field when describing the fields that make up a query result
 */
export type Field = {
  fieldType: FieldType;
  name: string;
  fields?: Field[];
  alias?: Optional<string>;
};

/**
 * Type to define SoqlQuery results
 */
export type SoqlQueryResult = {
  query: string;
  result: QueryResult<jsRecord> & { id?: string };
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
export type DataPlanPart = {
  sobject: string;
  saveRefs: boolean;
  resolveRefs: boolean;
  files: Array<string | (DataPlanPart & { file: string })>;
};

export type SObjectTreeFileContents = {
  records: SObjectTreeInput[];
};

type ElementWithRecords<T> = { records: T[] };

/** element: a field value from the sobject.  Empty arrays return true */
export const hasNestedRecords = <T>(element: unknown): element is ElementWithRecords<T> =>
  Array.isArray((element as ElementWithRecords<T>)?.records);

/** element: a field value from the sobject.  Empty arrays return false */
export const hasNonEmptyNestedRecords = <T>(element: unknown): element is ElementWithRecords<T> =>
  hasNestedRecords(element) && element.records.length > 0;

/** convenience method for filtering Object.entries array */
export const hasNestedRecordsFilter = <T>(entry: GenericEntry): entry is [string, ElementWithRecords<T>] =>
  typeof entry[0] === 'string' && hasNonEmptyNestedRecords(entry[1]);

export const isAttributesElement = (element: unknown): element is SObjectTreeInput['attributes'] =>
  !!(element as SObjectTreeInput['attributes']).referenceId && !!(element as SObjectTreeInput['attributes']).type;

/** convenience method for filtering Object.entries array */
export const isAttributesEntry = (entry: GenericEntry): entry is ['attributes', SObjectTreeInput['attributes']] =>
  entry[0] === 'attributes' && isAttributesElement(entry[1]);

export type BulkProcessedRecordV2 = {
  sf__Created?: 'true' | 'false';
  sf__Id?: string;
} & GenericObject;

export type BulkRecordsV2 = {
  successfulResults: BulkProcessedRecordV2[];
  failedResults: BulkProcessedRecordV2[];
  unprocessedRecords: Array<Exclude<BulkProcessedRecordV2, 'sf__Created' | 'sf__id'>>;
  unparsed?: string;
};

export type StatusResult = BatchInfo[] | JobInfo;

export type ResumeOptions = {
  options: {
    connection: Connection;
  };
  jobInfo: { id: string };
};

export type ResumeBulkExportOptions = {
  options: {
    connection: Connection;
  };
  jobInfo: { id: string };
  outputInfo: {
    filePath: string;
    format: 'csv' | 'json';
    columnDelimiter: ColumnDelimiterKeys;
  };
};

export type ResumeBulkImportOptions = {
  options: {
    connection: Connection;
  };
  jobInfo: { id: string };
};

export type BulkResultV2 = {
  jobInfo: JobInfoV2;
  records?: BulkRecordsV2;
};
