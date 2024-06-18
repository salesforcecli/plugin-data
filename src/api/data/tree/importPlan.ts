/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import { EOL } from 'node:os';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

import { AnyJson, isString } from '@salesforce/ts-types';
import { Logger, SchemaValidator, SfError, Connection, Messages } from '@salesforce/core';
import { GenericObject, SObjectTreeInput } from '../../../types.js';
import { DataPlanPartFilesOnly, ImportResult } from './importTypes.js';
import {
  getResultsIfNoError,
  parseDataFileContents,
  sendSObjectTreeRequest,
  treeSaveErrorHandler,
} from './importCommon.js';
import { isUnresolvedRef } from './functions.js';
import { hasUnresolvedRefs } from './functions.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'importApi');

// the "new" type for these.  We're ignoring saveRefs/resolveRefs
export type EnrichedPlanPart = Omit<DataPlanPartFilesOnly, 'saveRefs' | 'resolveRefs'> & {
  filePath: string;
  sobject: string;
  records: SObjectTreeInput[];
};
/** an accumulator for api results.  Fingerprints exist to break recursion */
type ResultsSoFar = {
  results: ImportResult[];
  fingerprints: Set<string>;
};

const TREE_API_LIMIT = 200;

const refRegex = (object: string): RegExp => new RegExp(`^@${object}Ref\\d+$`);
export const importFromPlan = async (conn: Connection, planFilePath: string): Promise<ImportResult[]> => {
  const resolvedPlanPath = path.resolve(process.cwd(), planFilePath);
  const logger = Logger.childFromRoot('data:import:tree:importFromPlan');

  const planContents = await Promise.all(
    (
      await validatePlanContents(logger)(
        resolvedPlanPath,
        (await JSON.parse(fs.readFileSync(resolvedPlanPath, 'utf8'))) as DataPlanPartFilesOnly[]
      )
    )
      // there *shouldn't* be multiple files for the same sobject in a plan, but the legacy code allows that
      .flatMap((dpp) => dpp.files.map((f) => ({ ...dpp, filePath: path.resolve(path.dirname(resolvedPlanPath), f) })))
      .map(async (i) => ({
        ...i,
        records: parseDataFileContents(i.filePath)(await fs.promises.readFile(i.filePath, 'utf-8')),
      }))
  );
  // using recursion to sequentially send the requests so we get refs back from each round
  const { results } = await getResults(conn)(logger)({ results: [], fingerprints: new Set() })(planContents);

  return results;
};

/** recursively splits files (for size or unresolved refs) and makes API calls, storing results for subsequent calls */
const getResults =
  (conn: Connection) =>
  (logger: Logger) =>
  (resultsSoFar: ResultsSoFar) =>
  async (planParts: EnrichedPlanPart[]): Promise<ResultsSoFar> => {
    const newResultWithFingerPrints = addFingerprint(resultsSoFar)(planParts);
    const [head, ...tail] = planParts;
    if (!head.records.length) {
      return tail.length ? getResults(conn)(logger)(newResultWithFingerPrints)(tail) : resultsSoFar;
    }
    const partWithRefsReplaced = { ...head, records: replaceRefs(resultsSoFar.results)(head.records) };
    const { ready, notReady } = replaceRefsInTheSameFile(partWithRefsReplaced);
    if (notReady) {
      logger.debug(`Not all refs are resolved yet.  Splitting ${partWithRefsReplaced.filePath} into two`);

      // Do the ones with all refs resolved to ID, then the rest, then the other files.  Essentially, we split the file into 2 parts and start over
      return getResults(conn)(logger)(newResultWithFingerPrints)([ready, notReady, ...tail]);
    }

    // We could have refs to records in a file we haven't loaded yet.
    const { resolved, unresolved } = filterUnresolved(partWithRefsReplaced.records);
    if (unresolved.length) {
      logger.debug(
        `Not all refs are resolved yet.  Splitting ${partWithRefsReplaced.filePath} into two with the unresolved refs last`
      );

      return getResults(conn)(logger)(newResultWithFingerPrints)([
        { ...head, records: resolved },
        ...tail,
        { ...head, records: unresolved, filePath: `${head.filePath}` },
      ]);
    }

    if (partWithRefsReplaced.records.length > TREE_API_LIMIT) {
      logger.debug(
        `There are more than ${TREE_API_LIMIT} records in ${partWithRefsReplaced.filePath}.  Will split into multiple requests.`
      );
      return getResults(conn)(logger)(newResultWithFingerPrints)([...fileSplitter(partWithRefsReplaced), ...tail]);
    }
    logger.debug(
      `Sending ${partWithRefsReplaced.filePath} (${partWithRefsReplaced.records.length} records for ${partWithRefsReplaced.sobject}) to the API`
    );
    try {
      const contents = JSON.stringify({ records: partWithRefsReplaced.records });
      const newResults = getResultsIfNoError(partWithRefsReplaced.filePath)(
        await sendSObjectTreeRequest(conn)(partWithRefsReplaced.sobject)(contents)
      );
      const output = {
        ...newResultWithFingerPrints,
        results: [
          ...newResultWithFingerPrints.results,
          ...newResults.map((r) => ({ refId: r.referenceId, type: partWithRefsReplaced.sobject, id: r.id })),
        ],
      };
      return tail.length ? await getResults(conn)(logger)(output)(tail) : output;
    } catch (e) {
      return treeSaveErrorHandler(e);
    }
  };

