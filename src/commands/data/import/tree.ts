/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Logger, Messages, SchemaPrinter } from '@salesforce/core';
import { getString, JsonMap } from '@salesforce/ts-types';
import { SfCommand, Flags, arrayWithDeprecation } from '@salesforce/sf-plugins-core';
import { ImportApi, ImportConfig } from '../../../api/data/tree/importApi';
import { orgFlags } from '../../../flags';

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
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:tree:import'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    files: arrayWithDeprecation({
      char: 'f',
      summary: messages.getMessage('flags.files'),
      exclusive: ['plan'],
      aliases: ['sobjecttreefiles'],
      deprecateAliases: true,
    }),
    plan: Flags.file({
      char: 'p',
      summary: messages.getMessage('flags.plan'),
      exists: true,
    }),
    'content-type': Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.contenttype'),
      hidden: true,
      aliases: ['contenttype'],
      deprecateAliases: true,
    }),
    // displays the schema for a data import plan
    'config-help': Flags.boolean({
      summary: messages.getMessage('flags.confighelp'),
      aliases: ['confighelp'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<ImportResult[] | JsonMap> {
    const { flags } = await this.parse(Import);
    const logger = await Logger.child('Import');
    const importApi = new ImportApi(
      flags['target-org'],
      this.config.bin,
      this.config.pjson.oclif.topicSeparator ?? ':'
    );

    if (flags['config-help']) {
      // Display config help and return
      const schema = importApi.getSchema();
      if (!this.jsonEnabled()) {
        new SchemaPrinter(logger, schema).getLines().forEach((line) => this.log(line));
      }

      return schema;
    }

    const importConfig: ImportConfig = {
      sobjectTreeFiles: flags.files,
      contentType: flags['content-type'],
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
