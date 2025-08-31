/*
 * Copyright 2025, Salesforce, Inc.
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
