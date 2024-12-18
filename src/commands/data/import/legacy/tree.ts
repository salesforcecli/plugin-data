/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { getString, JsonMap } from '@salesforce/ts-types';
import { SfCommand, Flags, arrayWithDeprecation } from '@salesforce/sf-plugins-core';
import type { ImportResult } from '../../../../api/data/tree/importTypes.js';
import { ImportApi, ImportConfig } from '../../../../api/data/tree/importApi.js';
import { orgFlags } from '../../../../flags.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'tree.import.legacy');

/**
 * Command that provides data import capability via the SObject Tree Save API.
 */
export default class Import extends SfCommand<ImportResult[] | JsonMap> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly hidden = true;
  public static readonly state = 'deprecated';
  public static deprecationOptions = {
    message: messages.getMessage('deprecation'),
  };

  public static readonly flags = {
    ...orgFlags,
    files: arrayWithDeprecation({
      char: 'f',
      summary: messages.getMessage('flags.files.summary'),
      exclusive: ['plan'],
      aliases: ['sobjecttreefiles'],
      deprecateAliases: true,
    }),
    plan: Flags.file({
      char: 'p',
      summary: messages.getMessage('flags.plan.summary'),
      exists: true,
    }),
    'content-type': Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.content-type.summary'),
      hidden: true,
      aliases: ['contenttype'],
      deprecateAliases: true,
      deprecated: { message: messages.getMessage('flags.content-type.deprecation') },
    }),
    // displays the schema for a data import plan
    'config-help': Flags.boolean({
      summary: messages.getMessage('flags.config-help.summary'),
      aliases: ['confighelp'],
      deprecateAliases: true,
      hidden: true,
      deprecated: { message: messages.getMessage('flags.config-help.deprecation') },
    }),
  };

  public async run(): Promise<ImportResult[] | JsonMap> {
    const { flags } = await this.parse(Import);
    const importApi = new ImportApi(flags['target-org']);

    if (flags['config-help']) {
      // Display config help and return
      const schema = importApi.getSchema();
      this.log(messages.getMessage('schema-help'));

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

    this.table({
      data: processedResult,
      columns: [{ key: 'refId', name: 'Reference ID' }, 'type', { key: 'id', name: 'ID' }],
      title: 'Import Results',
    });

    return processedResult;
  }
}
