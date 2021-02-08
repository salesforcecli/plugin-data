/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { flags, FlagsConfig } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { Record } from 'jsforce';
import { AnyJson } from '@salesforce/ts-types';
import { DataCommand } from '../../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.get');
const commonMessages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export default class Get extends DataCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly requiresUsername = true;

  public static readonly flagsConfig: FlagsConfig = {
    sobjecttype: flags.string({
      char: 's',
      required: true,
      description: messages.getMessage('sObjectType'),
    }),
    sobjectid: flags.id({
      char: 'i',
      description: messages.getMessage('sObjectId'),
      exclusive: ['where'],
    }),
    where: flags.string({
      char: 'w',
      description: messages.getMessage('where'),
      exclusive: ['sobjectid'],
    }),
    usetoolingapi: flags.boolean({
      char: 't',
      description: messages.getMessage('useToolingApi'),
    }),
    perflog: flags.boolean({
      description: commonMessages.getMessage('perfLogLevelOption'),
      dependsOn: ['json'],
    }),
  };

  public async run(): Promise<Record<AnyJson>> {
    //  this.validateIdXorWhereFlags();

    this.ux.startSpinner('Getting Record');
    const sobject = this.getConnection().sobject(this.flags.sobjecttype);
    try {
      const sObjectId = this.flags.sobjectid || (await this.query(sobject, this.flags.where)).Id;
      const result = await sobject.retrieve(sObjectId);
      if (!this.flags.json) this.logNestedObject(result);
      this.ux.stopSpinner();
      return result;
    } catch (err) {
      this.ux.stopSpinner('failed');
      throw new SfdxError(err.name, err.message);
    }
  }
}
