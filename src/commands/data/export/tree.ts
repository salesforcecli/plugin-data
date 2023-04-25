/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { SfCommand, Flags, Ux } from '@salesforce/sf-plugins-core';
import { orgFlags } from '../../../flags';
import { ExportApi, ExportConfig } from '../../../api/data/tree/exportApi';
import { DataPlanPart, SObjectTreeFileContents } from '../../../dataSoqlQueryTypes';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'tree.export');

export default class Export extends SfCommand<DataPlanPart[] | SObjectTreeFileContents> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:tree:export'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    query: Flags.string({
      char: 'q',
      summary: messages.getMessage('flags.query'),
      required: true,
    }),
    plan: Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.plan'),
    }),
    prefix: Flags.string({
      char: 'x',
      summary: messages.getMessage('flags.prefix'),
    }),
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.outputdir'),
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
