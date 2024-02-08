/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { AnyJson } from '@salesforce/ts-types';
import { Logger, SchemaValidator, SfError, Connection } from '@salesforce/core';
import { DataPlanPart, SObjectTreeFileContents, SObjectTreeInput } from '../../../dataSoqlQueryTypes.js';
import { messages, INVALID_DATA_IMPORT_ERR_NAME } from './importFiles.js';
import { DataPlanPartFilesOnly, ResponseRefs, TreeResponse } from './importTypes.js';
import { ImportResult } from './importTypes.js';
import { sendSObjectTreeRequest, treeSaveErrorHandler } from './importCommon.js';

// the "new" type for these.  We're ignoring saveRefs/resolveRefs.
export type EnrichedPlanPart = Omit<DataPlanPartFilesOnly, 'saveRefs' | 'resolveRefs'> & {
  filePath: string;
  sobject: string;
  records: SObjectTreeInput[];
};

const refRegex = (object: string): RegExp => new RegExp(`^@${object}Ref\\d+$`);

export const importFromPlan = async (conn: Connection, planFilePath: string): Promise<ImportResult[]> => {
  const resolvedPlanPath = path.resolve(process.cwd(), planFilePath);
  const logger = Logger.childFromRoot('data:import:tree:importFromPlan');

  const planContents = await Promise.all(
    (
      await validatePlanContents(
        resolvedPlanPath,
        (await JSON.parse(fs.readFileSync(resolvedPlanPath, 'utf8'))) as DataPlanPartFilesOnly[]
      )
    )
      .flatMap((dpp) => dpp.files.map((f) => ({ ...dpp, filePath: path.resolve(path.dirname(resolvedPlanPath), f) })))
      .map(async (i) => ({
        ...i,
        records: (JSON.parse(await fs.promises.readFile(i.filePath, 'utf-8')) as SObjectTreeFileContents).records,
      }))
  );
  // using recursion to sequentially send the requests so we get refs back from each round
  const results = await getResults(conn)(logger)([])(planContents);

  return results;
};

const getResults =
  (conn: Connection) =>
  (logger: Logger) =>
  (resultsSoFar: ImportResult[]) =>
  async (planParts: EnrichedPlanPart[]): Promise<ImportResult[]> => {
    const [head, ...tail] = planParts;
    const partWithRefsReplaced = { ...head, records: replaceRefs(resultsSoFar)(head.records) };
    const [allRefsResolved, stillHasRefs] = replaceRefsInTheSameFile(logger)(partWithRefsReplaced);
    if (stillHasRefs) {
      // Do the ones without unresolved refs, then the rest, then the other files.  We split the file into 2 parts and start over
      return getResults(conn)(logger)(resultsSoFar)([allRefsResolved, stillHasRefs, ...tail]);
    }

    if (partWithRefsReplaced.records.length > 200) {
      logger.debug(
        `There are more than 200 records in ${partWithRefsReplaced.filePath}.  Will split into multiple requests.`
      );
      return getResults(conn)(logger)(resultsSoFar)([...fileSplitter(partWithRefsReplaced), ...tail]);
    }
    logger.debug(
      `Sending ${partWithRefsReplaced.filePath} (${partWithRefsReplaced.records.length} records for ${partWithRefsReplaced.sobject}) to the API`
    );
    try {
      const newResults = getResultsIfNoError(partWithRefsReplaced.filePath)(
        await sendSObjectTreeRequest(conn)(partWithRefsReplaced.sobject)(
          JSON.stringify({ records: allRefsResolved.records })
        )
      );
      const output = [
        ...resultsSoFar,
        ...newResults.map((r) => ({ refId: r.referenceId, type: partWithRefsReplaced.sobject, id: r.id })),
      ];
      return tail.length ? await getResults(conn)(logger)(output)(tail) : output;
    } catch (e) {
      return treeSaveErrorHandler(e);
    }
  };

