/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Flags as oclifFlags } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { Flags } from '@salesforce/sf-plugins-core';

export const stringArrayFlag = oclifFlags.custom<string[]>({
  parse: async (input) => Promise.resolve(input.split(',').map((s) => s.trim())),
});

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/plugin-data', 'messages', [
  'flags.target-org',
  'perfLogLevelOption',
  'perfLogLevelOptionLong',
]);

export const targetOrgFlag = Flags.requiredOrg({
  required: true,
  char: 'o',
  summary: messages.getMessage('flags.target-org'),
  aliases: ['targetusername', 'u'],
  deprecateAliases: true,
});

export const perflogFlag = Flags.boolean({
  summary: messages.getMessage('perfLogLevelOption'),
  description: messages.getMessage('perfLogLevelOptionLong'),
  hidden: true,
  deprecated: {
    version: '57',
  },
});
