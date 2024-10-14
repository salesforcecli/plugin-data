/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import fs from 'node:fs';

import { Connection, Lifecycle, Logger, Messages, SfError } from '@salesforce/core';
import type { DescribeSObjectResult, QueryResult } from '@jsforce/jsforce-node';
import { Ux } from '@salesforce/sf-plugins-core';
import { ensure } from '@salesforce/ts-types';
import {
  BasicRecord,
  DataPlanPart,
  GenericEntry,
  hasNestedRecords,
  hasNestedRecordsFilter,
  hasNonEmptyNestedRecords,
  SObjectTreeFileContents,
  SObjectTreeInput,
} from './types.js';
import { hasUnresolvedRefs } from './api/data/tree/functions.js';
import { ExportReturnType } from './commands/data/export/tree.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'exportApi');

const DATA_PLAN_FILENAME_PART = 'plan.json';

export type ExportConfig = {
  queries: string[];
  outputDir?: string;
  plan?: boolean;
  prefix?: string;
  conn: Connection;
  ux: Ux;
};

/** refFromIdByType.get('account').get(someAccountId) => AccountRef1 */
export type RefFromIdByType = Map<string, Map<string, string>>;

/** only used internally, but a more useful structure than the original */
type PlanFile = Omit<DataPlanPart, 'files'> & { contents: SObjectTreeFileContents; file: string; dir: string };

export const runExport = async (configInput: ExportConfig): Promise<ExportReturnType> => {
  const { outputDir, plan, queries, conn, prefix, ux } = validate(configInput);
  const refFromIdByType: RefFromIdByType = new Map();
  const logger = Logger.childFromRoot('runExport');
  const allPlanFiles: PlanFile[][] = [];
  const pathPlanMap = new Map<string, DataPlanPart[]>();

  const all = await Promise.all(
    queries.map(async (query) => {
      const { records: recordsFromQuery } = await queryRecords(conn)(query);
      const describe = await cacheAllMetadata(conn)(recordsFromQuery);

      const flatRecords = recordsFromQuery.flatMap(flattenNestedRecords);
      flatRecords.map(buildRefMap(refFromIdByType)); // get a complete map of ID<->Ref

      logger.debug(messages.getMessage('dataExportRecordCount', [flatRecords.length, query]));
      if (outputDir) {
        await fs.promises.mkdir(outputDir, { recursive: true });
      }

      if (plan) {
        const planMap = reduceByType(
          recordsFromQuery
            .flatMap(flattenWithChildRelationships(describe)())
            .map(addReferenceIdToAttributes(refFromIdByType))
            .map(removeChildren)
            .map(replaceParentReferences(describe)(refFromIdByType))
            .map(removeNonPlanProperties)
        );

        const planFiles = [...planMap.entries()].map(
          ([sobject, records]): PlanFile => ({
            sobject,
            contents: { records },
            saveRefs: shouldSaveRefs(records, [...planMap.values()].flat()),
            resolveRefs: hasUnresolvedRefs(records),
            file: `${getPrefixedFileName(sobject, prefix)}.json`,
            dir: outputDir ?? '',
          })
        );
        const output = planFiles.map(planFileToDataPartPlan);
        const planName = getPrefixedFileName([...describe.keys(), DATA_PLAN_FILENAME_PART].join('-'), prefix);
        const location = path.join(outputDir ?? '', planName);

        pathPlanMap.set(location, output);
        allPlanFiles.push(planFiles);

        if (plan && queries.length === 1) {
          // if we're only querying in one, write the file now, otherwise we'll need to combine them later
          await Promise.all([
            ...planFiles.map(writePlanDataFile(ux)),
            fs.promises.writeFile(location, JSON.stringify(output, null, 4)),
          ]);
        }

        return output;
      } else {
        if (flatRecords.length > 200) {
          // use lifecycle so warnings show up in stdout and in the json
          await Lifecycle.getInstance().emitWarning(
            messages.getMessage('dataExportRecordCountWarning', [flatRecords.length, query])
          );
        }
        const contents = { records: processRecordsForNonPlan(describe)(refFromIdByType)(recordsFromQuery) };
        const filename = path.join(
          outputDir ?? '',
          getPrefixedFileName(`${[...describe.keys()].join('-')}.json`, prefix)
        );
        ux.log(`wrote ${flatRecords.length} records to ${filename}`);
        fs.writeFileSync(filename, JSON.stringify(contents, null, 4));
        return contents;
      }
    })
  );

  if (queries.length > 1 && plan) {
    const writes: Array<Promise<void>> = [];
    pathPlanMap.forEach((k, v) => writes.push(fs.promises.writeFile(v, JSON.stringify(k, null, 4))));

    // we've queried each query, and have the resulting data, combine the plan file
    await Promise.all([...allPlanFiles.map(writePlanDataFiles(ux)), writes]);
  }

  return all;
};

