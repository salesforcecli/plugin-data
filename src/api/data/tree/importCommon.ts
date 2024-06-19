/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection, SfError, Messages } from '@salesforce/core';
import type { SObjectTreeInput, SObjectTreeFileContents } from '../../../types.js';
import type { ResponseRefs, TreeResponse } from './importTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'importApi');

/** makes the API request */
export const sendSObjectTreeRequest =
  (conn: Connection) =>
  (sobject: string) =>
  (rawContents: string): Promise<TreeResponse> =>
    // post request with to-be-insert sobject tree content
    conn.request({
      method: 'POST',
      url: `/composite/tree/${sobject}`,
      body: rawContents,
      headers: {
        'content-type': 'application/json',
      },
    });

/** handle an error throw by sendSObjectTreeRequest.  Always throws */
export const treeSaveErrorHandler = (error: unknown): never => {
  if (error instanceof Error && 'errorCode' in error && error.errorCode === 'INVALID_FIELD') {
    const field = error.message.split("'")[1];
    const object = error.message.slice(error.message.lastIndexOf(' ') + 1, error.message.length);
    throw messages.createError('FlsError', [field, object]);
  }
  if (error instanceof Error) {
    throw SfError.wrap(error);
  }
  throw error;
};

export const parseDataFileContents =
  (filePath: string) =>
  (contents: string): SObjectTreeInput[] => {
    if (!contents) {
      throw messages.createError('dataFileEmpty', [filePath]);
    }
    return (JSON.parse(contents) as SObjectTreeFileContents).records;
  };

/** look inside the response. If the hasErrors property is true, throw a formatted error.  Otherwise, extract the results property */
export const getResultsIfNoError =
  (filePath: string) =>
  (response: TreeResponse): ResponseRefs[] => {
    if (response.hasErrors === true) {
      throw messages.createError('dataImportFailed', [filePath, JSON.stringify(response.results, null, 4)]);
    }
    return response.results;
  };
