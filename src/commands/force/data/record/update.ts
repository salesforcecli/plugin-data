/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages, SfError } from '@salesforce/core';
import { SaveError, SaveResult } from 'jsforce';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { collectErrorMessages, query, stringToDictionary } from '../../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.update');
const commonMessages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export default class Update extends SfCommand<SaveResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static flags = {
    targetusername: Flags.requiredOrg({
      required: true,
      char: 'u',
      summary: messages.getMessage('targetusername'),
    }),
    sobjecttype: Flags.string({
      char: 's',
      required: true,
      summary: messages.getMessage('sObjectType'),
    }),
    sobjectid: Flags.salesforceId({
      char: 'i',
      summary: messages.getMessage('sObjectId'),
      exactlyOne: ['where', 'sobjectid'],
    }),
    where: Flags.string({
      char: 'w',
      summary: messages.getMessage('where'),
      exactlyOne: ['where', 'sobjectid'],
    }),
    values: Flags.string({
      char: 'v',
      required: true,
      summary: messages.getMessage('values'),
    }),
    usetoolingapi: Flags.boolean({
      char: 't',
      summary: messages.getMessage('useToolingApi'),
    }),
    perflog: Flags.boolean({
      summary: commonMessages.getMessage('perfLogLevelOption'),
      hidden: true,
      deprecated: {
        version: '57',
      },
    }),
  };

  public async run(): Promise<SaveResult> {
    const { flags } = await this.parse(Update);
    this.spinner.start('Updating Record');

    let status = 'Success';
    const conn = flags.usetoolingapi
      ? flags.targetusername.getConnection().tooling
      : flags.targetusername.getConnection();
    const sObjectId = flags.sobjectid ?? (await query(conn, flags.sobjecttype, flags.where)).Id;
    try {
      const updateObject = { ...stringToDictionary(flags.values), Id: sObjectId };
      const result = await conn.sobject(flags.sobjecttype).update(updateObject);
      if (result.success) {
        this.log(messages.getMessage('updateSuccess', [sObjectId]));
      } else {
        const errors = collectErrorMessages(result);
        this.error(messages.getMessage('updateFailure', [errors]));
      }
      this.spinner.stop(status);
      return result;
    } catch (err) {
      status = 'Failed';
      this.spinner.stop(status);
      if (isSaveResult(err)) {
        throw new SfError(
          messages.getMessage('updateFailureWithFields', [err.errorCode, err.message, err.fields.join(',')])
        );
      } else {
        throw err;
      }
    }
  }
}

const isSaveResult = (error: SaveError | Error | unknown): error is SaveError => {
  const se = error as SaveError;
  return Boolean(se.fields && se.errorCode && se.message);
};
