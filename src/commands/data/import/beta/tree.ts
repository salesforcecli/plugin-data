/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { SfCommand, Flags, arrayWithDeprecation } from '@salesforce/sf-plugins-core';
import { importFromPlan } from '../../../../api/data/tree/importPlan.js';
import { importFromFiles } from '../../../../api/data/tree/importFiles.js';
import { orgFlags } from '../../../../flags.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'tree.import');

type ImportResult = {
  refId: string;
  type: string;
  id: string;
};

/**
 * Command that provides data import capability via the SObject Tree Save API.
 */
export default class Import extends SfCommand<ImportResult[]> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  // TODO: when you remove the beta state, put the force: aliases back in
  public static readonly state = 'beta';

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
    this.log(
      'Be sure to check out the new "sf data import beta tree".  It handles more records and objects with lookups to the same object (ex: parent account)'
    );
    return results;
  }
}
