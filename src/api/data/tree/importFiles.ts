/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { Logger, Messages, Connection } from '@salesforce/core';
import { isFulfilled } from '@salesforce/kit';
import { flattenNestedRecords } from '../../../export.js';
import { SObjectTreeFileContents, SObjectTreeInput, isAttributesEntry } from '../../../dataSoqlQueryTypes.js';
import { sendSObjectTreeRequest, treeSaveErrorHandler } from './importCommon.js';
import { ImportResult, ResponseRefs, TreeResponse } from './importTypes.js';

export const INVALID_DATA_IMPORT_ERR_NAME = 'InvalidDataImport';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
export const messages = Messages.loadMessages('@salesforce/plugin-data', 'importApi');

export const importFromFiles = async (conn: Connection, dataFilePaths: string[]): Promise<ImportResult[]> => {
  const logger = Logger.childFromRoot('data:import:tree:importSObjectTreeFile');
  const fileInfos = (await Promise.all(dataFilePaths.map(parseFile))).map(logFileInfo(logger));
  const refMap = createSObjectTypeMap(fileInfos.flatMap((fi) => fi.parsed.records));

  // TODO: does the logic make sense?  Is it better to send them all in parallel, or fail on the first,
  // knowing that the rest could have already been saved and the user would have to manually clean up?
  const results = await Promise.allSettled(
    fileInfos.map((fi) => sendSObjectTreeRequest(conn)(fi.sobject)(fi.rawContents))
  );
  return results.map(getSuccessOrThrow).flatMap(getValueOrThrow(fileInfos)).map(addObjectTypes(refMap));
};

const getSuccessOrThrow = (result: PromiseSettledResult<TreeResponse>): PromiseFulfilledResult<TreeResponse> =>
  isFulfilled(result) ? result : treeSaveErrorHandler(result.reason);

const getValueOrThrow =
  (fi: FileInfo[]) =>
  (
    response: PromiseFulfilledResult<TreeResponse>,
    index: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    array: Array<PromiseFulfilledResult<TreeResponse>>
  ): ResponseRefs[] => {
    if (response.value.hasErrors === true) {
      throw messages.createError('dataImportFailed', [
        fi[index].filePath,
        JSON.stringify(response.value.results, null, 4),
      ]);
    }
    return response.value.results;
  };

const addObjectTypes =
  (refMap: Map<string, string>) =>
  (result: ResponseRefs): ImportResult => ({
    refId: result.referenceId,
    type: refMap.get(result.referenceId) ?? 'Unknown',
    id: result.id,
  });

const contentsToSobjectType = (contents: SObjectTreeFileContents): string => contents.records[0].attributes.type;

const logFileInfo =
  (logger: Logger) =>
  (fileInfo: FileInfo): FileInfo => {
    logger.debug(`Parsed file ${fileInfo.filePath} for sobject type ${fileInfo.sobject}`);
    return fileInfo;
  };

type FileInfo = {
  rawContents: string;
  parsed: SObjectTreeFileContents;
  filePath: string;
  sobject: string;
};

/** gets information about the file, including the sobject, contents, parsed contents */
const parseFile = async (filePath: string): Promise<FileInfo> => {
  const rawContents = await fs.promises.readFile(filePath, 'utf8');
  if (!rawContents) {
    throw messages.createError('dataFileEmpty', [filePath]);
  }
  const parsed = parseDataFileContents(rawContents);
  const sobjectType = contentsToSobjectType(parsed);
  return { rawContents, parsed, filePath, sobject: sobjectType };
};

const parseDataFileContents = (contents: string): SObjectTreeFileContents =>
  JSON.parse(contents) as SObjectTreeFileContents;
/**
 * Create a hash of sobject { ReferenceId: Type } assigned to this.sobjectTypes.
 * Used to display the sobject type in the results.
 *
 * @param content  The content string defined by the file(s).
 * @param isJson
 */

const createSObjectTypeMap = (records: SObjectTreeInput[]): Map<string, string> =>
  new Map(
    records
      .flatMap(flattenNestedRecords)
      .flatMap(Object.entries)
      .filter(isAttributesEntry)
      .map(([, val]) => [val.referenceId, val.type])
  );
