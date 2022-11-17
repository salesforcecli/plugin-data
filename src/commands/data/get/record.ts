/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages, SfError } from '@salesforce/core';
import { Record } from 'jsforce';
import { toAnyJson } from '@salesforce/ts-types';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { orgFlags, perflogFlag } from '../../../flags';
import { query, logNestedObject } from '../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.get');

export default class Get extends SfCommand<Record> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static aliases = ['force:data:record:get'];

  public static flags = {
    ...orgFlags,
    sobject: Flags.string({
      char: 's',
      required: true,
      summary: messages.getMessage('flags.sobject'),
      aliases: ['sobjecttype'],
      deprecateAliases: true,
    }),
    'record-id': Flags.salesforceId({
      char: 'i',
      summary: messages.getMessage('flags.recordId'),
      exactlyOne: ['where', 'record-id'],
      aliases: ['sobjectid'],
      deprecateAliases: true,
    }),
    where: Flags.string({
      char: 'w',
      summary: messages.getMessage('flags.where'),
      exactlyOne: ['where', 'record-id'],
    }),
    'use-tooling-api': Flags.boolean({
      char: 't',
      summary: messages.getMessage('flags.useToolingApi'),
      aliases: ['usetoolingapi'],
      deprecateAliases: true,
    }),
    perflog: perflogFlag,
  };

  public async run(): Promise<Record> {
    const { flags } = await this.parse(Get);
    this.spinner.start('Getting Record');
    const conn = flags['use-tooling-api']
      ? flags['target-org'].getConnection(flags['api-version']).tooling
      : flags['target-org'].getConnection(flags['api-version']);
    try {
      const sObjectId = flags['record-id'] ?? (await query(conn, flags.sobject, flags.where)).Id;
      const result = await conn.sobject(flags.sobject).retrieve(sObjectId);
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
