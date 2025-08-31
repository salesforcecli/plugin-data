/*
 * Copyright 2025, Salesforce, Inc.
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

import fs from 'node:fs';
import { Connection, Logger, Messages } from '@salesforce/core';
import type { Record as jsforceRecord } from '@jsforce/jsforce-node';
import {
  AnyJson,
  ensureJsonArray,
  ensureJsonMap,
  ensureString,
  getArray,
  isJsonArray,
  JsonArray,
  toJsonMap,
} from '@salesforce/ts-types';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { orgFlags, perflogFlag, resultFormatFlag } from '../../flags.js';
import { Field, FieldType, SoqlQueryResult } from '../../types.js';
import { displayResults } from '../../queryUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

export type DataQueryResult = {
  records: jsforceRecord[];
  totalSize: number;
  done: boolean;
  outputFile?: string;
};

export class DataSoqlQueryCommand extends SfCommand<DataQueryResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:soql:query'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    query: Flags.string({
      char: 'q',
      summary: messages.getMessage('flags.query.summary'),
      exactlyOne: ['query', 'file'],
    }),
    file: Flags.file({
      char: 'f',
      exists: true,
      summary: messages.getMessage('flags.file.summary'),
      exactlyOne: ['query', 'file'],
      aliases: ['soqlqueryfile'],
      deprecateAliases: true,
    }),
    'use-tooling-api': Flags.boolean({
      char: 't',
      summary: messages.getMessage('flags.use-tooling-api.summary'),
      aliases: ['usetoolingapi'],
      deprecateAliases: true,
    }),
    'all-rows': Flags.boolean({
      summary: messages.getMessage('flags.all-rows.summary'),
    }),
    'result-format': resultFormatFlag(),
    perflog: perflogFlag,
    'output-file': Flags.file({
      summary: messages.getMessage('flags.output-file.summary'),
      relationships: [
        {
          type: 'some',
          flags: [
            {
              name: 'result-format',
              // eslint-disable-next-line @typescript-eslint/require-await
              when: async (flags): Promise<boolean> =>
                flags['result-format'] === 'csv' || flags['result-format'] === 'json',
            },
          ],
        },
      ],
    }),
  };

  private logger!: Logger;

  // will init from run
  /**
   * Command run implementation
   *
   * Returns either a DataSoqlQueryResult or a SfdxResult.
   * When the user is using global '--json' flag an instance of SfdxResult is returned.
   * This is necessary since '--json' flag reports results in the form of SfdxResult
   * and bypasses the definition of start result. The goal is to have the output
   * from '--json' and '--result-format json' be the same.
   *
   * The DataSoqlQueryResult is necessary to communicate user selections to the reporters.
   * The 'this' object available during display() function does not include user input to
   * the command, which are necessary for reporter selection.
   *
   */
  public async run(): Promise<DataQueryResult> {
    this.logger = await Logger.child('data:soql:query');
    const flags = (await this.parse(DataSoqlQueryCommand)).flags;

    try {
      // --file will be present if flags.query isn't. Oclif exactlyOne isn't quite that clever
      const queryString = flags.query ?? fs.readFileSync(flags.file as string, 'utf8');
      const conn = flags['target-org'].getConnection(flags['api-version']);
      if (flags['result-format'] !== 'json') this.spinner.start(messages.getMessage('queryRunningMessage'));
      const queryResult = await this.runSoqlQuery(
        flags['use-tooling-api'] ? conn.tooling : conn,
        queryString,
        this.logger,
        this.configAggregator.getInfo('org-max-query-limit').value as number,
        flags['all-rows']
      );

      if (flags['output-file'] ?? !this.jsonEnabled()) {
        displayResults({ ...queryResult }, flags['result-format'], flags['output-file']);
      }

      if (flags['output-file']) {
        this.log(`${queryResult.result.totalSize} records written to ${flags['output-file']}`);
        return { ...queryResult.result, outputFile: flags['output-file'] };
      } else {
        return queryResult.result;
      }
    } finally {
      if (flags['result-format'] !== 'json') this.spinner.stop();
    }
  }

  private async runSoqlQuery(
    connection: Connection | Connection['tooling'],
    query: string,
    logger: Logger,
    maxFetch = 50_000,
    allRows = false
  ): Promise<SoqlQueryResult> {
    logger.debug('running query');

    const result = await connection.query(query, {
      autoFetch: true,
      maxFetch,
      scanAll: allRows,
    });
    if (result.records.length && result.totalSize > result.records.length) {
      this.warn(
        `The query result is missing ${
          result.totalSize - result.records.length
        } records due to a ${maxFetch} record limit. Increase the number of records returned by setting the config value "org-max-query-limit" or the environment variable "SF_ORG_MAX_QUERY_LIMIT" to ${
          result.totalSize
        } or greater than ${maxFetch}.`
      );
    }

    logger.debug(`Query complete with ${result.totalSize} records returned`);

    const columns = result.totalSize ? await retrieveColumns(connection, query, logger) : [];

    return {
      query,
      columns,
      result,
    };
  }
}

const searchSubColumnsRecursively = (parent: AnyJson): string[] => {
  const column = ensureJsonMap(parent);
  const name = ensureString(column.columnName);

  const child = getArray(parent, 'joinColumns') as AnyJson[];
  return child.length ? child.map((c) => `${name}.${searchSubColumnsRecursively(c).join('.')}`) : [name];
};

/**
 * Utility to fetch the columns involved in a soql query.
 *
 * Columns are then transformed into one of three types, Field, SubqueryField and FunctionField. List of
 * fields is returned as the product.
 *
 * @param connection
 * @param query
 * @param logger
 */

export const retrieveColumns = async (
  connection: Connection | Connection['tooling'],
  query: string,
  logger?: Logger
): Promise<Field[]> => {
  logger?.debug('fetching columns for query');
  // eslint-disable-next-line no-underscore-dangle
  const columnUrl = `${connection._baseUrl()}/query?q=${encodeURIComponent(query)}&columns=true`;
  const results = toJsonMap(await connection.request<jsforceRecord>(columnUrl));

  return recursivelyFindColumns(ensureJsonArray(results.columnMetadata));
};

const recursivelyFindColumns = (data: JsonArray): Field[] => {
  const columns: Field[] = [];
  for (let column of data) {
    column = ensureJsonMap(column);
    const name = ensureString(column.columnName);

    if (isJsonArray(column.joinColumns) && column.joinColumns.length > 0) {
      if (column.aggregate) {
        const field: Field = {
          fieldType: FieldType.subqueryField,
          name,
          fields: [],
        };
        for (let subcolumn of column.joinColumns) {
          subcolumn = ensureJsonMap(subcolumn);
          if (isJsonArray(column.joinColumns) && column.joinColumns.length > 0) {
            if (field.fields) field.fields.push(...recursivelyFindColumns([subcolumn]));
          } else {
            const f: Field = {
              fieldType: FieldType.field,
              name: ensureString(ensureJsonMap(subcolumn).columnName),
            };
            if (field.fields) field.fields.push(f);
          }
        }
        columns.push(field);
      } else {
        for (const subcolumn of column.joinColumns) {
          const allSubFieldNames = searchSubColumnsRecursively(subcolumn);
          for (const subFields of allSubFieldNames) {
            columns.push({
              fieldType: FieldType.field,
              name: `${name}.${subFields}`,
            });
          }
        }
      }
    } else if (column.aggregate) {
      const field: Field = {
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
