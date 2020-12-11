/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { flags, FlagsConfig, SfdxCommand, SfdxResult } from '@salesforce/command';
import { Messages, Org, SchemaPrinter } from '@salesforce/core';
import { getString, JsonMap } from '@salesforce/ts-types';
import { ImportApi, ImportConfig } from '../../../../lib/data/tree/importApi';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'tree.import');

interface ImportResult {
  refId: string;
  type: string;
  id: string;
}

/**
 * Command that provides data import capability via the SObject Tree Save API.
 */
export default class Import extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    sobjecttreefiles: flags.array({
      char: 'f',
      description: messages.getMessage('sobjecttreefiles'),
      exclusive: ['plan'],
    }),
    plan: flags.filepath({
      char: 'p',
      description: messages.getMessage('plan'),
    }),
    contenttype: flags.string({
      char: 'c',
      description: messages.getMessage('contenttype'),
      hidden: true,
    }),
    // displays the schema for a data import plan
    confighelp: flags.boolean({
      description: messages.getMessage('confighelp'),
    }),
  };

  public static result: SfdxResult = {
    tableColumnData: {
      columns: [
        { key: 'refId', label: 'Reference ID' },
        { key: 'type', label: 'Type' },
        { key: 'id', label: 'ID' },
      ],
    },
  };

  // Overrides SfdxCommand.  This is ensured since requiresUsername == true
  protected org!: Org;

  public async run(): Promise<ImportResult[] | JsonMap> {
    const importApi = new ImportApi(this.org);

    if (this.flags.confighelp) {
      // Display config help and return
      const schema = importApi.getSchema();
      if (!this.flags.json) {
        const schemaLines = new SchemaPrinter(this.logger, schema).getLines();
        schemaLines.forEach((line) => this.ux.log(line));
        // turn off table output
        this.result.tableColumnData = undefined;
      }

      return schema;
    }

    const importConfig: ImportConfig = {
      sobjectTreeFiles: this.flags.sobjecttreefiles,
      contentType: this.flags.contenttype,
      plan: this.flags.plan,
    };

    const importResults = await importApi.import(importConfig);

    let processedResult: ImportResult[] = [];
    if (importResults.responseRefs?.length) {
      processedResult = importResults.responseRefs.map((ref) => {
        const type = getString(importResults.sobjectTypes, ref.referenceId, 'Unknown');
        return { refId: ref.referenceId, type, id: ref.id } as ImportResult;
      });
    }
    this.ux.styledHeader('Import Results');

    return processedResult;
  }
}
