/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { flags, FlagsConfig } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { RecordResult } from 'jsforce';
import { DataCommand } from '../../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.update');
const commonMessages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export default class Update extends DataCommand {
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
    values: flags.string({
      char: 'v',
      required: true,
      description: messages.getMessage('values'),
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

  public async run(): Promise<RecordResult> {
    this.validateIdXorWhereFlags();

    this.ux.startSpinner('Updating Record');

    let status = 'Success';
    const sobject = this.getConnection().sobject(this.flags.sobjecttype);
    const sObjectId = (this.flags.sobjectid || (await this.query(sobject, this.flags.where)).Id) as string;
    try {
      const updateObject = this.stringToDictionary(this.flags.values);
      updateObject.Id = sObjectId;
      const result = await sobject.update(updateObject);
      if (result.success) {
        this.ux.log(messages.getMessage('updateSuccess', [sObjectId]));
      } else {
        const errors = this.collectErrorMessages(result);
        this.ux.error(messages.getMessage('updateFailure', [errors]));
      }
      this.ux.stopSpinner(status);
      return result;
    } catch (err) {
      status = 'Failed';
      this.ux.stopSpinner(status);
      if (Reflect.has(err, 'errorCode') && Reflect.has(err, 'fields')) {
        throw new SfdxError(
          messages.getMessage('updateFailureWithFields', [Reflect.get(err, 'errorCode'), Reflect.get(err, 'fields')])
        );
      } else {
        throw err;
      }
    }
  }
}