/** if the file has more than TREE_API_LIMIT records, split it into multiple files */
export const fileSplitter = (planPart: EnrichedPlanPart): EnrichedPlanPart[] => {
  const head = planPart.records.slice(0, TREE_API_LIMIT);
  const tail = planPart.records.slice(TREE_API_LIMIT);
  return tail.length ? [{ ...planPart, records: head }, ...fileSplitter({ ...planPart, records: tail })] : [planPart];
};

/**
 * it's possible that a file has records that refer to each other (ex: account/parentId).  So they're not in refs yet.
 * so we'll parse the JSON and split the records into 2 sets: those with refs and those without, if necessary
 */
export const replaceRefsInTheSameFile = (
  planPart: EnrichedPlanPart
): { ready: EnrichedPlanPart; notReady?: EnrichedPlanPart } => {
  const unresolvedRefRegex = refRegex(planPart.sobject);

  const refRecords = planPart.records.filter((r) => Object.values(r).some(matchesRefFilter(unresolvedRefRegex)));
  return refRecords.length
    ? {
        ready: {
          ...planPart,
          // have no refs, so they can go in immediately
          records: planPart.records.filter((r) => !Object.values(r).some(matchesRefFilter(unresolvedRefRegex))),
        },
        notReady: { ...planPart, records: refRecords },
      }
    : { ready: planPart };
};

/** recursively replace the `@ref` with the id, using the accumulated results objects */
export const replaceRefs =
  (results: ImportResult[]) =>
  (records: SObjectTreeInput[]): SObjectTreeInput[] => {
    if (results.length === 0) return records;
    const [head, ...tail] = results;
    const updatedRecords = records.map(replaceRefWithId(head));
    return tail.length ? replaceRefs(tail)(updatedRecords) : updatedRecords;
  };

/** replace 1 record with 1 ref for all of its fields */
const replaceRefWithId =
  (ref: ImportResult) =>
  (record: SObjectTreeInput): SObjectTreeInput =>
    Object.fromEntries(
      Object.entries(record).map(([k, v]) => [k, v === `@${ref.refId}` ? ref.id : v])
    ) as SObjectTreeInput;

export const validatePlanContents =
  (logger: Logger) =>
  async (planPath: string, planContents: unknown): Promise<DataPlanPartFilesOnly[]> => {
    const childLogger = logger.child('validatePlanContents');
    const planSchema = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '..',
      '..',
      'schema',
      'dataImportPlanSchema.json'
    );

    const val = new SchemaValidator(childLogger, planSchema);
    try {
      await val.validate(planContents as AnyJson);
      const output = planContents as DataPlanPartFilesOnly[];
      if (hasRefs(output)) {
        childLogger.warn(
          "The plan contains the 'saveRefs' and/or 'resolveRefs' properties.  These properties will be ignored and can be removed."
        );
      }
      if (!hasOnlySimpleFiles(output)) {
        throw messages.createError('error.NonStringFiles');
      }
      return planContents as DataPlanPartFilesOnly[];
    } catch (err) {
      if (err instanceof Error && err.name === 'ValidationSchemaFieldError') {
        throw messages.createError('error.InvalidDataImport', [planPath, err.message]);
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

const hasOnlySimpleFiles = (planParts: DataPlanPartFilesOnly[]): boolean =>
  planParts.every((p) => p.files.every((f) => typeof f === 'string'));

const hasRefs = (planParts: DataPlanPartFilesOnly[]): boolean =>
  planParts.some((p) => p.saveRefs !== undefined || p.resolveRefs !== undefined);

// TODO: change this implementation to use Object.groupBy when it's on all supported node versions
const filterUnresolved = (
  records: SObjectTreeInput[]
): { resolved: SObjectTreeInput[]; unresolved: SObjectTreeInput[] } => ({
  resolved: records.filter((r) => !hasUnresolvedRefs([r])),
  unresolved: records.filter((r) => hasUnresolvedRefs([r])),
});

/** given the 2 parameters that can change, break the recursion if asked to do an operation that's already been done */
const addFingerprint =
  (resultsSoFar: ResultsSoFar) =>
  (planParts: EnrichedPlanPart[]): ResultsSoFar => {
    const fingerprint = hashObject({ resultsSoFar, planParts });

    if (resultsSoFar.fingerprints.has(fingerprint)) {
      const unresolved = planParts[0].records.map(Object.values).flat().filter(isString).filter(isUnresolvedRef);
      const e = messages.createError('error.UnresolvableRefs', [
        planParts[0].filePath,
        unresolved.map((s) => `- ${s}`).join(EOL),
      ]);
      e.setData(resultsSoFar.results);
      throw e;
    }
    return { ...resultsSoFar, fingerprints: resultsSoFar.fingerprints.add(fingerprint) };
  };

const hashObject = (obj: GenericObject): string =>
  createHash('sha256')
    .update(Buffer.from(JSON.stringify(obj)))
    .digest('hex');
