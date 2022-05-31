/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig } from '@salesforce/command';
import { CliUx } from '@oclif/core';
import { Connection, Logger, Messages, SfdxConfigAggregator } from '@salesforce/core';
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
  public async runSoqlQuery(
    connection: Connection,
    query: string,
    logger: Logger,
    configAgg: SfdxConfigAggregator
  ): Promise<SoqlQueryResult> {
    let columns: Field[] = [];
    logger.debug('running query');

    // take the limit from the config, then default 50,000
    const queryOpts: Partial<QueryOptions> = {
      autoFetch: true,
      maxFetch: (configAgg.getInfo('maxQueryLimit').value as number) || 50000,
    };

    const records: Record[] = [];

    // eslint-disable-next-line @typescript-eslint/no-misused-promises,no-async-promise-executor
    const result: QueryResult<Record> = await new Promise(async (resolve, reject) => {
      const res = await connection
        .query(query, queryOpts)
        .on('record', (rec) => records.push(rec))
        .on('error', (err) => reject(err))
        .on('end', () => {
          resolve({
            done: true,
            totalSize: getNumber(res, 'totalSize', 0),
            records,
          });
        });
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
    if (result.totalSize) {
      logger.debug('fetching columns for query');
      columns = await this.retrieveColumns(connection, query);
    }

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

  public async retrieveColumns(connection: Connection, query: string): Promise<Field[]> {
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
      const query = new SoqlQuery();
      const conn = this.getConnection();
      const queryResult: SoqlQueryResult = await query.runSoqlQuery(
        conn as Connection,
        this.flags.query,
        this.logger,
        this.configAggregator
      );
      const results = {
        ...queryResult,
      };
      this.displayResults(results);
      return queryResult.result;
    } finally {
      if (this.flags.resultformat !== 'json') this.ux.stopSpinner();
    }
  }

  private displayResults(queryResult: SoqlQueryResult): void {
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
