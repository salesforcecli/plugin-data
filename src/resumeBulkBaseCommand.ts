/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags, SfCommand, loglevel, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import type { BulkResultV2 } from './types.js';
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.resume.command');

export abstract class ResumeBulkCommand extends SfCommand<BulkResultV2> {
  public static readonly flags = {
    'target-org': { ...optionalOrgFlagWithDeprecations, summary: messages.getMessage('flags.targetOrg.summary') },
    'job-id': Flags.salesforceId({
      length: 18,
      char: 'i',
      startsWith: '750',
      summary: messages.getMessage('flags.jobid'),
      aliases: ['jobid'],
      deprecateAliases: true,
    }),
    'use-most-recent': Flags.boolean({
      summary: messages.getMessage('flags.useMostRecent.summary'),
      // don't use `exactlyOne` because this defaults to true
      default: true,
      exclusive: ['job-id'],
    }),
    wait: Flags.duration({
      summary: messages.getMessage('flags.wait.summary'),
      unit: 'minutes',
      min: 0,
      defaultValue: 5,
    }),
    'api-version': Flags.orgApiVersion(),
    loglevel,
  };
}
