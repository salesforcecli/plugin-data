/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfdxCommand } from '@salesforce/command';
import { AnyJson, Dictionary, get, Nullable } from '@salesforce/ts-types';
import { fs, Messages, Org, SfdxError } from '@salesforce/core';
import { BaseConnection, ErrorResult, Record, SObject } from 'jsforce';
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore because jsforce doesn't export http-api
import * as HttpApi from 'jsforce/lib/http-api';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export interface Metric {
  requestPath: string;
  perfMetrics: AnyJson;
}
interface Result {
  status: number;
  result: AnyJson;
  perfMetrics?: Metric[];
}

interface Response {
  headers: AnyJson & { perfmetrics?: string };
  req: { path: string };
}

type ConnectionInternals = { callOptions?: { perfOption?: string } };

const originalRequestMethod = HttpApi.prototype.request;
HttpApi.prototype.request = function (req: unknown, ...args: unknown[]): unknown {
  this.once('response', (response: Response) => {
    const metrics = response.headers.perfmetrics;
    if (metrics) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      DataCommand.addMetric({
        requestPath: response.req.path,
        perfMetrics: JSON.parse(metrics),
      });
    }
  });
  return originalRequestMethod.call(this, req, ...args);
};

export abstract class DataCommand extends SfdxCommand {
  private static metrics: Metric[] = [];
  // Ensured by requiresUsername
  public org!: Org;

  public static addMetric(metric: Metric): void {
    DataCommand.metrics.push(metric);
  }

  public static getMetrics(): Metric[] {
    return DataCommand.metrics;
  }

  public validateIdXorWhereFlags(): void {
    if (!this.flags.where && !this.flags.sobjectid) {
      throw new SfdxError(messages.getMessage('NeitherSobjectidNorWhereError'), 'NeitherSobjectidNorWhereError', [
        messages.getMessage('NeitherSobjectidNorWhereErrorActions'),
      ]);
    }
  }

  public collectErrorMessages(result: ErrorResult): string {
    let errors = '';
    if (result.errors) {
      errors = '\nErrors:\n';
      result.errors.forEach((err) => {
        errors += '  ' + err + '\n';
      });
    }
    return errors;
  }

  public async throwIfFileDoesntExist(path: string): Promise<void> {
    if (!(await fs.fileExists(path))) {
      throw new SfdxError(messages.getMessage('PathDoesNotExist', [path]), 'PathDoesNotExist');
    }
  }

  public getJsonResultObject(result = this.result.data, status = process.exitCode || 0): Result {
    const final: Result = { status, result };
    const perfMetrics = DataCommand.getMetrics();
    if (perfMetrics.length) final.perfMetrics = perfMetrics;
    return final;
  }

  public getConnection(): BaseConnection {
    const connection: BaseConnection & ConnectionInternals = this.flags.usetoolingapi
      ? this.org.getConnection().tooling
      : this.org.getConnection();

    if (this.flags.perflog) {
      if (!connection.callOptions) {
        connection.callOptions = {};
      }
      connection.callOptions.perfOption = 'MINIMUM';
    }
    return connection;
  }

  public async query(sobject: SObject<object>, where: string): Promise<Record<AnyJson>> {
    const queryObject = this.stringToDictionary(where);
    const records = await sobject.find(queryObject, 'id');
    if (!records || records.length === 0) {
      throw new SfdxError('DataRecordGetNoRecord', messages.getMessage('DataRecordGetNoRecord'));
    }

    if (records.length > 1) {
      throw new SfdxError(
        'DataRecordGetMultipleRecords',
        messages.getMessage('DataRecordGetMultipleRecords', [where, this.flags.sobjecttype, records.length])
      );
    }

    return this.normalize<Record<AnyJson>>(records);
  }

  protected stringToDictionary(str: string): Dictionary<string> {
    const keyValuePairs = this.parseKeyValueSequence(str);
    return this.transformKeyValueSequence(keyValuePairs);
  }

  protected normalize<T>(results: T | T[]): T {
    // jsforce returns RecordResult | RecordResult[]
    // but we're only ever dealing with a single sobject we are guaranteed to
    // get back a single RecordResult. Nevertheless, we ensure that it's a
    // single RecordResult to make Typescript happy
    return Array.isArray(results) ? results[0] : results;
  }

  protected logNestedObject(obj: object, indentation = 0): void {
    const space = ' '.repeat(indentation);
    Object.keys(obj).forEach((key) => {
      const value = get(obj, key, null) as Nullable<string | object>;
      if (!!value && typeof value === 'object') {
        this.ux.log(`${space}${key}:`);
        this.logNestedObject(value, indentation + 2);
      } else {
        this.ux.log(`${space}${key}: ${value as string}`);
      }
    });
  }

  /**
   * Takes a sequence of key=value string pairs and produces an object out of them.
   * If you repeat the key, it replaces the value with the subsequent value.
   *
   * @param [keyValuePairs] - The list of key=value pair strings.
   */
  private transformKeyValueSequence(keyValuePairs: string[]): Dictionary<string> {
    const constructedObject: Dictionary<string> = {};

    keyValuePairs.forEach((pair) => {
      // Look for the *first* '=' and splits there, ignores any subsequent '=' for this pair
      const eqPosition = pair.indexOf('=');
      if (eqPosition === -1) {
        throw new Error(messages.getMessage('TextUtilMalformedKeyValuePair', [pair]));
      } else {
        const key = pair.substr(0, eqPosition);
        constructedObject[key] = pair.substr(eqPosition + 1);
      }
    });

    return constructedObject;
  }

  /**
   * Splits a sequence of 'key=value key="leftValue rightValue"   key=value'
   * into a list of key=value pairs, paying attention to quoted whitespace.
   *
   * This is NOT a full push down-automaton so do NOT expect full error handling/recovery.
   *
   * @param {string} text - The sequence to split
   */
  private parseKeyValueSequence(text: string): string[] {
    const separator = /\s/;

    let inSingleQuote = false;
    let inDoubleQuote = false;
    let currentToken: string[] = [];
    const keyValuePairs: string[] = [];

    const trimmedText = text.trim();
    for (const currentChar of trimmedText) {
      const isSeparator = separator.exec(currentChar);

      if (currentChar === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      } else if (currentChar === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote && isSeparator) {
        if (currentToken.length > 0) {
          keyValuePairs.push(currentToken.join(''));
          currentToken = [];
        }
      } else {
        currentToken.push(currentChar);
      }
    }

    // For the case of only one key=value pair with no separator
    if (currentToken.length > 0) {
      keyValuePairs.push(currentToken.join(''));
    }

    return keyValuePairs;
  }
}
