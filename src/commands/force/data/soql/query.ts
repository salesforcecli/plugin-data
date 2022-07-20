/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, UX } from '@salesforce/command';
import { CliUx } from '@oclif/core';
import { Connection, Logger, Messages, SfdxConfigAggregator, SfError } from '@salesforce/core';
import { QueryOptions, QueryResult, Record } from 'jsforce';
import {
  AnyJson,
  ensureJsonArray,
  ensureJsonMap,
  ensureString,
  getArray,
  getNumber,
  isJsonArray,
  JsonArray,
  toJsonMap,
} from '@salesforce/ts-types';
import { Duration } from '@salesforce/kit';
import { CsvReporter, FormatTypes, HumanReporter, JsonReporter } from '../../../../reporters';
import { Field, FieldType, SoqlQueryResult } from '../../../../dataSoqlQueryTypes';
import { DataCommand } from '../../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');
const commonMessages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

/**
 * Class to handle a soql query
 *
 * Will collect all records and the column metadata of the query
 */
export class SoqlQuery {
  /**
   * Executs a SOQL query using the bulk 2.0 API
   *
   * @param connection
   * @param query
   * @param timeout
   * @param ux
   */
  public async runBulkSoqlQuery(
    connection: Connection,
    query: string,
    timeout: Duration = Duration.seconds(10),
    ux: UX
  ): Promise<SoqlQueryResult> {
    connection.bulk.v2.pollTimeout = timeout.milliseconds ?? Duration.minutes(5).milliseconds;
    let res: Record[];
    try {
      res = (await connection.bulk.v2.query(query)) ?? [];
      return this.transformBulkResults(res, query);
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
  }

  /**
   * transforms Bulk 2.0 results to match the SOQL query results
   *
   * @param results results object
   * @param query query string
   */
  public transformBulkResults(results: Record[], query: string): SoqlQueryResult {
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
  }

  public async runSoqlQuery(
    connection: Connection,
    query: string,
    logger: Logger,
    configAgg: SfdxConfigAggregator
  ): Promise<SoqlQueryResult> {
    logger.debug('running query');

    // take the limit from the config, then default 50,000
    const queryOpts: Partial<QueryOptions> = {
      autoFetch: true,
      maxFetch: (configAgg.getInfo('maxQueryLimit').value as number) ?? 50000,
    };

    const result: QueryResult<Record> = await new Promise((resolve, reject) => {
      const records: Record[] = [];
      const res = connection
        .query(query)
        .on('record', (rec) => records.push(rec))
        .on('error', (err) => reject(err))
        .on('end', () => {
          resolve({
            done: true,
            totalSize: getNumber(res, 'totalSize', 0),
            records,
          });
        })
        .run(queryOpts);
    });

    if (result.records.length && result.totalSize > result.records.length) {
      CliUx.ux.warn(
        `The query result is missing ${result.totalSize - result.records.length} records due to a ${
          queryOpts.maxFetch
        } record limit. Increase the number of records returned by setting the config value "maxQueryLimit" or the environment variable "SFDX_MAX_QUERY_LIMIT" to ${
          result.totalSize
        } or greater than ${queryOpts.maxFetch}.`
      );
    }

    logger.debug(`Query complete with ${result.totalSize} records returned`);

    const columns = result.totalSize ? await this.retrieveColumns(connection, query, logger) : [];

    return {
      query,
      columns,
      result,
    };
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

  public async retrieveColumns(connection: Connection, query: string, logger?: Logger): Promise<Field[]> {
    logger?.debug('fetching columns for query');
    // eslint-disable-next-line no-underscore-dangle
    const columnUrl = `${connection._baseUrl()}/query?q=${encodeURIComponent(query)}&columns=true`;
    const results = toJsonMap(await connection.request<Record>(columnUrl));

    return this.recursivelyFindColumns(ensureJsonArray(results.columnMetadata));
  }

  private recursivelyFindColumns(data: JsonArray): Field[] {
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
              if (field.fields) field.fields.push(...this.recursivelyFindColumns([subcolumn]));
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
            const allSubFieldNames = this.searchSubColumnsRecursively(subcolumn);
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
  }

  private searchSubColumnsRecursively(parent: AnyJson): string[] {
    const column = ensureJsonMap(parent);
    const name = ensureString(column.columnName);

    let names = [name];
    const child = getArray(parent, 'joinColumns') as AnyJson[];
    if (child.length) {
      // if we're recursively searching, reset the 'parent' - it gets added back below
      names = [];
      // recursively search for related column names
      child.map((c) => names.push(`${name}.${this.searchSubColumnsRecursively(c).join('.')}`));
    }
    return names;
  }
}

export class DataSoqlQueryCommand extends DataCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly requiresUsername = true;
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    query: flags.string({
      char: 'q',
      required: true,
      description: messages.getMessage('queryToExecute'),
    }),
    usetoolingapi: flags.boolean({
      char: 't',
      description: messages.getMessage('queryToolingDescription'),
    }),
    bulk: flags.boolean({
      char: 'b',
      default: false,
      description: messages.getMessage('bulkDescription'),
      exclusive: ['usetoolingapi'],
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('waitDescription'),
      dependsOn: ['bulk'],
    }),
    resultformat: flags.enum({
      char: 'r',
      description: messages.getMessage('resultFormatDescription'),
      options: ['human', 'csv', 'json'],
      default: 'human',
    }),
    perflog: flags.boolean({
      description: commonMessages.getMessage('perfLogLevelOption'),
      dependsOn: ['json'],
    }),
  };

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
    try {
      if (this.flags.resultformat !== 'json') this.ux.startSpinner(messages.getMessage('queryRunningMessage'));
      const query = this.flags.query as string;
      let queryResult: SoqlQueryResult;
      const soqlQuery = new SoqlQuery();

      if (this.flags.bulk) {
        queryResult = await soqlQuery.runBulkSoqlQuery(this.org!.getConnection(), query, this.flags.wait, this.ux);
      } else {
        queryResult = await soqlQuery.runSoqlQuery(
          this.getConnection() as Connection,
          query,
          this.logger,
          this.configAggregator
        );
      }

      this.displayResults({ ...queryResult });
      return queryResult.result;
    } finally {
      if (this.flags.resultformat !== 'json') this.ux.stopSpinner();
    }
  }

  public displayResults(queryResult: SoqlQueryResult): void {
    // bypass if --json flag present
    if (!this.flags.json) {
      let reporter;
      switch (this.flags.resultformat as keyof typeof FormatTypes) {
        case 'human':
          reporter = new HumanReporter(queryResult, queryResult.columns, this.ux, this.logger);
          break;
        case 'json':
          reporter = new JsonReporter(queryResult, queryResult.columns, this.ux, this.logger);
          break;
        case 'csv':
          reporter = new CsvReporter(queryResult, queryResult.columns, this.ux, this.logger);
          break;
        default:
          throw new Error(`result format is invalid: ${this.flags.resultformat as string}`);
      }
      // delegate to selected reporter
      reporter.display();
    }
  }
}
