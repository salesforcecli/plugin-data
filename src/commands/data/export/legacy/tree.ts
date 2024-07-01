/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { SfCommand, Flags, Ux } from '@salesforce/sf-plugins-core';
import { orgFlags } from '../../../../flags.js';
import { ExportApi, ExportConfig } from '../../../../api/data/tree/exportApi.js';
import type { DataPlanPart, SObjectTreeFileContents } from '../../../../types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'tree.export');

export default class Export extends SfCommand<DataPlanPart[] | SObjectTreeFileContents> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly hidden = true;
  public static readonly state = 'deprecated';
  public static readonly deprecationOptions = {
    to: 'data tree export',
    message: messages.getMessage('LegacyDeprecation'),
  };
  public static readonly flags = {
    ...orgFlags,
    query: Flags.string({
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
    }),
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
      aliases: ['outputdir'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<DataPlanPart[] | SObjectTreeFileContents> {
    const { flags } = await this.parse(Export);
    const ux = new Ux({ jsonEnabled: this.jsonEnabled() });
    const exportApi = new ExportApi(flags['target-org'], ux);
    const exportConfig: ExportConfig = {
      outputDir: flags['output-dir'],
      plan: flags.plan,
      prefix: flags.prefix,
      query: flags.query,
    };
    return exportApi.export(exportConfig);
  }
}
