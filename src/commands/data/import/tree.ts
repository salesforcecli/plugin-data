/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { SfCommand, Flags, arrayWithDeprecation } from '@salesforce/sf-plugins-core';
import { importFromPlan } from '../../../api/data/tree/importPlan.js';
import { importFromFiles } from '../../../api/data/tree/importFiles.js';
import { orgFlags } from '../../../flags.js';
import type { ImportResult } from '../../../api/data/tree/importTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'tree.import');

/**
 * Command that provides data import capability via the SObject Tree Save API.
 */
export default class Import extends SfCommand<ImportResult[]> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:tree:import', 'data:import:beta:tree'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    files: arrayWithDeprecation({
      char: 'f',
      summary: messages.getMessage('flags.files.summary'),
      exactlyOne: ['files', 'plan'],
      aliases: ['sobjecttreefiles'],
      deprecateAliases: true,
    }),
    plan: Flags.file({
      char: 'p',
      summary: messages.getMessage('flags.plan.summary'),
      description: messages.getMessage('flags.plan.description'),
      exactlyOne: ['files', 'plan'],
      exists: true,
    }),
  };

  public async run(): Promise<ImportResult[]> {
    const { flags } = await this.parse(Import);

    const conn = flags['target-org'].getConnection(flags['api-version']);
    const results = flags.plan ? await importFromPlan(conn, flags.plan) : await importFromFiles(conn, flags.files);

    this.styledHeader('Import Results');
    this.table(results, {
      refId: { header: 'Reference ID' },
      type: { header: 'Type' },
      id: { header: 'ID' },
    });
    return results;
  }
}
