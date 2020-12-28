/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ensureJsonArray, ensureJsonMap, ensureString, isJsonArray, Optional, toJsonMap } from '@salesforce/ts-types';
import { Connection } from '@salesforce/core';
import { Tooling } from '@salesforce/core/lib/connection';

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
}
/**
 * itnerface to represent a subquery field when describing the fields that make up a query result
 */
export interface SubqueryField extends Field {
  fields: Field[];
}

/**
 * interface to represent function fields, i.e. result of using aggregation function, like avg.
 */
export interface FunctionField extends Field {
  alias?: Optional<string>;
}

/**
 * Utility to fetch the columns involved in a soql query.
 *
 * Columns are then transformed into one of three types, Field, SubqueryField and FunctionField. List of
 * fields is returned as the product.
 *
 * @param connection
 * @param query
 */

export const retrieveColumns = async (connection: Connection | Tooling, query: string): Promise<Field[]> => {
  // eslint-disable-next-line no-underscore-dangle,@typescript-eslint/unbound-method,@typescript-eslint/restrict-template-expressions
  const columnUrl = `${connection._baseUrl()}/query?q=${encodeURIComponent(query)}&columns=true`;
  const results = toJsonMap(await connection.request(columnUrl));
  const columns: Field[] = [];
  for (let column of ensureJsonArray(results.columnMetadata)) {
    column = ensureJsonMap(column);
    const name = ensureString(column.columnName);

    if (isJsonArray(column.joinColumns) && column.joinColumns.length > 0) {
      if (column.aggregate) {
        const field: SubqueryField = {
          fieldType: FieldType.subqueryField,
          name,
          fields: [],
        };
        for (const subcolumn of column.joinColumns) {
          const f: Field = {
            fieldType: FieldType.field,
            name: ensureString(ensureJsonMap(subcolumn).columnName),
          };
          field.fields.push(f);
        }
        columns.push(field);
      } else {
        for (const subcolumn of column.joinColumns) {
          const f: Field = {
            fieldType: FieldType.functionField,
            name: `${name}.${ensureString(ensureJsonMap(subcolumn).columnName)}`,
          };
          columns.push(f);
        }
      }
    } else if (column.aggregate) {
      const field: FunctionField = {
        fieldType: FieldType.functionField,
        name: ensureString(column.displayName),
      };
      // If it isn't an alias, skip so the display name is used when messaging rows
      if (!/expr[0-9]+/.test(name)) {
        field.alias = name;
      }
      columns.push(field);
    } else {
      columns.push({ fieldType: FieldType.field, name } as Field);
    }
  }
  return columns;
};
