/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { Logger, Connection, Messages } from '@salesforce/core';
import { isFulfilled } from '@salesforce/kit';
import { flattenNestedRecords } from '../../../export.js';
import { SObjectTreeInput, isAttributesEntry } from '../../../types.js';
import {
  sendSObjectTreeRequest,
  treeSaveErrorHandler,
  parseDataFileContents,
  getResultsIfNoError,
  transformRecordTypeEntries,
} from './importCommon.js';
import type { ImportResult, ResponseRefs, TreeResponse } from './importTypes.js';
import { hasUnresolvedRefs } from './functions.js';

export type FileInfo = {
  rawContents: string;
  records: SObjectTreeInput[];
  filePath: string;
  sobject: string;
};

export const importFromFiles = async (conn: Connection, dataFilePaths: string[]): Promise<ImportResult[]> => {
  const logger = Logger.childFromRoot('data:import:tree:importSObjectTreeFile');
  const fileInfos = (await Promise.all(dataFilePaths.map(parseFile))).map(logFileInfo(logger)).map(validateNoRefs);
  await Promise.all(fileInfos.map(async (fi) => transformRecordTypeEntries(conn, fi.records)));
  const refMap = createSObjectTypeMap(fileInfos.flatMap((fi) => fi.records));
  const results = await Promise.allSettled(
    fileInfos.map((fi) => sendSObjectTreeRequest(conn)(fi.sobject)(JSON.stringify({ records: fi.records })))
  );
  return results.map(getSuccessOrThrow).flatMap(getValueOrThrow(fileInfos)).map(addObjectTypes(refMap));
};

const getSuccessOrThrow = (result: PromiseSettledResult<TreeResponse>): PromiseFulfilledResult<TreeResponse> =>
  isFulfilled(result) ? result : treeSaveErrorHandler(result.reason);

const getValueOrThrow =
  (fi: FileInfo[]) =>
  (response: PromiseFulfilledResult<TreeResponse>, index: number): ResponseRefs[] =>
    getResultsIfNoError(fi[index].filePath)(response.value);

const addObjectTypes =
  (refMap: Map<string, string>) =>
  (result: ResponseRefs): ImportResult => ({
    refId: result.referenceId,
    type: refMap.get(result.referenceId) ?? 'Unknown',
    id: result.id,
  });

const contentsToSobjectType = (records: SObjectTreeInput[]): string => records[0].attributes.type;

const logFileInfo =
  (logger: Logger) =>
  (fileInfo: FileInfo): FileInfo => {
    logger.debug(`Parsed file ${fileInfo.filePath} for sobject type ${fileInfo.sobject}`);
    return fileInfo;
  };

/** check the tree files for references, throw error telling user they are only supported with `--plan */
export const validateNoRefs = (fileInfo: FileInfo): FileInfo => {
  if (hasUnresolvedRefs(fileInfo.records)) {
    Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
    const messages = Messages.loadMessages('@salesforce/plugin-data', 'importApi');

    throw new Error(messages.getMessage('error.RefsInFiles', [fileInfo.filePath]));
  }
  return fileInfo;
};

/** gets information about the file, including the sobject, contents, parsed contents */
const parseFile = async (filePath: string): Promise<FileInfo> => {
  const rawContents = await fs.promises.readFile(filePath, 'utf8');
  const records = parseDataFileContents(filePath)(rawContents);
  const sobjectType = contentsToSobjectType(records);
  return { rawContents, records, filePath, sobject: sobjectType };
};

/** Create a hash of sobject { ReferenceId: Type }. */
export const createSObjectTypeMap = (records: SObjectTreeInput[]): Map<string, string> =>
  new Map(
    records
      .flatMap(flattenNestedRecords)
      .flatMap(Object.entries)
      .filter(isAttributesEntry)
      .map(([, val]) => [val.referenceId, val.type])
  );
