/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import { AnyJson, Dictionary, getString, JsonMap } from '@salesforce/ts-types';
import { Logger, Messages, Org, SchemaValidator, SfError } from '@salesforce/core';
import { DataPlanPart, hasNestedRecords, isAttributesElement, SObjectTreeInput } from '../../../dataSoqlQueryTypes';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'importApi');

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
  contentType?: string;
  sobjectTreeFiles?: string[];
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

  public constructor(private readonly org: Org, private readonly cli: string, private readonly separator: string) {
    this.logger = Logger.childFromRoot(this.constructor.name);
    this.schemaValidator = new SchemaValidator(this.logger, importPlanSchemaFile);
  }

  /**
   * Inserts given SObject Tree content into given target Org.
   *
   * @param config
   */
  public async import(config: ImportConfig): Promise<ImportResults> {
    const importResults: ImportResults = {};
    const instanceUrl = this.org.getField<string>(Org.Fields.INSTANCE_URL);

    this.config = await this.validate(config);

    const refMap = new Map<string, string>();

    const { contentType, plan, sobjectTreeFiles = [] } = this.config;

    try {
      // original version of this did files sequentially.  Not sure what happens if you did it in parallel
      // so this still awaits each file individually
      if (plan) {
        await this.getPlanPromises({ plan, contentType, refMap, instanceUrl });
      } else {
        for (const promise of sobjectTreeFiles.map((file) =>
          this.importSObjectTreeFile({
            instanceUrl,
            refMap,
            filepath: path.resolve(process.cwd(), file),
            contentType,
          })
        )) {
          // eslint-disable-next-line no-await-in-loop
          await promise;
        }
      }

      importResults.responseRefs = this.responseRefs;
      importResults.sobjectTypes = this.sobjectTypes;
    } catch (err) {
      if (!(err instanceof SfError)) {
        throw err;
      }
      const error = err as Error;
      if (getString(error, 'errorCode') === 'ERROR_HTTP_400' && error.message != null) {
        try {
          const msg = JSON.parse(error.message) as { hasErrors?: boolean; results?: [] };
          if (msg.hasErrors && msg.results && msg.results.length > 0) {
            importResults.errors = msg.results;
          }
        } catch (e2) {
          // throw original
        }
      }

      throw SfError.wrap(error);
    }

    return importResults;
  }

  public getSchema(): JsonMap {
    return this.schemaValidator.loadSync();
  }

  // Does some basic validation on the filepath and returns some file metadata such as
  // isJson, refRegex, and headers.
  // eslint-disable-next-line class-methods-use-this
  public getSObjectTreeFileMeta(filepath: string, contentType?: string): RequestMeta {
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
      throw new SfError(messages.getMessage('dataFileNotFound', [filepath]), INVALID_DATA_IMPORT_ERR_NAME);
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
        throw new SfError(messages.getMessage('unknownContentType', [filepath]), INVALID_DATA_IMPORT_ERR_NAME);
      } else if (contentType.toUpperCase() === 'JSON') {
        tmpContentType = jsonContentType;
        meta.isJson = true;
        meta.refRegex = jsonRefRegex;
      } else if (contentType.toUpperCase() === 'XML') {
        tmpContentType = xmlContentType;
        meta.refRegex = xmlRefRegex;
      } else {
        throw new SfError(messages.getMessage('dataFileUnsupported', [contentType]), INVALID_DATA_IMPORT_ERR_NAME);
      }
    }

    meta.headers['content-type'] = tmpContentType;

    return meta;
  }

  private async getPlanPromises({
    plan,
    contentType,
    refMap,
    instanceUrl,
  }: {
    plan: string;
    contentType?: string;
    refMap: Map<string, string>;
    instanceUrl: string;
  }): Promise<void> {
    // REVIEWME: support both files and plan in same invocation?
    const importPlanRootPath = path.dirname(plan);
    for (const sobjectConfig of this.importPlanConfig) {
      const globalSaveRefs = sobjectConfig.saveRefs != null ? sobjectConfig.saveRefs : false;
      const globalResolveRefs = sobjectConfig.resolveRefs != null ? sobjectConfig.resolveRefs : false;
      for (const fileDef of sobjectConfig.files) {
        let filepath: string;
        let saveRefs = globalSaveRefs;
        let resolveRefs = globalResolveRefs;

        // file definition can be just a filepath or an object that
        // has a filepath and overriding global config
        if (typeof fileDef === 'string') {
          filepath = fileDef;
        } else if (fileDef.file) {
          filepath = fileDef.file;

          // override save references, if set
          saveRefs = fileDef.saveRefs == null ? globalSaveRefs : fileDef.saveRefs;

          // override resolve references, if set
          resolveRefs = fileDef.resolveRefs == null ? globalResolveRefs : fileDef.resolveRefs;
        } else {
          throw new SfError('file definition format unknown.', 'InvalidDataImportPlan');
        }

        filepath = path.resolve(importPlanRootPath, filepath);
        const importConfig: DataImportComponents = {
          instanceUrl,
          saveRefs,
          resolveRefs,
          refMap,
          filepath,
          contentType,
        };
        // eslint-disable-next-line no-await-in-loop
        await this.importSObjectTreeFile(importConfig);
      }
    }
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
      throw new SfError(messages.getMessage('dataFileNotProvided'), INVALID_DATA_IMPORT_ERR_NAME);
    }

    // Prevent both --sobjecttreefiles and --plan option from being set
    if (sobjectTreeFiles && plan) {
      throw new SfError(messages.getMessage('tooManyFiles'), INVALID_DATA_IMPORT_ERR_NAME);
    }

    if (plan) {
      const planPath = path.resolve(process.cwd(), plan);

      if (!fs.existsSync(planPath)) {
        throw new SfError(messages.getMessage('dataFileNotFound', [planPath]), INVALID_DATA_IMPORT_ERR_NAME);
      }

      this.importPlanConfig = JSON.parse(fs.readFileSync(planPath, 'utf8')) as DataPlanPart[];
      try {
        await this.schemaValidator.validate(this.importPlanConfig as unknown as AnyJson);
      } catch (err) {
        const error = err as Error;
        if (error.name === 'ValidationSchemaFieldErrors') {
          throw new SfError(
            messages.getMessage('dataPlanValidationError', [planPath, error.message]),
            INVALID_DATA_IMPORT_ERR_NAME,
            messages.getMessages('dataPlanValidationErrorActions', [
              this.cli,
              this.separator,
              this.separator,
              this.cli,
              this.separator,
              this.separator,
            ])
          );
        }
        throw SfError.wrap(error);
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
    const getTypes = (records: SObjectTreeInput[]): void => {
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
      const contentJson = JSON.parse(content) as { records: SObjectTreeInput[] };
      if (Array.isArray(contentJson.records)) {
        getTypes(contentJson.records);
      }
    }
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
    let match: RegExpExecArray | null;
    let sobject = '';
    const foundRefs = new Set<string>();

    // call identity() so the access token can be auto-updated
    const content = await fs.promises.readFile(filepath);
    if (!content) {
      throw messages.createError('dataFileEmpty', [filepath]);
    }

    contentStr = content.toString();

    if (isJson) {
      // is valid json?  (save round-trip to server)
      try {
        const contentJson = JSON.parse(contentStr) as { records: SObjectTreeInput[] };

        // All top level records should be of the same sObject type so just grab the first one
        sobject = contentJson.records[0].attributes.type.toLowerCase();
      } catch (e) {
        throw messages.createError('dataFileInvalidJson', [filepath]);
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
        throw messages.createError('dataFileNoRefId', [filepath]);
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
      headers: headers as Record<string, string>,
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

      if (response.hasErrors === true) {
        throw messages.createError('dataImportFailed', [filepath, JSON.stringify(response.results, null, 4)]);
      }

      if (Array.isArray(response.results)) {
        // REVIEWME: include filepath from which record was define?
        // store results to be output to stdout in aggregated tabular format
        this.responseRefs = this.responseRefs.concat(response.results);

        // if enabled, save references to map to be used to replace references
        // prior to subsequent saves
        if (saveRefs && refMap) {
          response.results.forEach((result) => {
            refMap.set(result.referenceId.toLowerCase(), result.id);
          });
        }
      }
    } else {
      throw new SfError('SObject Tree API XML response parsing not implemented', 'FailedDataImport');
    }

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
        throw messages.createError('FlsError', [field, object]);
      }
      throw SfError.wrap(error as Error);
    }
  }
}
