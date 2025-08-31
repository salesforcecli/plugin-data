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
import { Connection, SfError, Messages } from '@salesforce/core';
import { getObject, getString } from '@salesforce/ts-types';
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

export const transformRecordTypeEntries = async (
  conn: Connection,
  records: SObjectTreeInput[]
): Promise<SObjectTreeInput[]> => {
  await Promise.all(
    records.map(async (record) => {
      const recordName = getString(record, 'RecordType.Name');
      if (recordName) {
        const targetRecordTypeId = (
          await conn.singleRecordQuery<{ Id: string }>(
            `SELECT Id FROM RecordType WHERE Name = '${recordName}' AND SobjectType='${record.attributes.type}'`
          )
        ).Id;
        delete record['RecordType'];
        record['RecordTypeId'] = targetRecordTypeId;
      } else if (getObject(record, 'RecordType') && !recordName) {
        throw messages.createError('error.noRecordTypeName');
      }
    })
  );

  return records;
};

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
