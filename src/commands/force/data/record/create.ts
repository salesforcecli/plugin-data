/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { Messages } from '@salesforce/core';
import { SaveResult } from 'jsforce';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { stringToDictionary, collectErrorMessages } from '../../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.create');
const commonMessages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export default class Create extends SfCommand<SaveResult> {
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
    const { flags } = await this.parse(Create);
    this.spinner.start(`Creating record for ${flags.sobjecttype}`);

    const sobject = (
      flags.usetoolingapi ? flags.targetusername.getConnection().tooling : flags.targetusername.getConnection()
    ).sobject(flags.sobjecttype);
    const values = stringToDictionary(flags.values);
    const result = await sobject.insert(values);
    if (result.success) {
      this.log(messages.getMessage('createSuccess', [result.id || 'unknown id']));
      this.spinner.stop();
    } else {
      const errors = collectErrorMessages(result);
      this.spinner.stop('failed');
      this.error(messages.getMessage('createFailure', [errors]));
    }
    return result;
  }
}
