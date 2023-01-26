/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as fs from 'fs';
import { Logger, Messages, Org, SfError, Lifecycle } from '@salesforce/core';
import { DescribeSObjectResult, QueryResult } from 'jsforce';
import { Ux } from '@salesforce/sf-plugins-core';
import {
  BasicRecord,
  DataPlanPart,
  hasNestedRecords,
  SObjectTreeFileContents,
  SObjectTreeInput,
} from '../../../dataSoqlQueryTypes';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'exportApi');

const DATA_PLAN_FILENAME_PART = '-plan.json';

const describe: Record<string, DescribeSObjectResult> = {}; // holds metadata result for object type describe calls

export interface ExportConfig {
  query: string;
  outputDir?: string;
  plan?: boolean;
  prefix?: string;
}

interface ParentRef {
  id: string;
  fieldName: string;
}

/**
 * Exports data from an org into sObject tree format.
 */
export class ExportApi {
  private logger: Logger;
  private objectTypeRegistry: Record<
    string,
    {
      order: number;
      type: string;
      saveRefs: boolean;
      resolveRefs: boolean;
    }
  > = {}; // registry for object type data plan descriptor
  private refFromIdByType = new Map<string, Map<string, string>>(); // refFromIdByType.get('account').get(someAccountId) => AccountRef1
  private typeRefIndexes = new Map<string, number>(); // registry for object type-specific ref counters

  private config!: ExportConfig;

  public constructor(private readonly org: Org, private readonly ux: Ux) {
    this.logger = Logger.childFromRoot(this.constructor.name);
  }

  /**
   * Invokes the provided SOQL query against a target Org.  Results
   * are converted into SObject Tree format.
   *
   * @param config
   */
  public async export(config: ExportConfig): Promise<SObjectTreeFileContents | DataPlanPart[]> {
    this.config = validate(config);

    const { outputDir, plan, query } = this.config;

    if (outputDir) {
      await fs.promises.mkdir(outputDir, { recursive: true });
    }

    let queryResults: QueryResult<BasicRecord>;
    try {
      queryResults = await this.org.getConnection().query(query);
    } catch (err) {
      if (err instanceof Error && err.name === 'MALFORMED_QUERY') {
        const errMsg = messages.getMessage('soqlMalformed', [query]);
        const errMsgAction = messages.getMessage('soqlMalformedAction');
        throw new SfError(errMsg, 'MalformedQuery', [errMsgAction]);
      } else {
        throw err;
      }
    }

    const sobjectTree = await this.processQueryResults(queryResults);

    if (!sobjectTree.records?.length) {
      return sobjectTree;
    }
    if (plan) {
      return this.generateDataPlan(sobjectTree);
    }
    return this.writeDataFileSync(`${Object.keys(this.objectTypeRegistry).join('-')}.json`, sobjectTree);
  }

  //   P R I V A T E   M E T H O D S

  // Process query results generating SObject Tree format
  private async processQueryResults(recordList: QueryResult<BasicRecord>): Promise<SObjectTreeFileContents> {
    await this.recordObjectTypes(recordList);

    const processedRecordList = await this.queryResultsToTree(recordList);
    // log record count; warn if > 200 and !options.plan
    const recordCount = processedRecordList.records.length ?? 0;
    this.logger.debug(messages.getMessage('dataExportRecordCount', [recordCount, this.config.query]));
    if (recordCount > 200 && !this.config.plan) {
      // use lifecycle so warnings show up in stdout and in the json
      await Lifecycle.getInstance().emitWarning(
        messages.getMessage('dataExportRecordCountWarning', [recordCount, this.config.query])
      );
    }
    return this.finalApplyRefs(processedRecordList.records);
  }

  /**
   * Register object types and type hierarchy for plan generation
   **/
  private async recordObjectTypes(recordList: QueryResult<BasicRecord>): Promise<QueryResult<BasicRecord>> {
    const records = recordList.records;

    if (!records.length) {
      this.ux.log('Query returned no results');
      return recordList;
    }

    // top level object type
    const topLevelType = records[0].attributes.type;
    this.objectTypeRegistry[topLevelType] = {
      order: 0,
      type: topLevelType,
      saveRefs: true, // post-save, record reference-to-id to be used for child reference resolution
      resolveRefs: false, // pre-save, don't resolve relationship references to parent ids (from previous save)
    };

    records.forEach((record) => {
      Object.entries(record).map(([key, value]) => {
        if (hasNestedRecords<BasicRecord>(value)) {
          const type = value.records[0].attributes.type;
          // found a related object, add to map
          if (type && !this.objectTypeRegistry[type]) {
            this.objectTypeRegistry[type] = {
              order: 1,
              type,
              saveRefs: false, // assume child records will not be parents (may be changed later)
              resolveRefs: true, // resolve relationship references to parent ids
            };
          }
        }
        return key;
      });
    });

    // pre-load object metadata
    const promises = Object.keys(this.objectTypeRegistry).map((key) => this.loadMetadata(key));
    return Promise.all(promises).then(() => recordList);
  }

