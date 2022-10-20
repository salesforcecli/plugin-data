/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
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
import { SfCommand, Flags, Ux } from '@salesforce/sf-plugins-core';
import { CsvReporter, FormatTypes, HumanReporter, JsonReporter } from '../../../../reporters';
import { Field, FieldType, SoqlQueryResult } from '../../../../dataSoqlQueryTypes';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');
const commonMessages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export class DataSoqlQueryCommand extends SfCommand<unknown> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);

  public static flags = {
    query: Flags.string({
      char: 'q',
      summary: messages.getMessage('queryToExecute'),
      exactlyOne: ['query', 'soqlqueryfile'],
    }),
    'target-org': Flags.requiredOrg({
      required: true,
      char: 'u',
      summary: messages.getMessage('targetusername'),
      aliases: ['targetusername'],
    }),
    soqlqueryfile: Flags.file({
      char: 'f',
      exists: true,
      summary: messages.getMessage('soqlqueryfile'),
      exactlyOne: ['query', 'soqlqueryfile'],
    }),
    usetoolingapi: Flags.boolean({
      char: 't',
      summary: messages.getMessage('queryToolingDescription'),
    }),
    bulk: Flags.boolean({
      char: 'b',
      default: false,
      summary: messages.getMessage('bulkDescription'),
      exclusive: ['usetoolingapi'],
    }),
    wait: Flags.duration({
      unit: 'minutes',
      char: 'w',
      summary: messages.getMessage('waitDescription'),
      dependsOn: ['bulk'],
    }),
    // TODO: use union type from
    resultformat: Flags.enum({
      char: 'r',
      summary: messages.getMessage('resultFormatDescription'),
      options: ['human', 'json', 'csv'],
      default: 'human',
    }),
    perflog: Flags.boolean({
      summary: commonMessages.getMessage('perfLogLevelOption'),
      hidden: true,
      deprecated: {
        version: '57',
      },
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
      // soqlqueryfile will be be present if flags.query isn't. Oclif exactlyOne isn't quite that clever
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const queryString = flags.query ?? fs.readFileSync(flags.soqlqueryfile!, 'utf8');
      const conn = flags['target-org'].getConnection();
      const ux = new Ux({ jsonEnabled: this.jsonEnabled() });
      if (flags.resultformat !== 'json') this.spinner.start(messages.getMessage('queryRunningMessage'));
      const queryResult = flags.bulk
        ? await runBulkSoqlQuery(conn, queryString, flags.wait, ux)
        : await runSoqlQuery(
            flags.usetoolingapi ? conn.tooling : conn,
            queryString,
            this.logger,
            ux,
            this.configAggregator.getInfo('org-max-query-limit').value as number
          );
      if (!this.jsonEnabled()) {
        // TODO: make the enum or string/options work correctly
        displayResults({ ...queryResult }, flags.resultformat as keyof typeof FormatTypes);
      }
      return queryResult.result;
    } finally {
      if (flags.resultformat !== 'json') this.spinner.stop();
    }
  }
}

export const displayResults = (queryResult: SoqlQueryResult, resultFormat: keyof typeof FormatTypes): void => {
  let reporter;
  switch (resultFormat) {
    case 'human':
      reporter = new HumanReporter(queryResult, queryResult.columns);
      break;
    case 'json':
      reporter = new JsonReporter(queryResult, queryResult.columns);
      break;
    case 'csv':
      reporter = new CsvReporter(queryResult, queryResult.columns);
      break;
  }
  // delegate to selected reporter
  reporter.display();
};

/**
 * transforms Bulk 2.0 results to match the SOQL query results
 *
 * @param results results object
 * @param query query string
 */
export const transformBulkResults = (results: Record[], query: string): SoqlQueryResult => {
  /*
    bulk queries return a different payload, it's a [{column: data}, {column: data}]
    so we just need to grab the first object, find the keys (columns) and create the columns
     */
  const columns: Field[] = Object.keys(results[0] ?? {}).map((name) => ({
    fieldType: FieldType.field,
    name,
  }));

  return {
    columns,
    result: { done: true, records: results, totalSize: results.length },
    query,
  };
};

/**
 * Executs a SOQL query using the bulk 2.0 API
 *
 * @param connection
 * @param query
 * @param timeout
 * @param jsonEnabled
 */
const runBulkSoqlQuery = async (
  connection: Connection,
  query: string,
  timeout: Duration = Duration.seconds(10),
  ux: Ux
): Promise<SoqlQueryResult> => {
  connection.bulk2.pollTimeout = timeout.milliseconds ?? Duration.minutes(5).milliseconds;
  let res: Record[];
  try {
    res = (await connection.bulk2.query(query)) ?? [];
    return transformBulkResults(res, query);
  } catch (e) {
    const err = e as Error & { jobId: string };
    if (timeout.minutes === 0 && err.message.includes('Polling time out')) {
      // async query, so we can't throw an error, suggest force:data:query:report --queryid <id>
      ux.log(messages.getMessage('bulkQueryTimeout', [err.jobId, err.jobId, connection.getUsername()]));
      return { columns: [], result: { done: false, records: [], totalSize: 0, id: err.jobId }, query };
    } else {
      throw SfError.wrap(err);
    }
  }
};

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

export const runSoqlQuery = async (
  connection: Connection | Connection['tooling'],
  query: string,
  logger: Logger,
  ux: Ux,
  maxFetch = 50000
): Promise<SoqlQueryResult> => {
  logger.debug('running query');

  const options = {
    autoFetch: true,
    maxFetch,
  };
  const result = await connection.query(query, options);
  if (result.records.length && result.totalSize > result.records.length) {
    ux.warn(
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
};
