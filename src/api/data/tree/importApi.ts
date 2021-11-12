/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import * as path from 'path';
import * as util from 'util';

import { Dictionary, isObject, getString, JsonMap, AnyJson } from '@salesforce/ts-types';
import { fs, Logger, Org, SfdxError, SchemaValidator } from '@salesforce/core';
import { DataPlanPart, SObjectTreeInput, hasNestedRecords, isAttributesElement } from '../../../dataSoqlQueryTypes';

const importPlanSchemaFile = path.join(__dirname, '..', '..', '..', '..', 'schema', 'dataImportPlanSchema.json');

const sobjectTreeApiPartPattern = '%s/services/data/v%s/composite/tree/%s';
const jsonContentType = 'application/json';
const xmlContentType = 'application/xml';
const jsonRefRegex = /[.]*["|'][A-Z0-9_]*["|'][ ]*:[ ]*["|']@([A-Z0-9_]*)["|'][.]*/gim;
const xmlRefRegex = /[.]*<[A-Z0-9_]*>@([A-Z0-9_]*)<\/[A-Z0-9_]*[ID]>[.]*/gim;

const INVALID_DATA_IMPORT_ERR_NAME = 'InvalidDataImport';

type TreeResponse =
  | {
      hasErrors: false;
      results: Array<{
        referenceId: string;
        id: string;
      }>;
    }
  | {
      hasErrors: true;
      results: Array<{
        referenceId: string;
        errors: Array<{
          statusCode: string;
          message: string;
          fields: string[];
        }>;
      }>;
    };

interface DataImportComponents {
  instanceUrl: string;
  saveRefs?: boolean;
  resolveRefs?: boolean;
  refMap: Map<string, string>;
  filepath: string;
  contentType?: string;
}

export interface ImportConfig {
  sobjectTreeFiles?: string[];
  contentType?: string;
  plan?: string;
}

interface ResponseRefs {
  referenceId: string;
  id: string;
}

export interface ImportResults {
  responseRefs?: ResponseRefs[];
  sobjectTypes?: Dictionary;
  errors?: string[];
}

interface RequestMeta {
  refRegex: RegExp;
  isJson: boolean;
  headers: Dictionary;
}

/**
 * Imports data into an org that was exported to files using the export API.
 */
export class ImportApi {
  private logger: Logger;
  private responseRefs: ResponseRefs[] = [];
  private sobjectUrlMap = new Map<string, string>();
  private schemaValidator: SchemaValidator;
  private sobjectTypes: Record<string, string> = {};
  private config!: ImportConfig;
  private importPlanConfig: DataPlanPart[] = [];
  private instanceUrl: string;
  public constructor(private readonly org: Org) {
    this.logger = Logger.childFromRoot(this.constructor.name);
    this.schemaValidator = new SchemaValidator(this.logger, importPlanSchemaFile);
    this.instanceUrl = this.org.getField(Org.Fields.INSTANCE_URL) as string;
  }

  /**
   * Inserts given SObject Tree content into given target Org.
   *
   * @param config
   */
  public async import(config: ImportConfig): Promise<ImportResults> {
    const importResults: ImportResults = {};

    this.config = await this.validate(config);

    const refMap = new Map<string, string>();

    const { contentType, plan, sobjectTreeFiles = [] } = this.config;

    try {
      // original version of this did files sequentially.  Not sure what happens if you did it in parallel
      // so this still awaits each file individually
      for (const promise of sobjectTreeFiles
        .map((file) =>
          this.importSObjectTreeFile({
            instanceUrl: this.instanceUrl,
            refMap,
            filepath: path.resolve(process.cwd(), file),
            contentType,
          })
        )
        .concat(this.getPlanPromises({ plan, contentType, refMap }))) {
        await promise;
      }

      // await sequentialExecute(planFns);
      importResults.responseRefs = this.responseRefs;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      importResults.sobjectTypes = this.sobjectTypes;
    } catch (err) {
      const error = err as Error;
      if (getString(error, 'errorCode') === 'ERROR_HTTP_400' && error.message != null) {
        let msg;
        try {
          msg = JSON.parse(error.message) as { hasErrors?: boolean; results?: [] };
          if (msg.hasErrors && msg.results && msg.results.length > 0) {
            importResults.errors = msg.results;
          }
        } catch (e2) {
          // throw original
        }
      }

      throw SfdxError.wrap(error);
    }

    return importResults;
  }

  public getSchema(): JsonMap {
    return this.schemaValidator.loadSync();
  }

  private getPlanPromises({
    plan,
    contentType,
    refMap,
  }: {
    plan?: string;
    contentType?: string;
    refMap: Map<string, string>;
  }): Array<Promise<void>> {
    const output: Array<Promise<void>> = [];
    if (!plan || !this.importPlanConfig.length) {
      return output;
    }
    // REVIEWME: support both files and plan in same invocation?
    const importPlanRootPath = path.dirname(plan);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    this.importPlanConfig.forEach((sobjectConfig: DataPlanPart) => {
      const globalSaveRefs = sobjectConfig.saveRefs != null ? sobjectConfig.saveRefs : false;
      const globalResolveRefs = sobjectConfig.resolveRefs != null ? sobjectConfig.resolveRefs : false;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      sobjectConfig.files.forEach((fileDef: string | (DataPlanPart & { file: string })) => {
        let filepath;
        let saveRefs = globalSaveRefs;
        let resolveRefs = globalResolveRefs;

        // file definition can be just a filepath or an object that
        // has a filepath and overriding global config
        if (typeof fileDef === 'string') {
          filepath = fileDef;
        } else if (isObject(fileDef)) {
          filepath = fileDef.file;

          // override save references, if set
          saveRefs = fileDef.saveRefs == null ? globalSaveRefs : fileDef.saveRefs;

          // override resolve references, if set
          resolveRefs = fileDef.resolveRefs == null ? globalResolveRefs : fileDef.resolveRefs;
        } else {
          throw new SfdxError('file definition format unknown.', 'InvalidDataImportPlan');
        }

        filepath = path.resolve(importPlanRootPath, filepath);
        const importConfig: DataImportComponents = {
          instanceUrl: this.instanceUrl,
          saveRefs,
          resolveRefs,
          refMap,
          filepath,
          contentType,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        output.push(this.importSObjectTreeFile(importConfig));
      });
    });
    return output;
  }

  /**
   * Validates the import configuration.  If a plan is passed, validates
   * the plan per the schema.
   *
   * @param config - The data import configuration.
   * @returns Promise.<ImportConfig>
   */
  private async validate(config: ImportConfig): Promise<ImportConfig> {
    const { sobjectTreeFiles, plan } = config;

    // --sobjecttreefiles option is required when --plan option is unset
    if (!sobjectTreeFiles && !plan) {
      const err = SfdxError.create('@salesforce/plugin-data', 'importApi', 'dataFileNotProvided');
      err.name = INVALID_DATA_IMPORT_ERR_NAME;
      throw err;
    }

    // Prevent both --sobjecttreefiles and --plan option from being set
    if (sobjectTreeFiles && plan) {
      const err = SfdxError.create('@salesforce/plugin-data', 'importApi', 'tooManyFiles');
      err.name = INVALID_DATA_IMPORT_ERR_NAME;
      throw err;
    }

    if (plan) {
      const planPath = path.resolve(process.cwd(), plan);
      try {
        fs.statSync(planPath);
      } catch (e) {
        const err = SfdxError.create('@salesforce/plugin-data', 'importApi', 'dataFileNotFound', [planPath]);
        err.name = INVALID_DATA_IMPORT_ERR_NAME;
        throw err;
      }

      this.importPlanConfig = JSON.parse(fs.readFileSync(planPath, 'utf8')) as DataPlanPart[];
      try {
        await this.schemaValidator.validate(this.importPlanConfig as unknown as AnyJson);
      } catch (err) {
        const error = err as Error;
        if (error.name === 'ValidationSchemaFieldErrors') {
          const e = SfdxError.create('@salesforce/plugin-data', 'importApi', 'dataPlanValidationError', [
            planPath,
            error.message,
          ]);
          e.name = INVALID_DATA_IMPORT_ERR_NAME;
          throw e;
        }
        throw SfdxError.wrap(error);
      }
    }
    return config;
  }

  /**
   * Create a hash of sobject { ReferenceId: Type } assigned to this.sobjectTypes.
   * Used to display the sobject type in the results.
   *
   * @param content  The content string defined by the file(s).
   * @param isJson
   */
  private createSObjectTypeMap(content: string, isJson: boolean): void {
    let contentJson;

    const getTypes = (records: SObjectTreeInput[]): any => {
      records.forEach((record) => {
        Object.entries(record).forEach(([key, val]) => {
          if (key === 'attributes' && isAttributesElement(val)) {
            this.sobjectTypes[val.referenceId] = val.type;
          } else if (hasNestedRecords<SObjectTreeInput>(val) && Array.isArray(val.records)) {
            getTypes(val.records);
          }
        });
      });
    };

    if (isJson) {
      contentJson = JSON.parse(content) as { records: SObjectTreeInput[] };
      if (Array.isArray(contentJson.records)) {
        getTypes(contentJson.records);
      }
    }
  }

  // Does some basic validation on the filepath and returns some file metadata such as
  // isJson, refRegex, and headers.
  private getSObjectTreeFileMeta(filepath: string, contentType?: string): RequestMeta {
    const meta: RequestMeta = {
      isJson: false,
      headers: {} as Dictionary,
      refRegex: new RegExp(/./),
    };
    let tmpContentType;

    // explicitly validate filepath so, if not found, we can return friendly error message
    try {
      fs.statSync(filepath);
    } catch (e) {
      const err = SfdxError.create('@salesforce/plugin-data', 'importApi', 'dataFileNotFound', [filepath]);
      err.name = INVALID_DATA_IMPORT_ERR_NAME;
      throw err;
    }

    // determine content type
    if (filepath.endsWith('.json')) {
      tmpContentType = jsonContentType;
      meta.isJson = true;
      meta.refRegex = jsonRefRegex;
    } else if (filepath.endsWith('.xml')) {
      tmpContentType = xmlContentType;
      meta.refRegex = xmlRefRegex;
    }

    // unable to determine content type from extension, was a global content type provided?
    if (!tmpContentType) {
      if (!contentType) {
        const err = SfdxError.create('@salesforce/plugin-data', 'importApi', 'unknownContentType', [filepath]);
        err.name = INVALID_DATA_IMPORT_ERR_NAME;
        throw err;
      } else if (contentType.toUpperCase() === 'JSON') {
        tmpContentType = jsonContentType;
        meta.isJson = true;
        meta.refRegex = jsonRefRegex;
      } else if (contentType.toUpperCase() === 'XML') {
        tmpContentType = xmlContentType;
        meta.refRegex = xmlRefRegex;
      } else {
        const err = SfdxError.create('@salesforce/plugin-data', 'importApi', 'dataFileUnsupported', [contentType]);
        err.name = INVALID_DATA_IMPORT_ERR_NAME;
        throw err;
      }
    }

    meta.headers['content-type'] = tmpContentType;

    return meta;
  }

  // Parse the SObject tree file, resolving any saved refs if specified.
  // Return a promise with the contents of the SObject tree file and the type.
  private async parseSObjectTreeFile(
    filepath: string,
    isJson: boolean,
    refRegex: RegExp,
    resolveRefs?: boolean,
    refMap?: Map<string, string>
  ): Promise<{ contentStr: string; sobject: string }> {
    let contentStr: string;
    let contentJson;
    let match;
    let sobject = '';
    const foundRefs = new Set<string>();

    // call identity() so the access token can be auto-updated
    const content = await fs.readFile(filepath);
    if (!content) {
      throw SfdxError.create('@salesforce/plugin-data', 'importApi', 'dataFileEmpty', [filepath]);
    }

    contentStr = content.toString();

    if (isJson) {
      // is valid json?  (save round-trip to server)
      try {
        contentJson = JSON.parse(contentStr) as { records: SObjectTreeInput[] };

        // All top level records should be of the same sObject type so just grab the first one
        const type = contentJson.records[0].attributes.type;
        sobject = type ? type.toLowerCase() : sobject;
      } catch (e) {
        throw SfdxError.create('@salesforce/plugin-data', 'importApi', 'dataFileInvalidJson', [filepath]);
      }
    }

    // if we're replacing references (@AcmeIncAccountId), find references in content and
    // replace with reference found in previously saved records
    if (resolveRefs && refMap) {
      // find and stash all '@' references
      while ((match = refRegex.exec(contentStr))) {
        foundRefs.add(match[1]);
      }

      if (foundRefs.size > 0 && refMap.size === 0) {
        throw SfdxError.create('@salesforce/plugin-data', 'importApi', 'dataFileNoRefId', [filepath]);
      }

      this.logger.debug(`Found references: ${Array.from(foundRefs).toString()}`);

      // loop thru found references and replace with id value
      foundRefs.forEach((ref) => {
        const value = refMap.get(ref.toLowerCase());
        if (value == null) {
          // REVIEWME: fail?
          this.logger.warn(`Reference '${ref}' not found in saved record references (${filepath})`);
        } else {
          contentStr = contentStr.replace(new RegExp(`(["'>])@${ref}(["'<])`, 'igm'), `$1${value}$2`);
        }
      });
    }

    // Create map of SObject { referenceId: type } to display the type in output
    this.createSObjectTypeMap(contentStr, isJson);

    return { contentStr, sobject };
  }

  // generate REST API url: http://<sfdc-instance>/v<version>/composite/tree/<sobject>
  // and send the request.
  private async sendSObjectTreeRequest(
    contentStr: string,
    sobject: string,
    instanceUrl: string,
    headers: Dictionary
  ): Promise<TreeResponse> {
    const apiVersion = this.org.getConnection().getApiVersion();
    let sobjectTreeApiUrl = this.sobjectUrlMap.get(sobject);

    if (!sobjectTreeApiUrl) {
      sobjectTreeApiUrl = util.format(sobjectTreeApiPartPattern, instanceUrl, apiVersion, sobject);
      this.sobjectUrlMap.set(sobject, sobjectTreeApiUrl);
    }

    this.logger.debug(`SObject Tree API URL: ${sobjectTreeApiUrl}`);

    // post request with to-be-insert sobject tree content
    return this.org.getConnection().request({
      method: 'POST',
      url: sobjectTreeApiUrl,
      body: contentStr,
      headers,
    });
  }

  // Parse the response from the SObjectTree request and save refs if specified.
  private parseSObjectTreeResponse(
    response: TreeResponse,
    filepath: string,
    isJson: boolean,
    saveRefs?: boolean,
    refMap?: Map<string, string>
  ): TreeResponse {
    if (isJson) {
      this.logger.debug(`SObject Tree API results:  ${JSON.stringify(response, null, 4)}`);

      if (response.hasErrors) {
        throw SfdxError.create('@salesforce/plugin-data', 'importApi', 'dataImportFailed', [
          filepath,
          JSON.stringify(response.results, null, 4),
        ]);
      }

      if (Array.isArray(response.results)) {
        // REVIEWME: include filepath from which record was define?
        // store results to be output to stdout in aggregated tabular format
        this.responseRefs = this.responseRefs.concat(response.results);

        // if enabled, save references to map to be used to replace references
        // prior to subsequent saves
        if (saveRefs) {
          for (let i = 0, len = response.results.length, ref; i < len; i++) {
            ref = response.results[i] as { referenceId: string; id: string };
            if (refMap) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              refMap.set(ref.referenceId.toLowerCase(), ref.id);
            }
          }
        }
      }
    } else {
      throw new SfdxError('SObject Tree API XML response parsing not implemented', 'FailedDataImport');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response;
  }

  // Imports the SObjectTree from the provided files/plan by making a POST request to the server.
  private async importSObjectTreeFile(components: DataImportComponents): Promise<void> {
    // Get some file metadata
    const { isJson, refRegex, headers } = this.getSObjectTreeFileMeta(components.filepath, components.contentType);

    this.logger.debug(`Importing SObject Tree data from file ${components.filepath}`);
    try {
      const { contentStr, sobject } = await this.parseSObjectTreeFile(
        components.filepath,
        isJson,
        refRegex,
        components.resolveRefs,
        components.refMap
      );
      const response = await this.sendSObjectTreeRequest(contentStr, sobject, components.instanceUrl, headers);
      this.parseSObjectTreeResponse(response, components.filepath, isJson, components.saveRefs, components.refMap);
    } catch (error) {
      if (error instanceof Error && getString(error, 'errorCode') === 'INVALID_FIELD') {
        const field = error.message.split("'")[1];
        const object = error.message.substr(error.message.lastIndexOf(' ') + 1, error.message.length);
        throw SfdxError.create('@salesforce/plugin-data', 'importApi', 'FlsError', [field, object]);
      }
      throw SfdxError.wrap(error as Error);
    }
  }
}
