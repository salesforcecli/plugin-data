/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages, SfError } from '@salesforce/core';
import { SaveResult } from 'jsforce';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { orgFlags, perflogFlag } from '../../../flags';
import { collectErrorMessages, query } from '../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.delete');

export default class Delete extends SfCommand<SaveResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:record:delete'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    sobject: Flags.string({
      char: 's',
      required: true,
      summary: messages.getMessage('flags.sobject'),
      aliases: ['sobjecttype'],
      deprecateAliases: true,
    }),
    // eslint-disable-next-line sf-plugin/id-flag-suggestions
    'record-id': Flags.salesforceId({
      length: 'both',
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

  public async run(): Promise<SaveResult> {
    const { flags } = await this.parse(Delete);
    this.spinner.start('Deleting Record');
    let status = 'Success';

    try {
      const conn = flags['use-tooling-api']
        ? flags['target-org'].getConnection(flags['api-version']).tooling
        : flags['target-org'].getConnection(flags['api-version']);
      // "where flag" will be defined if sobjectId is not
      const sObjectId = flags['record-id'] ?? ((await query(conn, flags.sobject, flags.where as string)).Id as string);
      const result = await conn.sobject(flags.sobject).destroy(sObjectId);
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
      throw new SfError(err.message, err.name);
    }
  }
}
