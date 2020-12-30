/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger } from '@salesforce/core';
import { QueryResult } from 'jsforce';
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
  result: QueryResult<unknown>;
  columns: Field[];
};

export type DataSoqlQueryResult = SoqlQueryResult & {
  resultFormat: string;
  json: boolean;
  logger: Logger;
};
