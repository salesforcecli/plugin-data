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
import path from 'node:path';
import { EOL } from 'node:os';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

import { isString } from '@salesforce/ts-types';
import { Logger, Connection, Messages } from '@salesforce/core';
import type { DataPlanPart, GenericObject, SObjectTreeInput } from '../../../types.js';
import { DataImportPlanArraySchema, DataImportPlanArray } from '../../../schema/dataImportPlan.js';
import type { ImportResult, ImportStatus } from './importTypes.js';
import {
  getResultsIfNoError,
  parseDataFileContents,
  sendSObjectTreeRequest,
  transformRecordTypeEntries,
  treeSaveErrorHandler,
} from './importCommon.js';
import { isUnresolvedRef } from './functions.js';
import { hasUnresolvedRefs } from './functions.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'importApi');

// the "new" type for these.  We're ignoring saveRefs/resolveRefs
export type EnrichedPlanPart = Partial<DataPlanPart> & {
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
export const importFromPlan = async (conn: Connection, planFilePath: string): Promise<ImportStatus> => {
  const resolvedPlanPath = path.resolve(process.cwd(), planFilePath);
  const logger = Logger.childFromRoot('data:import:tree:importFromPlan');
  const warnings: string[] = [];
  const planResultObj = validatePlanContents(resolvedPlanPath, JSON.parse(fs.readFileSync(resolvedPlanPath, 'utf-8')));
  warnings.push(...planResultObj.warnings);
  const planContents = await Promise.all(
    planResultObj.parsedPlans
      .flatMap((planPart) =>
        planPart.files.map((f) => ({ ...planPart, filePath: path.resolve(path.dirname(resolvedPlanPath), f) }))
      )
      .map(async (i) => ({
        ...i,
        records: parseDataFileContents(i.filePath)(await fs.promises.readFile(i.filePath, 'utf-8')),
      }))
  );
  // using recursion to sequentially send the requests so we get refs back from each round
  const { results } = await getResults(conn)(logger)({ results: [], fingerprints: new Set() })(planContents);

  return { results, warnings };
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
      partWithRefsReplaced.records = await transformRecordTypeEntries(conn, partWithRefsReplaced.records);
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

/** replace the `@ref` with the id, using the results objects */
export const replaceRefs =
  (results: ImportResult[]) =>
  (records: SObjectTreeInput[]): SObjectTreeInput[] => {
    if (results.length === 0) return records;

    let updatedRecords = records;

    for (const rec of results) {
      updatedRecords = updatedRecords.map(replaceRefWithId(rec));
    }

    return updatedRecords;
  };

/** replace 1 record with 1 ref for all of its fields */
const replaceRefWithId =
  (ref: ImportResult) =>
  (record: SObjectTreeInput): SObjectTreeInput =>
    Object.fromEntries(
      Object.entries(record).map(([k, v]) => [k, v === `@${ref.refId}` ? ref.id : v])
    ) as SObjectTreeInput;

export function validatePlanContents(
  planPath: string,
  planContents: unknown
): { parsedPlans: DataImportPlanArray; warnings: string[] } {
  const warnings: string[] = [];
  const parseResults = DataImportPlanArraySchema.safeParse(planContents);

  if (parseResults.error) {
    throw messages.createError('error.InvalidDataImport', [
      planPath,
      parseResults.error.issues.map((e) => e.message).join('\n'),
    ]);
  }
  const parsedPlans: DataImportPlanArray = parseResults.data;

  for (const parsedPlan of parsedPlans) {
    if (parsedPlan.saveRefs !== undefined || parsedPlan.resolveRefs !== undefined) {
      warnings.push(
        "The plan contains the 'saveRefs' and/or 'resolveRefs' properties. These properties will be ignored and can be removed."
      );
      break;
    }
  }
  return { parsedPlans, warnings };
}

const matchesRefFilter =
  (unresolvedRefRegex: RegExp) =>
  (v: unknown): boolean =>
    typeof v === 'string' && unresolvedRefRegex.test(v);

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
