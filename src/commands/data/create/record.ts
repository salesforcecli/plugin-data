/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Messages } from '@salesforce/core';
import type { SaveResult } from '@jsforce/jsforce-node';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { orgFlags, perflogFlag } from '../../../flags.js';
import { stringToDictionary, collectErrorMessages } from '../../../dataUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
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
      summary: messages.getMessage('flags.sobject.summary'),
      aliases: ['sobjecttype'],
      deprecateAliases: true,
    }),
    values: Flags.string({
      char: 'v',
      required: true,
      summary: messages.getMessage('flags.values.summary'),
    }),
    'use-tooling-api': Flags.boolean({
      char: 't',
      summary: messages.getMessage('flags.use-tooling-api.summary'),
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
