/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import fs from 'node:fs';
import { Messages } from '@salesforce/core';
import type { SearchResult } from '@jsforce/jsforce-node';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { orgFlags, resultFormatFlag } from '../../flags.js';
import { displaySearchResults } from '../../searchUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.search');

export class DataSearchCommand extends SfCommand<SearchResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...orgFlags,
    query: Flags.string({
      char: 'q',
      summary: messages.getMessage('flags.query.summary'),
      exactlyOne: ['query', 'file'],
    }),
    file: Flags.file({
      char: 'f',
      exists: true,
      summary: messages.getMessage('flags.file.summary'),
      exactlyOne: ['query', 'file'],
    }),
    'result-format': {
      ...resultFormatFlag,
      summary: messages.getMessage('flags.result-format.summary'),
    },
  };

  public async run(): Promise<SearchResult> {
    const flags = (await this.parse(DataSearchCommand)).flags;

    try {
      // --file will be present if flags.query isn't. Oclif exactlyOne isn't quite that clever
      const queryString = flags.query ?? fs.readFileSync(flags.file as string, 'utf8');
      const conn = flags['target-org'].getConnection(flags['api-version']);
      if (flags['result-format'] !== 'json') this.spinner.start(messages.getMessage('queryRunningMessage'));
      const queryResult = await conn.search(queryString);
      if (!this.jsonEnabled()) {
        // once we overrode result-format summary, undefined became a flag option, but the default is human
        displaySearchResults(queryResult, flags['result-format'] ?? 'human');
      }
      return queryResult;
    } finally {
      if (flags['result-format'] !== 'json') this.spinner.stop();
    }
  }
}
