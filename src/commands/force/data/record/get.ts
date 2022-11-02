/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { Messages, SfError } from '@salesforce/core';
import { Record } from 'jsforce';
import { toAnyJson } from '@salesforce/ts-types';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { query, logNestedObject } from '../../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.get');
const commonMessages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export default class Get extends SfCommand<Record> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);

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

  public async run(): Promise<Record> {
    const { flags } = await this.parse(Get);
    this.spinner.start('Getting Record');
    const conn = flags.usetoolingapi
      ? flags.targetusername.getConnection().tooling
      : flags.targetusername.getConnection();
    try {
      const sObjectId = flags.sobjectid ?? (await query(conn, flags.sobjecttype, flags.where)).Id;
      const result = await conn.sobject(flags.sobjecttype).retrieve(sObjectId);
      if (!this.jsonEnabled()) {
        logNestedObject(result as never);
      }
      this.spinner.stop();
      return toAnyJson(result) as Record;
    } catch (err) {
      this.spinner.stop('failed');
      throw new SfError((err as Error).name, (err as Error).message);
    }
  }
}