// TODO: remove the saveRefs/resolveRefs from the types and all associated code.  It's not used by the updated `import` command
/** for records of an object type, at least one record has a ref to it */
const shouldSaveRefs = (recordsOfType: SObjectTreeInput[], allRecords: SObjectTreeInput[]): boolean => {
  const refs = new Set(recordsOfType.map((r) => `@${r.attributes.referenceId}`));
  return allRecords.some((r) => Object.values(r).some((v) => typeof v === 'string' && refs.has(v)));
};

/** convert between types.  DataPlanPart is exported and part of the command's return type and file structure so we're stuck with it */
const planFileToDataPartPlan = (p: PlanFile): DataPlanPart => ({
  sobject: p.sobject,
  saveRefs: p.saveRefs,
  resolveRefs: p.resolveRefs,
  files: [p.file],
});

const writePlanDataFile =
  (ux: Ux) =>
  async (p: PlanFile): Promise<void> => {
    await fs.promises.writeFile(path.join(p.dir, p.file), JSON.stringify(p.contents, null, 4));
    ux.log(`wrote ${p.contents.records.length} records to ${p.file}`);
  };

const writePlanDataFiles =
  (ux: Ux) =>
  async (p: PlanFile[]): Promise<void> => {
    if (p.length) {
      await fs.promises.writeFile(
        path.join(p[0].dir, p[0].file),
        JSON.stringify(
          p.map((x) => x.contents),
          null,
          4
        )
      );
      ux.log(
        `wrote ${p
          .map((x) => x.contents.records.length)
          .reduce((accumulator, currentValue) => accumulator + currentValue, 0)} records to ${p.at(0)?.file}`
      );
    }
  };

// future: use Map.groupBy() when it's available
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy
const reduceByType = (records: SObjectTreeInput[]): Map<string, SObjectTreeInput[]> =>
  records.reduce<Map<string, SObjectTreeInput[]>>((acc, curr) => {
    acc.set(curr.attributes.type, (acc.get(curr.attributes.type) ?? []).concat([curr]));
    return acc;
  }, new Map());

const processRecordsForNonPlan =
  (describe: Map<string, DescribeSObjectResult>) =>
  (refFromIdByType: RefFromIdByType) =>
  (records: BasicRecord[]): SObjectTreeInput[] =>
    records
      .map(recurseNestedValues(describe)(refFromIdByType))
      .map(addReferenceIdToAttributes(refFromIdByType))
      .map(replaceParentReferences(describe)(refFromIdByType))
      .map(removeNonPlanProperties);

const recurseNestedValues =
  (describe: Map<string, DescribeSObjectResult>) =>
  (refFromIdByType: RefFromIdByType) =>
  (record: BasicRecord): BasicRecord =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) =>
        hasNonEmptyNestedRecords<BasicRecord>(value)
          ? [key, { records: processRecordsForNonPlan(describe)(refFromIdByType)(value.records) }]
          : [key, value]
      )
    ) as BasicRecord;

/** removing nulls, Ids, and objects who only property is records: [] */
const removeNonPlanProperties = (record: SObjectTreeInput): SObjectTreeInput =>
  Object.fromEntries(
    Object.entries(record).filter(nonPlanPropertiesFilter).map(removeUrlIfAttributes)
  ) as SObjectTreeInput;

/** the url doesn't exist in the non-plan tree output.  Whether that matters or not, this results in cleaner files */
const removeUrlIfAttributes = <T extends GenericEntry>([key, value]: T): T =>
  [
    key,
    key === 'attributes' && typeof value === 'object' && value && 'type' in value
      ? {
          type: (value as SObjectTreeInput['attributes']).type,
          referenceId: (value as SObjectTreeInput['attributes']).referenceId,
        }
      : value,
  ] as T;

