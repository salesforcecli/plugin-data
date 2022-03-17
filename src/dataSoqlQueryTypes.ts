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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore //TODO
  result: QueryResult<unknown>;
  columns: Field[];
};
