/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fse from 'fs-extra';
import { SfdxCommand } from '@salesforce/command';
import { AnyJson, Dictionary, get, Nullable } from '@salesforce/ts-types';
import { Connection, Messages, Org, SfError } from '@salesforce/core';
import { Record as jsforceRecord, SaveResult, SObject } from 'jsforce';

import * as HttpApi from 'jsforce/lib/http-api';
import { Tooling } from '@salesforce/core/lib/org';

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

/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/unbound-method
const originalRequestMethod = HttpApi.default.prototype.request;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
HttpApi.default.prototype.request = function (req: unknown, ...args: unknown[]): unknown {
  this.once('response', (response: Response) => {
    const metrics = response.headers.perfmetrics;
    if (metrics) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      DataCommand.addMetric({
        requestPath: response.req.path,
        perfMetrics: JSON.parse(metrics) as AnyJson,
      });
    }
  });
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return originalRequestMethod.call(this, req, ...args);
};

/* eslint-enable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call*/

export abstract class DataCommand extends SfdxCommand {
  private static metrics: Metric[] = [];

  public static addMetric(metric: Metric): void {
    DataCommand.metrics.push(metric);
  }

  public static getMetrics(): Metric[] {
    return DataCommand.metrics;
  }

  public validateIdXorWhereFlags(): void {
    if (!this.flags.where && !this.flags.sobjectid) {
      throw new SfError(messages.getMessage('NeitherSobjectidNorWhereError'), 'NeitherSobjectidNorWhereError', [
        messages.getMessage('NeitherSobjectidNorWhereErrorActions'),
      ]);
    }
  }

  public collectErrorMessages(result: SaveResult): string {
    let errors = '';
    if (result.errors) {
      errors = '\nErrors:\n';
      result.errors.map((err) => {
        errors += '  ' + err?.message + '\n';
      });
    }
    return errors;
  }

  public async throwIfFileDoesntExist(path: string): Promise<void> {
    if (!(await fse.pathExists(path))) {
      throw new SfError(messages.getMessage('PathDoesNotExist', [path]), 'PathDoesNotExist');
    }
  }

  public getJsonResultObject(result = this.result.data, status = process.exitCode || 0): Result {
    const final: Result = { status, result };
    const perfMetrics = DataCommand.getMetrics();
    if (perfMetrics.length) final.perfMetrics = perfMetrics;
    return final;
  }

  /**
   * Necessary where plugin commands are extending a base class that extends SfdxCommand
   *
   * @returns Org
   */
  public ensureOrg(): Org {
    if (!this.org) {
      throw new Error(
        'This command requires a username. Specify it with the -u parameter or with the "sfdx config:set defaultusername=<username>" command.'
      );
    }
    return this.org;
  }

  public getConnection(): (Tooling | Connection) & ConnectionInternals {
    const safeOrg = this.ensureOrg();
    const connection: (Tooling | Connection) & ConnectionInternals = this.flags.usetoolingapi
      ? safeOrg.getConnection().tooling
      : safeOrg.getConnection();

    if (this.flags.perflog) {
      if (!connection.callOptions) {
        connection.callOptions = {};
      }
      connection.callOptions.perfOption = 'MINIMUM';
    }
    return connection;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore enable any typing here
  public async query(sobject: SObject<unknown>, where: string): Promise<jsforceRecord> {
    const queryObject = this.stringToDictionary(where);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const records = await sobject.find(queryObject, 'id');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!records || records.length === 0) {
      throw new SfError('DataRecordGetNoRecord', messages.getMessage('DataRecordGetNoRecord'));
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (records.length > 1) {
      throw new SfError(
        'DataRecordGetMultipleRecords',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        messages.getMessage('DataRecordGetMultipleRecords', [where, this.flags.sobjecttype, records.length])
      );
    }

    return this.normalize<jsforceRecord>(records);
  }

  protected stringToDictionary(str: string): Dictionary<string | boolean | Record<string, unknown>> {
    const keyValuePairs = this.parseKeyValueSequence(str);
    return this.transformKeyValueSequence(keyValuePairs);
  }

  protected normalize<T>(results: T | T[]): T {
    // jsforce returns SaveResult | SaveResult[]
    // but we're only ever dealing with a single sobject we are guaranteed to
    // get back a single SaveResult. Nevertheless, we ensure that it's a
    // single SaveResult to make Typescript happy
    return Array.isArray(results) ? results[0] : results;
  }

  protected logNestedObject(obj: never, indentation = 0): void {
    const space = ' '.repeat(indentation);
    Object.keys(obj).forEach((key) => {
      const value = get(obj, key, null) as Nullable<string | never>;
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
  private transformKeyValueSequence(keyValuePairs: string[]): Dictionary<string | boolean | Record<string, unknown>> {
    const constructedObject: Dictionary<string | boolean | Record<string, unknown>> = {};

    keyValuePairs.forEach((pair) => {
      // Look for the *first* '=' and splits there, ignores any subsequent '=' for this pair
      const eqPosition = pair.indexOf('=');
      if (eqPosition === -1) {
        throw new Error(messages.getMessage('TextUtilMalformedKeyValuePair', [pair]));
      } else {
        const key = pair.substr(0, eqPosition);
        if (pair.includes('{') && pair.includes('}')) {
          try {
            constructedObject[key] = JSON.parse(pair.substr(eqPosition + 1)) as Record<string, unknown>;
          } catch {
            // the data contained { and }, but wasn't valid JSON, default to parsing as-is
            constructedObject[key] = this.convertToBooleanIfApplicable(pair.substr(eqPosition + 1));
          }
        } else {
          constructedObject[key] = this.convertToBooleanIfApplicable(pair.substr(eqPosition + 1));
        }
      }
    });

    return constructedObject;
  }

  private convertToBooleanIfApplicable(input: string): boolean | string {
    if (input.trim().toLowerCase() === 'false') return false;
    if (input.trim().toLowerCase() === 'true') return true;
    return input;
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
