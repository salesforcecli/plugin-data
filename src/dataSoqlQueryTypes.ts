/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { QueryResult } from 'jsforce';
import { Optional } from '@salesforce/ts-types';

// eslint-disable-next-line no-shadow
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
  result: QueryResult<BasicRecord>;
  columns: Field[];
};

export type BasicRecord = {
  [index: string]: { records: BasicRecord[] } | unknown;
  attributes: {
    type: string;
    url?: string;
  };
};

export interface DataPlanPart {
  sobject: string;
  saveRefs: boolean;
  resolveRefs: boolean;
  files: string[];
}

export type SObjectTreeInput = {
  attributes: {
    type: string;
    referenceId: string;
  };
} & {
  [index: string]: { records: SObjectTreeInput[] } | unknown;
};

export type SObjectTreeFileContents = {
  records: SObjectTreeInput[];
};

export const hasNestedRecords = <T>(element: { records: T[] } | unknown): element is { records: T[] } => {
  return Array.isArray((element as { records: T[] }).records);
};

export const isAttributesElement = (
  element: SObjectTreeInput['attributes'] | unknown
): element is SObjectTreeInput['attributes'] => {
  return (
    !!(element as SObjectTreeInput['attributes']).referenceId && !!(element as SObjectTreeInput['attributes']).type
  );
};
