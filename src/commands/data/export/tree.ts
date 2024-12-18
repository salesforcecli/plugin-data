/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { SfCommand, Flags, Ux } from '@salesforce/sf-plugins-core';
import { orgFlags, prefixValidation } from '../../../flags.js';
import { ExportConfig, runExport } from '../../../export.js';
import type { DataPlanPart, SObjectTreeFileContents } from '../../../types.js';

export type ExportTreeResult = DataPlanPart[] | SObjectTreeFileContents;

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'tree.export');

export default class Export extends SfCommand<ExportTreeResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:tree:export'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    query: Flags.string({
      multiple: true,
      char: 'q',
      summary: messages.getMessage('flags.query.summary'),
      required: true,
    }),
    plan: Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.plan.summary'),
    }),
    prefix: Flags.string({
      char: 'x',
      summary: messages.getMessage('flags.prefix.summary'),
      parse: prefixValidation,
    }),
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
      aliases: ['outputdir'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<ExportTreeResult> {
    const { flags } = await this.parse(Export);
    const exportConfig: ExportConfig = {
      outputDir: flags['output-dir'],
      plan: flags.plan,
      prefix: flags.prefix,
      queries: flags.query,
      conn: flags['target-org'].getConnection(flags['api-version']),
      ux: new Ux({ jsonEnabled: this.jsonEnabled() }),
    };
    return runExport(exportConfig);
  }
}
