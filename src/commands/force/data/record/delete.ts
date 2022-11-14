/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages, SfError } from '@salesforce/core';
import { SaveResult } from 'jsforce';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { collectErrorMessages, query } from '../../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.delete');
const commonMessages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export default class Delete extends SfCommand<SaveResult> {
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
    const { flags } = await this.parse(Delete);
    this.spinner.start('Deleting Record');
    let status = 'Success';

    try {
      const conn = flags.usetoolingapi
        ? flags.targetusername.getConnection().tooling
        : flags.targetusername.getConnection();
      // "where flag" will be defined if sobjectId is not
      const sObjectId = flags.sobjectid ?? (await query(conn, flags.sobjecttype, flags.where)).Id;
      const result = await conn.sobject(flags.sobjecttype).destroy(sObjectId);
      if (result.success) {
        this.log(messages.getMessage('deleteSuccess', [sObjectId]));
      } else {
        status = 'Failed';
        const errors = collectErrorMessages(result);
        this.error(messages.getMessage('deleteFailure', [errors]));
      }
      this.spinner.stop(status);
      return result;
    } catch (err) {
      status = 'Failed';
      this.spinner.stop(status);
      if (!(err instanceof Error)) {
        throw err;
      }
      throw new SfError(err.name, err.message);
    }
  }
}
