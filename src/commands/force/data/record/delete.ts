/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { flags, FlagsConfig } from '@salesforce/command';
import { Messages, SfError } from '@salesforce/core';
import { SaveResult } from 'jsforce';
import { DataCommand } from '../../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.delete');
const commonMessages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export default class Delete extends DataCommand {
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

  public async run(): Promise<SaveResult> {
    this.validateIdXorWhereFlags();

    this.ux.startSpinner('Deleting Record');
    let status = 'Success';

    try {
      const sobject = this.getConnection().sobject(this.flags.sobjecttype);
      const sObjectId = (this.flags.sobjectid || (await this.query(sobject, this.flags.where)).Id) as string;
      const result = this.normalize<SaveResult>(await sobject.destroy(sObjectId));

      if (result.success) {
        this.ux.log(messages.getMessage('deleteSuccess', [sObjectId]));
      } else {
        status = 'Failed';
        const errors = this.collectErrorMessages(result);
        this.ux.error(messages.getMessage('deleteFailure', [errors]));
      }
      this.ux.stopSpinner(status);
      return result;
    } catch (err) {
      status = 'Failed';
      this.ux.stopSpinner(status);
      throw new SfError((err as Error).name, (err as Error).message);
    }
  }
}
