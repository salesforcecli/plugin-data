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
import { FormatTypes, formatTypes } from './reporters/query/reporters.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export const perflogFlag = Flags.boolean({
  summary: messages.getMessage('perfLogLevelOption'),
  description: messages.getMessage('perfLogLevelOptionLong'),
  hidden: true,
  deprecated: {
    version: '57',
  },
});

/**
 * Use only for commands that maintain sfdx compatibility.
 *
 * @deprecated
 */
export const orgFlags = {
  'target-org': requiredOrgFlagWithDeprecations,
  'api-version': orgApiVersionFlagWithDeprecations,
  loglevel,
};

export const resultFormatFlag = Flags.custom<FormatTypes>({
  char: 'r',
  summary: messages.getMessage('flags.resultFormat.summary'),
  options: formatTypes,
  default: 'human',
  aliases: ['resultformat'],
  deprecateAliases: true,
});

export const prefixValidation = (i: string): Promise<string> => {
  if (i.includes('/') || i.includes('\\')) {
    const treeExportMsgs = Messages.loadMessages('@salesforce/plugin-data', 'tree.export');
    throw new Error(treeExportMsgs.getMessage('PrefixSlashError'));
  }
  return Promise.resolve(i);
};
