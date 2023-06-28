/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { Connection, Logger, Messages, SfError } from '@salesforce/core';
import { Record } from 'jsforce';
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
import { Duration } from '@salesforce/kit';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { orgFlags, perflogFlag, resultFormatFlag } from '../../flags';
import { Field, FieldType, SoqlQueryResult } from '../../dataSoqlQueryTypes';
import { displayResults, transformBulkResults } from '../../queryUtils';
import { FormatTypes } from '../../reporters';
import { BulkQueryRequestCache } from '../../bulkDataRequestCache';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

export class DataSoqlQueryCommand extends SfCommand<unknown> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:soql:query'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    query: Flags.string({
      char: 'q',
      summary: messages.getMessage('flags.queryToExecute'),
      exactlyOne: ['query', 'file'],
    }),
    file: Flags.file({
      char: 'f',
      exists: true,
      summary: messages.getMessage('flags.file'),
      exactlyOne: ['query', 'file'],
      aliases: ['soqlqueryfile'],
      deprecateAliases: true,
    }),
    'use-tooling-api': Flags.boolean({
      char: 't',
      summary: messages.getMessage('flags.useToolingApi'),
      aliases: ['usetoolingapi'],
      deprecateAliases: true,
    }),
    bulk: Flags.boolean({
      char: 'b',
      default: false,
      summary: messages.getMessage('flags.bulk'),
      exclusive: ['use-tooling-api'],
    }),
    wait: Flags.duration({
      unit: 'minutes',
      char: 'w',
      summary: messages.getMessage('flags.wait'),
      dependsOn: ['bulk'],
      exclusive: ['async'],
    }),
    async: Flags.boolean({
      summary: messages.getMessage('flags.async'),
      dependsOn: ['bulk'],
      exclusive: ['wait'],
    }),
    'all-rows': Flags.boolean({
      summary: messages.getMessage('flags.all-rows.summary'),
    }),
    'result-format': resultFormatFlag,
    perflog: perflogFlag,
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
   * from '--json' and '--resulformat json' be the same.
   *
   * The DataSoqlQueryResult is necessary to communicate user selections to the reporters.
   * The 'this' object available during display() function does not include user input to
   * the command, which are necessary for reporter selection.
   *
   */
  public async run(): Promise<unknown> {
    this.logger = await Logger.child('data:soql:query');
    const flags = (await this.parse(DataSoqlQueryCommand)).flags;

    try {
      // soqlqueryfile will be present if flags.query isn't. Oclif exactlyOne isn't quite that clever
      const queryString = flags.query ?? fs.readFileSync(flags.file as string, 'utf8');
      const conn = flags['target-org'].getConnection(flags['api-version']);
      if (flags['result-format'] !== 'json') this.spinner.start(messages.getMessage('queryRunningMessage'));
      const queryResult = flags.bulk
        ? await this.runBulkSoqlQuery(
            conn,
            queryString,
            flags.async ? Duration.minutes(0) : flags.wait ?? Duration.minutes(0),
            flags['all-rows'] === true
          )
        : await this.runSoqlQuery(
            flags['use-tooling-api'] ? conn.tooling : conn,
            queryString,
            this.logger,
            this.configAggregator.getInfo('org-max-query-limit').value as number,
            flags['all-rows']
          );
      if (!this.jsonEnabled()) {
        displayResults({ ...queryResult }, flags['result-format'] as FormatTypes);
      }
      return queryResult.result;
    } finally {
      if (flags['result-format'] !== 'json') this.spinner.stop();
    }
  }
  /**
   * Executes a SOQL query using the bulk 2.0 API
   *
   * @param connection
   * @param query
   * @param timeout
   */
  private async runBulkSoqlQuery(
    connection: Connection,
    query: string,
    timeout: Duration,
    allRows: boolean | undefined = false
  ): Promise<SoqlQueryResult> {
    connection.bulk2.pollTimeout = timeout.milliseconds ?? Duration.minutes(5).milliseconds;
    let res: Record[];
    try {
      res = (await connection.bulk2.query(query, allRows ? { scanAll: true } : {})) ?? [];
      return transformBulkResults(res, query);
    } catch (e) {
      const err = e as Error & { jobId: string };
      if (timeout.minutes === 0 && err.message.includes('Polling time out')) {
        // async query, so we can't throw an error, suggest data:query:resume --queryid <id>
        const cache = await BulkQueryRequestCache.create();
        await cache.createCacheEntryForRequest(err.jobId, connection.getUsername(), connection.getApiVersion());
        this.log(messages.getMessage('bulkQueryTimeout', [err.jobId, err.jobId, connection.getUsername()]));
        return { columns: [], result: { done: false, records: [], totalSize: 0, id: err.jobId }, query };
      } else {
        throw SfError.wrap(err);
      }
    }
  }
  private async runSoqlQuery(
    connection: Connection | Connection['tooling'],
    query: string,
    logger: Logger,
    maxFetch: number | undefined,
    allRows: boolean | undefined = false
  ): Promise<SoqlQueryResult> {
    logger.debug('running query');

    const result = await connection.query(query, {
      autoFetch: true,
      maxFetch: maxFetch ?? 50_000,
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
  const results = toJsonMap(await connection.request<Record>(columnUrl));

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