  private async queryResultsToTree(
    recordList: Pick<QueryResult<BasicRecord>, 'records'>,
    parentRef?: ParentRef
  ): Promise<SObjectTreeFileContents> {
    // holds transformed sobject tree
    const sobjectTree = { records: [] };

    for (const record of recordList.records) {
      // eslint-disable-next-line no-await-in-loop
      await this.processRecords(record, sobjectTree, parentRef);
    }
    this.logger.debug(JSON.stringify(sobjectTree, null, 4));
    return sobjectTree;
  }

  private async processRecords(
    record: BasicRecord,
    sobjectTree: SObjectTreeFileContents,
    parentRef?: ParentRef
  ): Promise<SObjectTreeFileContents> {
    // incremented every time we visit another record
    const objRefId = this.incrementTypeRefIndex(record.attributes.type);

    // add the attributes for this record, setting the type and reference
    const treeRecord: SObjectTreeInput = {
      attributes: {
        type: record.attributes.type,
        referenceId: objRefId,
      },
    };

    // store the reference in a map with the record id
    this.saveRecordRef(record, objRefId);

    // handle each record attribute
    await this.processRecordAttributes(record, treeRecord, objRefId);

    if (parentRef && this.config.plan) {
      const parentFieldName = parentRef.fieldName;
      if (!treeRecord[parentFieldName]) {
        treeRecord[parentFieldName] = parentRef.id;
      }
    }
    // add record to tree
    sobjectTree.records.push(treeRecord);

    return sobjectTree;
  }

  // Generate object type reference (<ObjectType>Ref<Counter>)
  private incrementTypeRefIndex(type: string): string {
    this.typeRefIndexes.set(type, 1 + (this.typeRefIndexes.get(type) ?? 0));
    return `${type}Ref${this.typeRefIndexes.get(type)}`;
  }

  private async processRecordAttributes(
    record: BasicRecord,
    treeRecord: SObjectTreeInput,
    objRefId: string
  ): Promise<SObjectTreeInput> {
    const promises = Object.keys(record).map((key) => this.processRecordAttribute(record, key, treeRecord, objRefId));
    await Promise.all(promises);
    return treeRecord;
  }

  private async processRecordAttribute(
    record: BasicRecord,
    key: string,
    treeRecord: SObjectTreeInput,
    objRefId: string
  ): Promise<void> {
    // skip attributes and id.  Data import does not accept records with IDs.
    if (key === 'attributes' || key === 'Id') {
      // If this is an attributes section then we need to add an object reference
      this.saveRecordRef(record, objRefId);
      return;
    }
    const metadata = await this.loadMetadata(record.attributes.type);

    if (isQueryResult(metadata, key)) {
      const field = record[key];

      // handle child records
      if (!field) {
        // The parent has no child records, so return an empty records array
        treeRecord[key] = { records: [] };
        return;
      }

      if (hasNestedRecords<BasicRecord>(field)) {
        const childMetadata = await this.loadMetadata(field.records[0].attributes.type);
        treeRecord[key] = await this.queryResultsToTree(field, {
          id: `@${objRefId}`,
          fieldName: getRelationshipFieldName(childMetadata, record.attributes.type),
        });
        return;
      }
    }
    if (this.config.plan && isRelationshipWithMetadata(metadata, key)) {
      const relTo = getRelatedToWithMetadata(metadata, key);
      // find reference in record result
      if (this.objectTypeRegistry[relTo]) {
        // add ref to replace the value
        const id: string = record[key] as string;
        const ref = this.refFromIdByType.get(relTo)?.get(id);
        // If ref is not found, then leave intact because we may not have processed
        // this parent fully. We'll go back through the sObject tree
        // later and replace the id with a reference.
        treeRecord[key] = ref && ref !== id ? `@${ref}` : id;
        return;
      }
      // TODO: what to do if ref not found?
      const recordId: string = record['Id'] as string;
      this.logger.error(`Reference ${relTo} not found for ${key}.  Skipping record ${recordId}.`);
      return;
    }
    // not a relationship field, simple key/value
    if (!isRelationshipWithMetadata(metadata, key)) {
      treeRecord[key] = record[key];
    }
  }

