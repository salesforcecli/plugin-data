/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { flags, FlagsConfig } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { SObject, SObjectRecord } from '@salesforce/data';
import { ensureString } from '@salesforce/ts-types';
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
      hidden: false,
      description: messages.getMessage('sObjectType'),
    }),
    sobjectid: flags.id({
      char: 'i',
      required: false,
      hidden: false,
      description: messages.getMessage('sObjectId'),
    }),
    where: flags.string({
      char: 'w',
      required: false,
      hidden: false,
      description: messages.getMessage('where'),
    }),
    usetoolingapi: flags.boolean({
      char: 't',
      required: false,
      hidden: false,
      description: messages.getMessage('useToolingApi'),
    }),
    perflog: flags.boolean({
      description: commonMessages.getMessage('perfLogLevelOption'),
      longDescription: commonMessages.getMessage('perfLogLevelOptionLong'),
    }),
  };

  public async run(): Promise<SObjectRecord> {
    this.validateIdXorWhereFlags();

    this.ux.startSpinner('Getting Record');
    const sobject = new SObject({
      connection: await this.getConnection(),
      sObjectType: this.flags.sobjecttype,
      useToolingApi: this.flags.usetoolingapi,
    });

    const sObjectId = ensureString(this.flags.sobjectid || (await sobject.query(this.flags.where)).Id);
    const result = await sobject.retrieve(sObjectId);
    if (!this.flags.json) this.ux.logJson(result);
    this.ux.stopSpinner();
    return result;
  }
}
