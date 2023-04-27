/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { SaveResult } from 'jsforce';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { orgFlags, perflogFlag } from '../../../flags';
import { stringToDictionary, collectErrorMessages } from '../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.create');

export default class Create extends SfCommand<SaveResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:record:create'];
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
    values: Flags.string({
      char: 'v',
      required: true,
      summary: messages.getMessage('flags.values'),
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
    const { flags } = await this.parse(Create);
    this.spinner.start(`Creating record for ${flags.sobject}`);

    const sobject = (
      flags['use-tooling-api']
        ? flags['target-org'].getConnection(flags['api-version']).tooling
        : flags['target-org'].getConnection(flags['api-version'])
    ).sobject(flags.sobject);
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
