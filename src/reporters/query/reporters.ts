/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { Logger } from '@salesforce/core';
import { Ux } from '@salesforce/sf-plugins-core';
import { Field, FieldType, GenericObject, SoqlQueryResult } from '../../types.js';

export abstract class QueryReporter {
  protected logger: Logger;
  protected columns: Field[] = [];
  protected data: SoqlQueryResult;

  public constructor(data: SoqlQueryResult, columns: Field[]) {
    this.logger = Logger.childFromRoot('reporter');
    this.columns = columns;
    this.data = data;
  }
}

export class JsonReporter extends QueryReporter {
  private outputFile: string | undefined;

  public constructor(data: SoqlQueryResult, columns: Field[], outputFile?: string) {
    super(data, columns);
    this.outputFile = outputFile;
  }

  public display(): void {
    if (this.outputFile) {
      const fsWritable = fs.createWriteStream(this.outputFile);
      fsWritable.write(JSON.stringify(this.data.result, null, 2));
    } else {
      new Ux().styledJSON({ status: 0, result: this.data.result });
    }
  }
}

export const formatTypes = ['human', 'csv', 'json'] as const;
export type FormatTypes = (typeof formatTypes)[number];

export const isAggregate = (field: Field): boolean => field.fieldType === FieldType.functionField;
export const isSubquery = (field: Field): boolean => field.fieldType === FieldType.subqueryField;
const getAggregateFieldName = (field: Field): string => field.alias ?? field.name;
export const getAggregateAliasOrName = (field: Field): string =>
  isAggregate(field) ? getAggregateFieldName(field) : field.name;

/** if there are fields, log them by type/name; otherwise, log that there are no fields for the query  */
export const logFields =
  (logger: Logger) =>
  (query: string) =>
  (fields?: Field[]): Field[] => {
    if (fields?.length) {
      logger?.info(`Found fields ${JSON.stringify(fields.map((field) => `${typeof field}.${field.name}`))}`);
    } else {
      logger?.info(`No fields found for query "${query}"`);
    }
    return fields ?? [];
  };

export const maybeMassageAggregates =
  (aggregates: Field[]) =>
  (queryRow: GenericObject): GenericObject =>
    aggregates.length ? renameAggregates(aggregates)(queryRow) : queryRow;

/**
 * replace ex: expr0 with the alias (if there is one) or name
 *
 * Aggregates are soql functions that aggregate data, like "SELECT avg(total)" and
 * are returned in the data as exprX. Aggregates can have aliases, like "avg(total) totalAverage"
 * and are returned in the data as the alias.
 *
 */
export const renameAggregates =
  (aggregates: Field[]) =>
  (queryRow: GenericObject): GenericObject =>
    Object.fromEntries(
      Object.entries(queryRow).map(([k, v]) => {
        const index = typeof k === 'string' ? k.match(/expr(\d+)/)?.[1] : undefined;
        if (typeof index === 'string') {
          const matchingAgg = aggregates.at(parseInt(index, 10));
          return matchingAgg ? [getAggregateAliasOrName(matchingAgg), v] : [k, v];
        }
        return [k, v];
      })
    );
