/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Interfaces } from '@oclif/core';
import { Messages, Org } from '@salesforce/core';
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

// Modifying a custom flag is an anti-pattern. Creating a new
// custom flag is the preferred approach. But if it must be done,
// then the type must be asserted so that @oclif/core can properly
// parse the flag's type.
const targetOrg = {
  ...requiredOrgFlagWithDeprecations,
  summary: messages.getMessage('flags.targetOrg.summary'),
} as Interfaces.OptionFlag<Org>;

export const orgFlags = {
  'target-org': targetOrg,
  'api-version': orgApiVersionFlagWithDeprecations,
  loglevel,
};

export const resultFormatFlag = Flags.string({
  char: 'r',
  summary: messages.getMessage('flags.resultFormat.summary'),
  options: ['human', 'json', 'csv'],
  default: 'human',
  aliases: ['resultformat'],
  deprecateAliases: true,
});
