/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { DataCommand } from '../../../../dataCommand';
import { DataSoqlQueryExecutor } from '../../../../dataSoqlQueryExecutor';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

export class DataSoqlQueryCommand extends DataCommand {
  public static readonly theDescription = messages.getMessage('description');
  public static readonly longDescription = messages.getMessage('longDescription');
  public static readonly help = messages.getMessage('queryHelp');
  public static readonly requiresProject = false;
  public static readonly supportsUsername = true;
  public static readonly supportsPerfLogLevelFlag = true;
  public static readonly resultFormatOptions = { default: 'human' };

  public static readonly flagsConfig: FlagsConfig = {
    query: flags.string({
      char: 'q',
      required: true,
      hidden: false,
      description: messages.getMessage('soqlQueryDescription'),
      longDescription: messages.getMessage('queryQueryLongDescription'),
    }),
    usetoolingapi: flags.boolean({
      char: 't',
      required: false,
      hidden: false,
      description: messages.getMessage('queryToolingDescription'),
      longDescription: messages.getMessage('queryToolingLongDescription'),
    }),
    resultformat: flags.enum({
      char: 'r',
      description: messages.getMessage('ResultFormatDescription'),
      longDescription: messages.getMessage('ResultFormatLongDescription'),
      options: ['human', 'csv', 'json'],
    }),
  };

  public async run(): Promise<unknown> {
    this.ux.startSpinner('Running SOQL Query');
    try {
      const dataSoqlQueryExecutor = new DataSoqlQueryExecutor();
      dataSoqlQueryExecutor.validate(this);
      return await dataSoqlQueryExecutor.execute(this);
    } finally {
      this.ux.stopSpinner();
    }
  }
}
