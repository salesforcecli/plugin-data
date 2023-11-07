/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import url from 'node:url';
import path from 'node:path';
import { Messages, SfError } from '@salesforce/core';
import { SaveError, SaveResult } from 'jsforce';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { orgFlags } from '../../../flags.js';
import { collectErrorMessages, query, stringToDictionary } from '../../../dataCommand.js';

Messages.importMessagesDirectory(path.dirname(url.fileURLToPath(import.meta.url)));
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.update');
const commonMessages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export default class Update extends SfCommand<SaveResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:record:update'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    sobject: Flags.string({
      char: 's',
      required: true,
      summary: messages.getMessage('flags.sobject.summary'),
      aliases: ['sobjecttype'],
      deprecateAliases: true,
    }),
    // eslint-disable-next-line sf-plugin/id-flag-suggestions
    'record-id': Flags.salesforceId({
      char: 'i',
      length: 'both',
      summary: messages.getMessage('flags.record-id.summary'),
      exactlyOne: ['where', 'record-id'],
      aliases: ['sobjectid'],
      deprecateAliases: true,
    }),
    where: Flags.string({
      char: 'w',
      summary: messages.getMessage('flags.where.summary'),
      exactlyOne: ['where', 'record-id'],
    }),
    values: Flags.string({
      char: 'v',
      required: true,
      summary: messages.getMessage('flags.values.summary'),
    }),
    'use-tooling-api': Flags.boolean({
      char: 't',
      summary: messages.getMessage('flags.use-tooling-api.summary'),
      aliases: ['usetoolingapi'],
      deprecateAliases: true,
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
    const conn = flags['use-tooling-api']
      ? flags['target-org'].getConnection(flags['api-version']).tooling
      : flags['target-org'].getConnection(flags['api-version']);
    // oclif isn't smart of enough to know that if record-id is not set, then where is set
    const sObjectId = flags['record-id'] ?? ((await query(conn, flags.sobject, flags.where as string)).Id as string);
    try {
      const updateObject = { ...stringToDictionary(flags.values), Id: sObjectId };
      const result = await conn.sobject(flags.sobject).update(updateObject);
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
          messages.getMessage('updateFailureWithFields', [err.errorCode, err.message, (err.fields ?? []).join(',')])
        );
      } else {
        throw err;
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
const isSaveResult = (error: SaveError | Error | unknown): error is SaveError => {
  const se = error as SaveError;
  return Boolean(se.fields && se.errorCode && se.message);
};