/** if the file has more than 200 records, split it into multiple files */
export const fileSplitter = (planPart: EnrichedPlanPart): EnrichedPlanPart[] => {
  const head = planPart.records.slice(0, 200);
  const tail = planPart.records.slice(200);
  return tail.length ? [{ ...planPart, records: head }, ...fileSplitter({ ...planPart, records: tail })] : [planPart];
};

export const replaceRefsInTheSameFile =
  (logger: Logger) =>
  (planPart: EnrichedPlanPart): [EnrichedPlanPart] | [EnrichedPlanPart, EnrichedPlanPart] => {
    const unresolvedRefRegex = refRegex(planPart.sobject);
    // it's possible that a file has records that refer to each other (ex: account/parentId).  So they're not in refs yet.
    // so we'll parse the JSON and split the records into 2 sets: those with refs and those without, if necessary
    const refRecords = planPart.records.filter((r) => Object.values(r).some(matchesRefFilter(unresolvedRefRegex)));
    if (refRecords.length) {
      logger.debug(`Not all refs are resolved yet.  Splitting ${planPart.filePath} into two`);
      // have no refs, so they can go in immediately
      const noRefRecords = planPart.records.filter((r) => !Object.values(r).some(matchesRefFilter(unresolvedRefRegex)));

      return [
        {
          ...planPart,
          records: noRefRecords,
          filePath: `${planPart.filePath} (no refs)`,
        },
        {
          ...planPart,
          records: refRecords,
          filePath: `${planPart.filePath} (refs to be resolved)`,
        },
      ];
    }
    return [planPart];
  };

/* recursively replace the @ref with the id, using the accumulated results objects */
export const replaceRefs =
  (refs: ImportResult[]) =>
  (records: SObjectTreeInput[]): SObjectTreeInput[] => {
    if (refs.length === 0) return records;
    const [head, ...tail] = refs;
    return tail.length ? replaceRefs(tail)(records.map(replaceRefWithId(head))) : records.map(replaceRefWithId(head));
  };

// replace 1 record with 1 ref for all of its fields
const replaceRefWithId =
  (ref: ImportResult) =>
  (record: SObjectTreeInput): SObjectTreeInput =>
    Object.fromEntries(
      Object.entries(record).map(([k, v]) => [k, v === `@${ref.refId}` ? ref.id : v])
    ) as SObjectTreeInput;

// replaceAll(`@${head.refId}`, head.id)) : records;
const getResultsIfNoError =
  (filePath: string) =>
  (response: TreeResponse): ResponseRefs[] => {
    if (response.hasErrors === true) {
      throw messages.createError('dataImportFailed', [filePath, JSON.stringify(response.results, null, 4)]);
    }
    return response.results;
  };

const validatePlanContents = async (
  planPath: string,
  planContents: DataPlanPart[]
): Promise<DataPlanPartFilesOnly[]> => {
  const logger = Logger.childFromRoot('data:import:tree:validatePlanContents');
  const planSchema = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    'schema',
    'dataImportPlanSchema.json'
  );

  const val = new SchemaValidator(logger, planSchema);
  try {
    await val.validate(planContents as unknown as AnyJson);
    // TODO: throw (via typeguard) if its DataPlanPart but not DataPlanPartFilesOnly
    return planContents as DataPlanPartFilesOnly[];
  } catch (err) {
    if (err instanceof Error && err.name === 'ValidationSchemaFieldErrors') {
      throw new SfError(
        messages.getMessage('dataPlanValidationError', [planPath, err.message]),
        INVALID_DATA_IMPORT_ERR_NAME,
        messages.getMessages('dataPlanValidationErrorActions', ['sf', ' ', ' ', 'sf', ' ', ' '])
      );
    } else if (err instanceof Error) {
      throw SfError.wrap(err);
    }
    throw err;
  }
};

const matchesRefFilter =
  (unresolvedRefRegex: RegExp) =>
  (v: unknown): boolean =>
    typeof v === 'string' && unresolvedRefRegex.test(v);