/** remove Id, nulls and empty records arrays */
const nonPlanPropertiesFilter = ([key, value]: GenericEntry): boolean =>
  key !== 'Id' && value !== null && !isEmptyRecordsArray(value);

const isEmptyRecordsArray = (value: unknown): value is { records: [] } =>
  typeof value === 'object' &&
  value !== null &&
  'records' in value &&
  Object.keys(value).length === 1 &&
  Array.isArray(value.records) &&
  value.records.length === 0;

/**
 * pass in a type if you have one to make the search more efficient.
 * otherwise, it'll have to search ALL the refs in all the types
 */
export const maybeConvertIdToRef =
  (refFromIdByType: RefFromIdByType) =>
  ([id, type]: [id: string, type?: string]): string => {
    const ref = type
      ? // we have a type, so we can easily get the ID
        refFromIdByType.get(type)?.get(id)
      : // it's polymorphic (ex: whatId on event/task) so we gotta check ALL of them :(
        [...refFromIdByType.values()].find((map) => map.has(id))?.get(id);
    return ref ? `@${ref}` : id;
  };

/** replace parent references, converting IDs into ref */
export const replaceParentReferences =
  (describe: Map<string, DescribeSObjectResult>) =>
  (refFromIdByType: RefFromIdByType) =>
  (record: SObjectTreeInput | BasicRecord): SObjectTreeInput => {
    const typeDescribe = ensure(describe.get(record.attributes.type), `Missing describe for ${record.attributes.type}`);
    const replacedReferences = Object.fromEntries(
      Object.entries(record)
        .filter(isRelationshipFieldFilter(typeDescribe)) // only look at the fields that are references
        // We can check describe to see what the type could be.
        // If it narrows to only 1 type, pass that to refFromId.
        // If it's polymorphic, don't pass a type because refFromId will need to check all the types.
        .map(([key, value]) => [
          key,
          maybeConvertIdToRef(refFromIdByType)([value, getRelatedToWithMetadata(typeDescribe, key)]),
        ])
    );

    return { ...record, ...replacedReferences } as SObjectTreeInput;
  };

/**
 * Side effect: set it in the refFromIdByType Map if it wasn't already.
 * */
export const buildRefMap =
  (refFromIdByType: RefFromIdByType) =>
  (obj: BasicRecord): RefFromIdByType => {
    const [id, type] = [idFromRecord(obj), typeFromRecord(obj)];

    if (!refFromIdByType.get(type)?.get(id)) {
      // we don't know about this ID yet
      refFromIdByType.set(
        type,
        (refFromIdByType.get(type) ?? new Map<string, string>()).set(
          id,
          /** calculate the next ref number based on the existing ones for that type.  Start with 1 */
          `${type}Ref${(refFromIdByType.get(type)?.size ?? 0) + 1}`
        )
      );
    }
    return refFromIdByType;
  };

/** * if there is an ID, we'll turn it into a ref in our mapping and add it to the records's attributes. */
const addReferenceIdToAttributes =
  (refFromIdByType: RefFromIdByType) =>
  (obj: BasicRecord): SObjectTreeInput => ({
    ...obj,
    attributes: {
      type: obj.attributes.type,
      referenceId: ensure(refFromIdByType.get(typeFromRecord(obj))?.get(idFromRecord(obj))),
    },
  });

/**
 * Ensures a valid query is defined in the export configuration,
 * which can be either a soql query or a path to a file containing
 * a soql query.
 *
 * @param config - The export configuration.
 */
const validate = (config: ExportConfig): ExportConfig => {
  if (!config.queries) {
    throw new SfError(messages.getMessage('queryNotProvided'), 'queryNotProvided');
  }
  const queries: string[] = [];
  config.queries.map((q) => {
    const filepath = path.resolve(process.cwd(), q);
    if (fs.existsSync(filepath)) {
      queries.push(fs.readFileSync(filepath, 'utf8'));

      if (!config.queries) {
        throw messages.createError('queryNotProvided');
      }
    }

    if (!q.toLowerCase().startsWith('select')) {
      throw messages.createError('soqlInvalid', [q]);
    }
    queries.push(q);
  });
  config.queries = queries;

  return config;
};

const isRelationshipWithMetadata =
  (metadata: DescribeSObjectResult) =>
  (fieldName: string): boolean =>
    metadata.fields.some(
      (f) => f.name.toLowerCase() === fieldName.toLowerCase() && f.type.toLowerCase() === 'reference'
    );