  // Get sObject description and cache for given object type
  private async loadMetadata(objectName: string): Promise<DescribeSObjectResult> {
    describe[objectName] ??= await this.org.getConnection().sobject(objectName).describe();
    return describe[objectName];
  }

  /**
   * Register object type's id to reference mapping
   *
   * @param refId like '@AccountRef1'
   * */
  private saveRecordRef(obj: BasicRecord, refId: string): void {
    if (!obj.attributes.url) {
      return;
    }
    const id = path.basename(obj.attributes.url);
    const type = obj.attributes.type;

    // ensure no existing reference for that Id
    const refEntry = this.refFromIdByType.get(type)?.get(id);
    if (refEntry && refEntry !== refId) {
      throw new SfError(`Overriding ${type} reference for ${id}: existing ${refEntry}, incoming ${refId}`);
    }

    this.refFromIdByType.set(type, (this.refFromIdByType.get(type) ?? new Map<string, string>()).set(id, refId));
  }

  /**
   * Walk the final data set and split out into files.  The main queried
   * object is the parent, and has a different saveRefs and resolveRefs
   * values.  All the references have been created at this point.
   */
  private generateDataPlan(sobjectTree: SObjectTreeFileContents): DataPlanPart[] {
    const objects = new Map<string, SObjectTreeInput[]>();
    const dataPlan: DataPlanPart[] = [];

    // loop thru object tree extracting type-specific records into separate tree structure
    sobjectTree.records.forEach((record) => {
      const topLevelObjectType = record.attributes.type;
      if (!objects.has(topLevelObjectType)) {
        objects.set(topLevelObjectType, []);
      }

      Object.entries(record).map(([key, value]) => {
        if (hasNestedRecords<SObjectTreeInput>(value)) {
          const childRecords = value.records;
          if (childRecords) {
            // found child records, add to type-specific registry
            if (childRecords.length) {
              const childObjectType = childRecords[0].attributes.type;
              objects.set(childObjectType, (objects.get(childObjectType) ?? []).concat(childRecords));
            }
            // remove child from top-level object structure
            delete record[key];
          }
        }
      });
      objects.set(topLevelObjectType, (objects.get(topLevelObjectType) ?? []).concat([record]));
    });

    // sort object types based on insertion dependence
    const objectsSorted = Object.keys(this.objectTypeRegistry).sort(
      (a, b) => this.objectTypeRegistry[a].order - this.objectTypeRegistry[b].order
    );

    // write data files and update data plan
    dataPlan.push(
      ...objectsSorted.map((key) =>
        this.writeObjectTypeDataFile(
          key,
          this.objectTypeRegistry[key].saveRefs,
          this.objectTypeRegistry[key].resolveRefs,
          `${key}s.json`,
          { records: objects.get(key) ?? [] }
        )
      )
    );

    // write data plan file
    const dataPlanFile = Object.keys(this.objectTypeRegistry).join('-') + DATA_PLAN_FILENAME_PART;

    return this.writeDataFileSync(dataPlanFile, dataPlan);
  }

  // generate data plan stanza referencing written object type file
  private writeObjectTypeDataFile(
    type: string,
    saveRefs: boolean,
    resolveRefs: boolean,
    fileName: string,
    sObject: SObjectTreeFileContents
  ): DataPlanPart {
    const dataPlanPart = {
      sobject: type,
      saveRefs,
      resolveRefs,
      files: [this.getPrefixedFileName(fileName)],
    };

    this.writeDataFileSync(fileName, sObject);

    return dataPlanPart;
  }

  /**
   * This method is used as a second pass to establish references that couldn't be determined
   * in the initial pass done by processRecordList. It looks for relationship fields that
   * contain an id.
   */
  private finalApplyRefs(sobjectTree: SObjectTreeInput[]): SObjectTreeFileContents {
    sobjectTree.forEach((record) => {
      Object.entries(record).map(([field, value]) => {
        if (hasNestedRecords<SObjectTreeInput>(value)) {
          // These are children
          this.finalApplyRefs(value.records);
        } else {
          const objType = record.attributes.type;

          if (isRelationship(objType, field)) {
            if (typeof value === 'string' && !value.startsWith('@')) {
              // it's still just an ID, so we need to resolve it
              const id = value;
              const refTo = getRelatedTo(objType, field);
              const ref = this.refFromIdByType.get(refTo)?.get(id);

              if (!ref) {
                throw new SfError(`${objType} reference to ${refTo} (${id}) not found in query results.`);
              }

              record[field] = `@${ref}`;

              // Setup dependency ordering for later output
              if (this.objectTypeRegistry[objType].order <= this.objectTypeRegistry[refTo].order) {
                this.objectTypeRegistry[objType].order = this.objectTypeRegistry[refTo].order + 1;
                this.objectTypeRegistry[refTo].saveRefs = true;
                this.objectTypeRegistry[objType].resolveRefs = true;
              }
            }
          }
        }
      });
    });

    return { records: sobjectTree };
  }

