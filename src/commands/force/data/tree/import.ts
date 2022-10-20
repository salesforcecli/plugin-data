/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { Logger, Messages, SchemaPrinter } from '@salesforce/core';
import { getString, JsonMap } from '@salesforce/ts-types';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { ImportApi, ImportConfig } from '../../../../api/data/tree/importApi';
import { stringArrayFlag } from '../../../../flags';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'tree.import');

type ImportResult = {
  refId: string;
  type: string;
  id: string;
};

/**
 * Command that provides data import capability via the SObject Tree Save API.
 */
export default class Import extends SfCommand<ImportResult[] | JsonMap> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static flags = {
    targetusername: Flags.requiredOrg({
      required: true,
      char: 'u',
      summary: messages.getMessage('flags.targetusername'),
    }),
    sobjecttreefiles: stringArrayFlag({
      char: 'f',
      summary: messages.getMessage('sobjecttreefiles'),
      exclusive: ['plan'],
    }),
    plan: Flags.file({
      char: 'p',
      summary: messages.getMessage('plan'),
      exists: true,
    }),
    contenttype: Flags.string({
      char: 'c',
      summary: messages.getMessage('contenttype'),
      hidden: true,
    }),
    // displays the schema for a data import plan
    confighelp: Flags.boolean({
      summary: messages.getMessage('confighelp'),
    }),
  };

  public async run(): Promise<ImportResult[] | JsonMap> {
    const { flags } = await this.parse(Import);
    const logger = await Logger.child('Import');
    const importApi = new ImportApi(flags.targetusername);

    if (flags.confighelp) {
      // Display config help and return
      const schema = importApi.getSchema();
      if (!this.jsonEnabled()) {
        new SchemaPrinter(logger, schema).getLines().forEach((line) => this.log(line));
      }

      return schema;
    }

    const importConfig: ImportConfig = {
      sobjectTreeFiles: flags.sobjecttreefiles,
      contentType: flags.contenttype,
      plan: flags.plan,
    };

    const importResults = await importApi.import(importConfig);

    const processedResult: ImportResult[] = (importResults.responseRefs ?? []).map((ref) => {
      const type = getString(importResults.sobjectTypes, ref.referenceId, 'Unknown');
      return { refId: ref.referenceId, type, id: ref.id };
    });

    this.styledHeader('Import Results');
    this.table(processedResult, {
      refId: { header: 'Reference ID' },
      type: { header: 'Type' },
      id: { header: 'ID' },
    });
    return processedResult;
  }
}
