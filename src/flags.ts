/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '@salesforce/core';
import {
  Flags,
  loglevel,
  orgApiVersionFlagWithDeprecations,
  requiredOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export const perflogFlag = Flags.boolean({
  summary: messages.getMessage('perfLogLevelOption'),
  description: messages.getMessage('perfLogLevelOptionLong'),
  hidden: true,
  deprecated: {
    version: '57',
  },
});

export const orgFlags = {
  'target-org': { ...requiredOrgFlagWithDeprecations, summary: messages.getMessage('flags.targetOrg.summary') },
  'api-version': orgApiVersionFlagWithDeprecations,
  loglevel,
};

export const resultFormatFlag = Flags.string({
  char: 'r',
  summary: messages.getMessage('flags.resultFormat'),
  options: ['human', 'json', 'csv'],
  default: 'human',
  aliases: ['resultformat'],
  deprecateAliases: true,
});
