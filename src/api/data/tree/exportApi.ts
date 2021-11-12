/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import * as path from 'path';
import { fs, Logger, Messages, Org, SfdxError } from '@salesforce/core';
import { getNumber, getString } from '@salesforce/ts-types';
import { UX } from '@salesforce/command';
import { DescribeSObjectResult, QueryResult } from 'jsforce';
import {
  BasicRecord,
  DataPlanPart,
  SObjectTreeFileContents,
  hasNestedRecords,
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

/**
 * Exports data from an org into sObject tree format.
 */
export class ExportApi {
  private logger: Logger;

  private objectTypeRegistry: Record<
    string,
    {
      order: number;
      type: unknown;
      saveRefs: boolean;
      resolveRefs: boolean;
    }
  > = {}; // registry for object type data plan descriptor
  private referenceRegistry = new Map<string, { id: string }>(); // registry of object type-specific id-to-ref mappings
  private typeRefIndexes: Record<string, number> = {}; // registry for object type-specific ref counters

  private config!: ExportConfig;

  public constructor(private readonly org: Org, private readonly ux: UX) {
    this.logger = Logger.childFromRoot(this.constructor.name);
  }

  /**
   * Invokes the provided SOQL query against a target Org.  Results
   * are converted into SObject Tree format.
   *
   * @param config
   */
  public async export(config: ExportConfig): Promise<SObjectTreeFileContents | DataPlanPart[]> {
    this.config = this.validate(config);

    const { outputDir, plan, query } = this.config;

    if (outputDir) {
      this.setupOutputDirectory(outputDir);
    }

    let queryResults: QueryResult<BasicRecord>;
    try {
      queryResults = await this.org.getConnection().query(query);
    } catch (err) {
      if (err instanceof Error && err.name === 'MALFORMED_QUERY') {
        const errMsg = messages.getMessage('soqlMalformed');
        const errMsgAction = messages.getMessage('soqlMalformedAction');
        throw new SfdxError(errMsg, 'MalformedQuery', [errMsgAction]);
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
    } else {
      const fileName = `${Object.keys(this.objectTypeRegistry).join('-')}.json`;
      return this.writeDataFileSync(fileName, sobjectTree);
    }
  }

  //   P R I V A T E   M E T H O D S

  /**
   * Ensures a valid query is defined in the export configuration,
   * which can be either a soql query or a path to a file containing
   * a soql query.
   *
   * @param config - The export configuration.
   */
  private validate(config: ExportConfig): ExportConfig {
    if (!config.query) {
      throw SfdxError.create('@salesforce/plugin-data', 'exportApi', 'queryNotProvided');
    }

    const filepath = path.resolve(process.cwd(), config.query);
    if (fs.existsSync(filepath)) {
      config.query = fs.readFileSync(filepath, 'utf8');

      if (!config.query) {
        throw SfdxError.create('@salesforce/plugin-data', 'exportApi', 'queryNotProvided');
      }
    }

    config.query = config.query.toLowerCase().trim();
    if (!config.query.startsWith('select')) {
      throw SfdxError.create('@salesforce/plugin-data', 'exportApi', 'soqlInvalid', [config.query]);
    }

    return config;
  }

  private setupOutputDirectory(outputDir: string): void {
    try {
      fs.mkdirpSync(outputDir);
    } catch (err) {
      // It is ok if the directory already exist
      const error = err as Error;
      if (error.name !== 'EEXIST') {
        throw err;
      }
    }
  }

  // Process query results generating SObject Tree format
  private async processQueryResults(recordList: QueryResult<BasicRecord>): Promise<SObjectTreeFileContents> {
    await this.recordObjectTypes(recordList);

    const { plan, query } = this.config;

    const processedRecordList = await this.queryResultsToTree(recordList);
    // log record count; warn if > 200 and !options.plan
    const recordCount = getNumber(processedRecordList, 'records.length', 0);
    this.logger.debug(messages.getMessage('dataExportRecordCount', [recordCount, query]));
    if (recordCount > 200 && !plan) {
      this.ux.warn(messages.getMessage('dataExportRecordCountWarning', [recordCount, query]));
    }
    return this.finalApplyRefs(processedRecordList.records);
  }

  // Register object types and type hierarchy for plan generation
  private async recordObjectTypes(recordList: QueryResult<BasicRecord>): Promise<QueryResult<BasicRecord>> {
    const records = recordList.records;

    if (!records.length) {
      // TODO: should be on the command
      this.ux.log('Query returned no results');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    records.forEach((record) => {
      Object.entries(record).map(([key, value]) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        if (hasNestedRecords(value)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const firstRec = value.records[0];
          const type = getString(firstRec, 'attributes.type');
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Promise.all(promises).then(() => recordList);
  }

  private async queryResultsToTree(
    recordList: Pick<QueryResult<BasicRecord>, 'records'>,
    parentRef?: any
  ): Promise<SObjectTreeFileContents> {
    // holds transformed sobject tree
    const sobjectTree = { records: [] };

    for (const record of recordList.records) {
      await this.processRecords(parentRef, record, sobjectTree);
    }
    this.logger.debug(JSON.stringify(sobjectTree, null, 4));
    return sobjectTree;
  }

  private async processRecords(parentRef: any, record: BasicRecord, sobjectTree: any): Promise<any> {
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
      const parentFieldName = getString(parentRef, 'fieldName', '');
      if (!treeRecord[parentFieldName]) {
        treeRecord[parentFieldName] = parentRef.id as string;
      }
    }
    // add record to tree
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    sobjectTree.records.push(treeRecord);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return sobjectTree;
  }

  // Generate object type reference (<ObjectType>Ref<Counter>)
  private incrementTypeRefIndex(type: string): string {
    this.typeRefIndexes[type] ??= 0;
    return `${type}Ref${++this.typeRefIndexes[type]}`;
  }

  private async processRecordAttributes(record: BasicRecord, treeRecord: any, objRefId: string): Promise<any> {
    const promises = Object.keys(record).map((key) => this.processRecordAttribute(record, key, treeRecord, objRefId));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Promise.all(promises).then(() => treeRecord);
  }

  private async processRecordAttribute(
    record: BasicRecord,
    key: string,
    treeRecord: any,
    objRefId: string
  ): Promise<any> {
    // skip attributes and id.  Data import does not accept records with IDs.
    if (key === 'attributes' || key === 'Id') {
      // If this is an attributes section then we need to add an object reference
      this.saveRecordRef(record, objRefId);
      return;
    }
    const metadata = await this.loadMetadata(record.attributes.type);
    const field = record[key];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment

    if (this.isQueryResult(metadata, key)) {
      if (!field) {
        // The parent has no child records, so return an empty records array
        return { records: [] };
      }
      // handle child records
      if (hasNestedRecords<BasicRecord>(field)) {
        const childMetadata = await this.loadMetadata(field.records[0].attributes.type);
        await this.queryResultsToTree(field, {
          id: `@${objRefId}`,
          fieldName: this.getRelationshipFieldName(childMetadata, record.attributes.type),
        });
      }
    } else {
      // see if this is a relationship field
      if (this.isRelationshipWithMetadata(metadata, key)) {
        // related to which field?
        const relTo = this.getRelatedToWithMetadata(metadata, key);
        if (this.config.plan) {
          // find reference in record result
          if (this.objectTypeRegistry[relTo]) {
            // add ref to replace the value
            const id: string = record[key] as string;
            const relatedObject = this.referenceRegistry.get(relTo);
            if (relatedObject) {
              const ref = relatedObject.id;
              // If ref is not found, then leave intact because we may not have processed
              // this parent fully. We'll go back through the sObject tree
              // later and replace the id with a reference.
              return ref ? `@${ref}` : id;
            } else {
              // again, this will just be the id for now and replaced with a ref later.
              return id;
            }
          } else {
            // TODO: what to do if ref not found?
            const recordId: string = record['Id'] as string;
            this.logger.error(`Reference ${relTo} not found for ${key}.  Skipping record ${recordId}.`);
          }
        }
      } else {
        // not a relationship field, simple key/value insertion
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return record[key];
      }
    }

    return;

    // .then((processedAttribute) => {
    //   if (processedAttribute !== null) {
    //     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    //     treeRecord[key] = processedAttribute;
    //   }

    //   return Promise.resolve(null);
    // })
    // .catch((e) => {
    //   throw e;
    // });
  }

  // return Promise.resolve(null);
  // });
  // }

  // Get sObject description and cache for given object type
  private async loadMetadata(objectName: string): Promise<DescribeSObjectResult> {
    describe[objectName] ??= await this.org.getConnection().sobject(objectName).describe();
    return describe[objectName];
  }

  private isQueryResult(metadata: DescribeSObjectResult, fieldName: string): boolean {
    return metadata.childRelationships.some((cr: any) => cr.relationshipName === fieldName);
  }

  private isSpecificTypeWithMetadata(metadata: any, fieldName: string, fieldType: string): boolean {
    for (let i = 0, fld; i < metadata.fields.length; i++) {
      fld = metadata.fields[i] as { name: string; type: string };
      /* eslint-disable @typescript-eslint/no-unsafe-call */
      if (fld.name.toLowerCase() === fieldName.toLowerCase()) {
        if (fld.type.toLowerCase() === fieldType.toLowerCase()) {
          return true;
        }
      }
      /* eslint-enable @typescript-eslint/no-unsafe-call */
    }

    return false;
  }

  private getRelationshipFieldName(metadata: DescribeSObjectResult, parentName: string): string {
    const result = metadata.fields.find((field: any) => {
      if (field.type === 'reference') {
        for (const refTo of field.referenceTo) {
          if (refTo === parentName) {
            return true;
          }
        }
      }
      return false;
    });

    if (!result) {
      throw new SfdxError(`Unable to find relationship field name for ${metadata.name}`);
    }

    return result.name;
  }

  private isRelationship(objectName: string, fieldName: string): boolean {
    if (!describe[objectName]) {
      throw new SfdxError(`Metadata not found for ${objectName}`);
    }
    return this.isRelationshipWithMetadata(describe[objectName], fieldName);
  }

  private isRelationshipWithMetadata(metadata: any, fieldName: string): boolean {
    return this.isSpecificTypeWithMetadata(metadata, fieldName, 'reference');
  }

  private getRelatedTo(objectName: string, fieldName: string): string {
    if (!describe[objectName]) {
      throw new SfdxError(`Metadata not found for ${objectName}`);
    }
    return this.getRelatedToWithMetadata(describe[objectName], fieldName);
  }

  private getRelatedToWithMetadata(metadata: any, fieldName: string): string {
    const result = (metadata.fields as [{ name: string; type: string; referenceTo: string[] }]).find((field) => {
      if (field.name === fieldName) {
        if (field.referenceTo.length) {
          return true;
        }
        return false;
      }
      return false;
    });

    if (!result) {
      throw new SfdxError(`Unable to find relation for ${metadata.name as string}`);
    }

    return result.referenceTo[0];
  }

  // Register object type's id to reference mapping
  private saveRecordRef(obj: BasicRecord, refId: string): void {
    const id = path.basename(obj.attributes.url);
    const ref = refId;

    const type = obj.attributes.type;

    // ensure no existing reference
    const refEntry = this.referenceRegistry.get(type)?.id;
    if (refEntry && refEntry !== ref) {
      throw new SfdxError(`Overriding ${type} reference for ${id}: existing ${refEntry}, incoming ${ref}`);
    }

    this.referenceRegistry.set(type, { id: ref });
  }

  /**
   * Walk the final data set and split out into files.  The main queried
   * object is the parent, and has a different saveRefs and resolveRefs
   * values.  All the references have been created at this point.
   */
  private generateDataPlan(sobjectTree: SObjectTreeFileContents): DataPlanPart[] {
    const objects = new Map<string, { records: SObjectTreeInput[] }>();
    const dataPlan: DataPlanPart[] = [];
    let topLevelObjectType: string;

    // loop thru object tree extracting type-specific records into separate tree structure
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    sobjectTree.records.forEach((record) => {
      topLevelObjectType = record.attributes.type;
      if (!objects.has(topLevelObjectType)) {
        objects.set(topLevelObjectType, { records: [] });
      }

      Object.entries(record).map(([key, value]) => {
        if (hasNestedRecords<SObjectTreeInput>(value)) {
          const childRecords = value.records;
          // found child records, add to type-specific registry
          if (childRecords.length) {
            const childObjectType = childRecords[0].attributes.type;

            if (!objects.has(childObjectType)) {
              objects.set(childObjectType, { records: [] });
            }

            childRecords.forEach((child) => {
              (objects.get(topLevelObjectType) as SObjectTreeFileContents).records.push(child);
            });
          }

          // remove child from top-level object structure
          delete record[key];
        }

        return key;
      });

      (objects.get(topLevelObjectType) as SObjectTreeFileContents).records.push(record);
    });

    // sort object types based on insertion dependence
    const objectsSorted = Object.keys(this.objectTypeRegistry).sort(
      (a, b) => this.objectTypeRegistry[a].order - this.objectTypeRegistry[b].order
    );

    // write data files and update data plan
    objectsSorted.forEach((key) => {
      const dataPlanPart = this.writeObjectTypeDataFile(
        key,
        !!this.objectTypeRegistry[key].saveRefs,
        !!this.objectTypeRegistry[key].resolveRefs,
        `${key}s.json`,
        objects.get(key) as SObjectTreeFileContents
      );
      dataPlan.push(dataPlanPart);
    });

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
    let finalFilename = fileName;
    if (this.config.prefix) {
      finalFilename = `${this.config.prefix}-${fileName}`;
    }
    const dataPlanPart = {
      sobject: type,
      saveRefs,
      resolveRefs,
      files: [finalFilename],
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

          if (this.isRelationship(objType, field)) {
            if (typeof value === 'string' && value.startsWith('@')) {
              const id = value;
              const refTo = this.getRelatedTo(objType, field);
              const ref = this.referenceRegistry.get(refTo)?.id;

              if (!ref) {
                throw new SfdxError(`${objType} reference to ${refTo} (${id}) not found in query results.`);
              }

              record[field] = `@${ref}`;

              // Setup dependency ordering for later output
              if (this.objectTypeRegistry[objType].order <= this.objectTypeRegistry[refTo].order) {
                this.objectTypeRegistry[objType].order = Number(this.objectTypeRegistry[refTo].order) + 1;
                this.objectTypeRegistry[refTo].saveRefs = true;
                this.objectTypeRegistry[objType].resolveRefs = true;
              }
            }
          }
        }

        return field;
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

  private writeDataFileSync<T extends SObjectTreeFileContents | DataPlanPart[]>(fileName: string, jsonObject: T): T {
    let recordCount = 0;
    const { outputDir, prefix } = this.config;

    if (prefix) {
      fileName = `${prefix}-${fileName}`;
    }

    if (outputDir) {
      fileName = path.join(outputDir, fileName);
    }

    if (hasNestedRecords(jsonObject)) {
      recordCount = this.countRecords(jsonObject.records);
    }

    fs.writeFileSync(fileName, JSON.stringify(jsonObject, null, 4));

    // TODO: move this to the command
    this.ux.log(`Wrote ${recordCount} records to ${fileName}`);

    return jsonObject;
  }
}
