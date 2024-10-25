/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
  /*
this was my attempt to fix relationship lookups in the export query field for the generic case, it eventually failed due to the soql query
having hardcoded fields to lookup. RecordTypes have  an SobjectType field, but not every relationship will
TODO: figure out a generic way to import records queried like
"SELECT RecordType.Name, Account.Name FROM Asset"
 */
  // for (const entry of Object.values(partWithRefsReplaced.records)) {
  //   for (const [subType, value] of Object.entries(entry)) {
  //     if ((value as { attributes: { type: string }; Name: string }).attributes) {
  //       const info = value as { attributes: { type: string }; Name: string };
  //       // eslint-disable-next-line no-await-in-loop
  //       const newid = await conn.singleRecordQuery<{ Id: string }>(
  //         `SELECT Id FROM ${info.attributes.type} WHERE Name = '${info.Name}' AND SobjectType='${entry.attributes.type}'`
  //       );
  //       delete entry[subType];
  //       entry[`${subType}Id`] = newid.Id;
  //     }
  //   }
  // }
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
