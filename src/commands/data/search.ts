/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'node:fs';
import { Messages } from '@salesforce/core';
import type { SearchResult } from '@jsforce/jsforce-node';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { displaySearchResults } from '../../searchUtils.js';
import { FormatTypes, formatTypes } from '../../reporters/query/reporters.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.search');

export class DataSearchCommand extends SfCommand<SearchResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
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
    'result-format': Flags.custom<FormatTypes>({
      char: 'r',
      summary: messages.getMessage('flags.result-format.summary'),
      options: formatTypes,
      default: 'human',
      exclusive: ['json'],
    })(),
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
        displaySearchResults(queryResult, flags['result-format']);
      }
      return queryResult;
    } finally {
      if (flags['result-format'] !== 'json') this.spinner.stop();
    }
  }
}
