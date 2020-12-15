/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { SfdxCommand } from '@salesforce/command';
import { flags, FlagsConfig } from '@salesforce/command';
import { Messages, Org } from '@salesforce/core';
import { ExportApi } from '../../../../api/data/tree/exportApi';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'tree.export');

export default class Export extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    query: flags.string({
      char: 'q',
      description: messages.getMessage('query'),
      required: true,
    }),
    plan: flags.boolean({
      char: 'p',
      description: messages.getMessage('plan'),
    }),
    prefix: flags.string({
      char: 'x',
      description: messages.getMessage('prefix'),
    }),
    outputdir: flags.directory({
      char: 'd',
      description: messages.getMessage('outputdir'),
    }),
  };

  // Overrides SfdxCommand.  This is ensured since requiresUsername == true
  protected org!: Org;

  public async run(): Promise<unknown> {
    const { query, plan, prefix, outputdir: outputDir } = this.flags;
    const exportApi = new ExportApi(this.org, this.ux);
    return exportApi.export({ query, plan, prefix, outputDir });
  }
}
