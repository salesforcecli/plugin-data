/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages, Connection, SfdxError } from '@salesforce/core';
import { AnyJson, Dictionary } from '@salesforce/ts-types';
import * as jsforce from 'jsforce';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/data', 'messages');

export type SObjectRecord = jsforce.Record<AnyJson>;
export type SObjectResult = jsforce.RecordResult;
export type SObjectErrorResult = jsforce.ErrorResult;

interface Options {
  connection: Connection;
  sObjectType: string;
  useToolingApi?: boolean;
}

/**
 * Takes a sequence of key=value string pairs and produces an object out of them.
 * If you repeat the key, it replaces the value with the subsequent value.
 *
 * @param [keyValuePairs] - The list of key=value pair strings.
 */
function transformKeyValueSequence(keyValuePairs: string[]): Dictionary<string> {
  const constructedObject: Dictionary<string> = {};

  keyValuePairs.forEach((pair) => {
    // Look for the *first* '=' and splits there, ignores any subsequent '=' for this pair
    const eqPosition = pair.indexOf('=');
    if (eqPosition === -1) {
      throw new Error(messages.getMessage('TextUtilMalformedKeyValuePair', [pair]));
    } else {
      const key = pair.substr(0, eqPosition);
      const value = pair.substr(eqPosition + 1);
      constructedObject[key] = value;
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
function parseKeyValueSequence(text: string): string[] {
  const separator = /\s/;

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let currentToken: string[] = [];
  const keyValuePairs: string[] = [];

  const trimmedText = text.trim();
  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < trimmedText.length; i++) {
    const currentChar = trimmedText[i];
    // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
    const isSeparator = currentChar.match(separator);

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

function stringToDictionary(str: string): Dictionary<string> {
  const keyValuePairs = parseKeyValueSequence(str);
  return transformKeyValueSequence(keyValuePairs);
}

export class SObject {
  private connection: Connection;
  private useToolingApi: boolean;
  private sObjectType: string;

  public constructor(options: Options) {
    this.connection = options.connection;
    this.useToolingApi = options.useToolingApi || false;
    this.sObjectType = options.sObjectType;
  }

  public async insert(values: string): Promise<SObjectResult> {
    const insertObject = stringToDictionary(values);
    const results = this.useToolingApi
      ? await this.connection.tooling.create(this.sObjectType, insertObject)
      : await this.connection.sobject(this.sObjectType).create(insertObject);

    return this.normalize<SObjectResult>(results);
  }

  public async delete(sObjectId: string): Promise<SObjectResult> {
    const results = this.useToolingApi
      ? await this.connection.tooling.destroy(this.sObjectType, sObjectId)
      : await this.connection.sobject(this.sObjectType).destroy(sObjectId);
    return this.normalize<SObjectResult>(results);
  }

  public async retrieve(sObjectId: string): Promise<SObjectRecord> {
    const record = this.useToolingApi
      ? await this.connection.tooling.retrieve(this.sObjectType, sObjectId)
      : await this.connection.sobject(this.sObjectType).retrieve(sObjectId);
    return this.normalize<SObjectRecord>(record);
  }

  public async update(sObjectId: string, values: string): Promise<SObjectResult> {
    const updateObject: SObjectRecord = stringToDictionary(values);
    updateObject.Id = sObjectId;
    const results = this.useToolingApi
      ? await this.connection.tooling.update(this.sObjectType, updateObject)
      : await this.connection.sobject(this.sObjectType).update(updateObject);
    return this.normalize<SObjectResult>(results);
  }

  public async query(where: string): Promise<SObjectRecord> {
    const queryObject = stringToDictionary(where);
    const records = this.useToolingApi
      ? await this.connection.tooling.sobject(this.sObjectType).find(queryObject, 'id')
      : await this.connection.sobject(this.sObjectType).find(queryObject, 'id');

    if (!records || records.length === 0) {
      throw new SfdxError('DataRecordGetNoRecord', messages.getMessage('DataRecordGetNoRecord'));
    }

    if (records.length > 1) {
      throw new SfdxError(
        'DataRecordGetMultipleRecords',
        messages.getMessage('DataRecordGetMultipleRecords', [where, this.sObjectType, records.length])
      );
    }

    return this.normalize<SObjectRecord>(records);
  }

  private normalize<T>(results: T | T[]): T {
    // jsforce returns RecordResult | RecordResult[]
    // but we're only ever dealing with a single sobject we are guaranteed to
    // get back a single RecordResult. Nevertheless, we ensure that it's a
    // single RecordResult to make Typescript happy
    return Array.isArray(results) ? results[0] : results;
  }
}
