/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Logger, Messages } from '@salesforce/core';
import { ux } from '@oclif/core';
import { JobInfoV2 } from 'jsforce/lib/api/bulk2.js';
import { capitalCase } from 'change-case';
import { Field, FieldType, SoqlQueryResult } from '../dataSoqlQueryTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const reporterMessages = Messages.loadMessages('@salesforce/plugin-data', 'reporter');

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
  public constructor(data: SoqlQueryResult, columns: Field[]) {
    super(data, columns);
  }

  public display(): void {
    ux.styledJSON({ status: 0, result: this.data.result });
  }
}

/**
 * A list of the accepted reporter types
 */
export const formatTypes = ['human', 'csv', 'json'] as const;
export type FormatTypes = (typeof formatTypes)[number];

export const getResultMessage = (jobInfo: JobInfoV2): string =>
  reporterMessages.getMessage('bulkV2Result', [
    jobInfo.id,
    capitalCase(jobInfo.state),
    jobInfo.numberRecordsProcessed,
    jobInfo.numberRecordsFailed,
  ]);

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