const getRelatedToWithMetadata = (metadata: DescribeSObjectResult, fieldName: string): string | undefined => {
  const result = metadata.fields.find((field) => field.name === fieldName && field.referenceTo?.length);
  if (!result?.referenceTo) {
    throw new SfError(`Unable to find relation for ${metadata.name}`);
  }

  // if there is one type, we know what it is.  If there are multiple (polymorphic), we don't know what it is.
  return result.referenceTo.length === 1 ? result.referenceTo[0] : undefined;
};

/** turn a record into an array of records, recursively extracting its children if any */
export const flattenNestedRecords = <T extends BasicRecord | SObjectTreeInput>(record: T): T[] =>
  [record].concat(
    Object.entries(record)
      .filter(hasNestedRecordsFilter<T>)
      .flatMap(([, value]) => value.records)
      .flatMap(flattenNestedRecords)
  );

/** return a record without the properties that have nested records  */
export const removeChildren = <T extends SObjectTreeInput | BasicRecord>(record: T): T =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => !hasNestedRecords<T>(value))) as T;

type ParentRef = {
  type: string;
  id: string;
  relationshipName: string;
};

/** while flattening, pass the parent information in
 * so that related objects from the parent (ex: Account.Cases)
 * can be converted to a lookup (ex: Case.AccountId) */
export const flattenWithChildRelationships =
  (describe: Map<string, DescribeSObjectResult>) =>
  (parent?: ParentRef) =>
  (record: BasicRecord): BasicRecord[] =>
    [setLookupId(describe)(parent)(record)].concat(
      Object.entries(record)
        .filter(hasNestedRecordsFilter<BasicRecord>)
        .flatMap(([k, v]) =>
          v.records.flatMap(
            flattenWithChildRelationships(describe)({
              type: typeFromRecord(record),
              id: idFromRecord(record),
              relationshipName: k,
            })
          )
        )
    );

const setLookupId =
  (describe: Map<string, DescribeSObjectResult>) =>
  (parent?: ParentRef) =>
  (record: BasicRecord): BasicRecord => {
    if (!parent) return record;

    const field = describe
      .get(parent.type)
      ?.childRelationships.find((cr) => cr.relationshipName === parent.relationshipName)?.field;

    if (!field) {
      void Lifecycle.getInstance().emitWarning(
        `no matching field found on ${parent.type} for ${parent.relationshipName}`
      );
      return record;
    }

    return { ...record, [field]: parent.id };
  };

const getPrefixedFileName = (fileName: string, prefix?: string): string =>
  prefix ? `${prefix}-${fileName}` : fileName;

/** get all the object types in one pass, and return their describes */
const cacheAllMetadata =
  (conn: Connection) =>
  async (records: BasicRecord[]): Promise<Map<string, DescribeSObjectResult>> => {
    const uniqueTypes = [...new Set(records.flatMap(flattenNestedRecords).map((r) => r.attributes.type))];
    const describes = await Promise.all(uniqueTypes.map((t) => conn.sobject(t).describe()));
    return new Map(describes.map((d) => [d.name, d]));
  };

const queryRecords =
  (conn: Connection) =>
  async (query: string): Promise<QueryResult<BasicRecord>> => {
    try {
      return (await conn.autoFetchQuery(query)) as unknown as QueryResult<BasicRecord>;
    } catch (err) {
      if (err instanceof Error && err.name === 'MALFORMED_QUERY') {
        const errMsg = messages.getMessage('soqlMalformed', [query]);
        const errMsgAction = messages.getMessage('soqlMalformedAction');
        throw new SfError(errMsg, 'MalformedQuery', [errMsgAction]);
      } else {
        throw err;
      }
    }
  };

/** return only fields that, based on metadata, are lookups/master-details AND have a string value (id will be a string)  */
const isRelationshipFieldFilter =
  (typeDescribe: DescribeSObjectResult) =>
  (entry: GenericEntry): entry is [string, string] =>
    isRelationshipWithMetadata(typeDescribe)(entry[0]) && typeof entry[1] === 'string';

const idFromRecord = (record: BasicRecord): string => path.basename(record.attributes.url);
const typeFromRecord = (record: BasicRecord): string => record.attributes.type;
