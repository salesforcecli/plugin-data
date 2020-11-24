/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages, Connection, SfdxError } from '@salesforce/core';
import { AnyJson, Dictionary } from '@salesforce/ts-types';
import * as jsforce from 'jsforce';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/data', 'messages');

export type SObjectRecord = jsforce.Record<AnyJson>;
export type SObjectResult = jsforce.RecordResult;
export type SObjectErrorResult = jsforce.ErrorResult;

interface Options {
  connection: Connection;
  sObjectType: string;
  useToolingApi?: boolean;
}

export class SObject {
  private connection: Connection;
  private useToolingApi: boolean;
  private sObjectType: string;

  public constructor(options: Options) {
    this.connection = options.connection;
    this.useToolingApi = options.useToolingApi || false;
    this.sObjectType = options.sObjectType;
  }

  /**
   * Insert new sobject with the provided key=value string (e.g. 'name=Acme foo=bar')
   */
  public async insert(values: string): Promise<SObjectResult> {
    const insertObject = stringToDictionary(values);
    const results = this.useToolingApi
      ? await this.connection.tooling.create(this.sObjectType, insertObject)
      : await this.connection.sobject(this.sObjectType).create(insertObject);

    return this.normalize<SObjectResult>(results);
  }

  /**
   * Delete the sobject with the given sobject id
   */
  public async delete(sObjectId: string): Promise<SObjectResult> {
    const results = this.useToolingApi
      ? await this.connection.tooling.destroy(this.sObjectType, sObjectId)
      : await this.connection.sobject(this.sObjectType).destroy(sObjectId);
    return this.normalize<SObjectResult>(results);
  }

  /**
   * Retrieve the sobject with the given sobject id
   */
  public async retrieve(sObjectId: string): Promise<SObjectRecord> {
    const record = this.useToolingApi
      ? await this.connection.tooling.retrieve(this.sObjectType, sObjectId)
      : await this.connection.sobject(this.sObjectType).retrieve(sObjectId);
    return this.normalize<SObjectRecord>(record);
  }

  /**
   * Update the sobject with the provided sobject id with the provided key=value string (e.g. 'name=Acme foo=bar')
   */
  public async update(sObjectId: string, values: string): Promise<SObjectResult> {
    const updateObject: SObjectRecord = stringToDictionary(values);
    updateObject.Id = sObjectId;
    const results = this.useToolingApi
      ? await this.connection.tooling.update(this.sObjectType, updateObject)
      : await this.connection.sobject(this.sObjectType).update(updateObject);
    return this.normalize<SObjectResult>(results);
  }

  /**
   * Query for an sobject that matches the provided where clause
   */
  public async query(where: string): Promise<SObjectRecord> {
    const queryObject = stringToDictionary(where);
    const records = this.useToolingApi
      ? await this.connection.tooling.sobject(this.sObjectType).find(queryObject, 'id')
      : await this.connection.sobject(this.sObjectType).find(queryObject, 'id');

    if (!records || records.length === 0) {
      throw new SfdxError('DataRecordGetNoRecord', messages.getMessage('DataRecordGetNoRecord'));
    }

    if (records.length > 1) {
      throw new SfdxError(
        'DataRecordGetMultipleRecords',
        messages.getMessage('DataRecordGetMultipleRecords', [where, this.sObjectType, records.length])
      );
    }

    return this.normalize<SObjectRecord>(records);
  }

  private normalize<T>(results: T | T[]): T {
    // jsforce returns RecordResult | RecordResult[]
    // but we're only ever dealing with a single sobject we are guaranteed to
    // get back a single RecordResult. Nevertheless, we ensure that it's a
    // single RecordResult to make Typescript happy
    return Array.isArray(results) ? results[0] : results;
  }
}
