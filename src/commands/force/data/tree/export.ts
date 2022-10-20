/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { Messages } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { ExportApi, ExportConfig } from '../../../../api/data/tree/exportApi';
import { DataPlanPart, SObjectTreeFileContents } from '../../../../dataSoqlQueryTypes';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'tree.export');

export default class Export extends SfCommand<DataPlanPart[] | SObjectTreeFileContents> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static flags = {
    targetusername: Flags.requiredOrg({
      required: true,
      char: 'u',
      summary: messages.getMessage('targetusername'),
    }),
    query: Flags.string({
      char: 'q',
      summary: messages.getMessage('query'),
      required: true,
    }),
    plan: Flags.boolean({
      char: 'p',
      summary: messages.getMessage('plan'),
    }),
    prefix: Flags.string({
      char: 'x',
      summary: messages.getMessage('prefix'),
    }),
    outputdir: Flags.directory({
      char: 'd',
      summary: messages.getMessage('outputdir'),
    }),
  };

  public async run(): Promise<DataPlanPart[] | SObjectTreeFileContents> {
    const { flags } = await this.parse(Export);
    const exportApi = new ExportApi(flags.targetusername, this.jsonEnabled());
    const exportConfig: ExportConfig = {
      outputDir: flags.outputdir,
      plan: flags.plan,
      prefix: flags.prefix,
      query: flags.query,
    };
    return exportApi.export(exportConfig);
  }
}