  private countRecords(records: SObjectTreeInput[], count = 0): number {
    count += records.length;
    records.forEach((record) => {
      Object.values(record).forEach((val) => {
        if (hasNestedRecords<SObjectTreeInput>(val)) {
          this.countRecords(val.records, count);
        }
      });
    });
    return count;
  }

  private getPrefixedFileName(fileName: string): string {
    return this.config.prefix ? `${this.config.prefix}-${fileName}` : fileName;
  }

  private writeDataFileSync<T extends SObjectTreeFileContents | DataPlanPart[]>(fileName: string, jsonObject: T): T {
    let recordCount = 0;

    const finalFilename = this.config.outputDir
      ? path.join(this.config.outputDir, this.getPrefixedFileName(fileName))
      : this.getPrefixedFileName(fileName);

    if (hasNestedRecords(jsonObject)) {
      recordCount = this.countRecords(jsonObject.records);
    }

    fs.writeFileSync(finalFilename, JSON.stringify(jsonObject, null, 4));

    this.ux.log(`Wrote ${recordCount} records to ${finalFilename}`);

    return jsonObject;
  }
}

/**
 * Ensures a valid query is defined in the export configuration,
 * which can be either a soql query or a path to a file containing
 * a soql query.
 *
 * @param config - The export configuration.
 */
const validate = (config: ExportConfig): ExportConfig => {
  if (!config.query) {
    throw new SfError(messages.getMessage('queryNotProvided'), 'queryNotProvided');
  }

  const filepath = path.resolve(process.cwd(), config.query);
  if (fs.existsSync(filepath)) {
    config.query = fs.readFileSync(filepath, 'utf8');

    if (!config.query) {
      throw messages.createError('queryNotProvided');
    }
  }

  config.query = config.query.trim();
  if (!config.query.toLowerCase().startsWith('select')) {
    throw messages.createError('soqlInvalid', [config.query]);
  }

  return config;
};

const isQueryResult = (metadata: DescribeSObjectResult, fieldName: string): boolean =>
  metadata.childRelationships.some((cr) => cr.relationshipName === fieldName);

const isSpecificTypeWithMetadata = (metadata: DescribeSObjectResult, fieldName: string, fieldType: string): boolean =>
  metadata.fields.some(
    (f) => f.name.toLowerCase() === fieldName.toLowerCase() && f.type.toLowerCase() === fieldType.toLowerCase()
  );

const getRelationshipFieldName = (metadata: DescribeSObjectResult, parentName: string): string => {
  const result = metadata.fields.find((field) => field.type === 'reference' && field.referenceTo?.includes(parentName));

  if (!result) {
    throw new SfError(`Unable to find relationship field name for ${metadata.name}`);
  }

  return result.name;
};

const isRelationshipWithMetadata = (metadata: DescribeSObjectResult, fieldName: string): boolean =>
  isSpecificTypeWithMetadata(metadata, fieldName, 'reference');

const getRelatedToWithMetadata = (metadata: DescribeSObjectResult, fieldName: string): string => {
  const result = metadata.fields.find((field) => field.name === fieldName && field.referenceTo?.length);
  if (!result?.referenceTo) {
    throw new SfError(`Unable to find relation for ${metadata.name}`);
  }

  return result.referenceTo[0];
};

const isRelationship = (objectName: string, fieldName: string): boolean => {
  if (!describe[objectName]) {
    throw new SfError(`Metadata not found for ${objectName}`);
  }
  return isRelationshipWithMetadata(describe[objectName], fieldName);
};

const getRelatedTo = (objectName: string, fieldName: string): string => {
  if (!describe[objectName]) {
    throw new SfError(`Metadata not found for ${objectName}`);
  }
  return getRelatedToWithMetadata(describe[objectName], fieldName);
};
