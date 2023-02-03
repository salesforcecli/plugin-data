/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection, Messages, SfError } from '@salesforce/core';
import { Record as jsforceRecord, SaveResult } from 'jsforce';

import { ux } from '@oclif/core';
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export const logNestedObject = (obj: Record<string, unknown>, indentation = 0): void => {
  const space = ' '.repeat(indentation);
  Object.entries(obj).forEach(([key, value]) => {
    if (!!value && typeof value === 'object') {
      ux.log(`${space}${key}:`);
      logNestedObject(value as Record<string, unknown>, indentation + 2);
    } else {
      ux.log(`${space}${key}: ${value as string}`);
    }
  });
};
/**
 * Takes a sequence of key=value string pairs and produces an object out of them.
 * If you repeat the key, it replaces the value with the subsequent value.
 *
 * @param [keyValuePairs] - The list of key=value pair strings.
 */
const transformKeyValueSequence = (
  keyValuePairs: string[]
): Record<string, string | boolean | Record<string, unknown>> => {
  const constructedObject: Record<string, string | boolean | Record<string, unknown>> = {};

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
          constructedObject[key] = convertToBooleanIfApplicable(pair.substr(eqPosition + 1));
        }
      } else {
        constructedObject[key] = convertToBooleanIfApplicable(pair.substr(eqPosition + 1));
      }
    }
  });

  return constructedObject;
};

const convertToBooleanIfApplicable = (input: string): boolean | string => {
  if (input.trim().toLowerCase() === 'false') return false;
  if (input.trim().toLowerCase() === 'true') return true;
  return input;
};

/**
 * Splits a sequence of 'key=value key="leftValue rightValue"   key=value'
 * into a list of key=value pairs, paying attention to quoted whitespace.
 *
 * This is NOT a full push down-automaton so do NOT expect full error handling/recovery.
 *
 * @param {string} text - The sequence to split
 */
const parseKeyValueSequence = (text: string): string[] => {
  const separator = /\s/;

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let currentToken: string[] = [];
  const keyValuePairs: string[] = [];

  const trimmedText = text.trim();

  const singleQuoteCount = (trimmedText.match(/'/g) ?? []).length;
  const doubleQuoteCount = (trimmedText.match(/"/g) ?? []).length;

  for (const currentChar of trimmedText) {
    const isSeparator = separator.test(currentChar);

    if (currentChar === "'" && !inDoubleQuote && singleQuoteCount >= 2) {
      inSingleQuote = !inSingleQuote;
      continue;
    } else if (currentChar === '"' && !inSingleQuote && doubleQuoteCount >= 2) {
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
};

export const stringToDictionary = (str: string): Record<string, string | boolean | Record<string, unknown>> => {
  const keyValuePairs = parseKeyValueSequence(str);
  return transformKeyValueSequence(keyValuePairs);
};

export const collectErrorMessages = (result: SaveResult): string =>
  result.success === false ? ['\nErrors:', ...result.errors.map((err) => `  ${err.message}`)].join('\n') : '';

export const query = async (
  conn: Connection | Connection['tooling'],
  objectType: string,
  where: string
): Promise<jsforceRecord> => {
  const queryObject = stringToDictionary(where);
  const sobject = conn.sobject(objectType);
  const records = await sobject.find(queryObject, 'id');
  if (!records || records.length === 0) {
    throw new SfError(messages.getMessage('DataRecordGetNoRecord'), 'DataRecordGetNoRecord');
  }

  if (records.length > 1) {
    throw new SfError(
      messages.getMessage('DataRecordGetMultipleRecords', [where, objectType, records.length]),
      'DataRecordGetMultipleRecords'
    );
  }
  return records[0];
};
