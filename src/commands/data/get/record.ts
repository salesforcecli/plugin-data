/*
 * Copyright 2025, Salesforce, Inc.
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

import { Messages, SfError } from '@salesforce/core';
import type { Record } from '@jsforce/jsforce-node';
import { toAnyJson } from '@salesforce/ts-types';
import { SfCommand, Flags, Ux } from '@salesforce/sf-plugins-core';
import { orgFlags, perflogFlag } from '../../../flags.js';
import { query, logNestedObject } from '../../../dataUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'record.get');

export default class Get extends SfCommand<Record> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:record:get'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    sobject: Flags.string({
      char: 's',
      required: true,
      summary: messages.getMessage('flags.sobject.summary'),
      aliases: ['sobjecttype'],
      deprecateAliases: true,
    }),
    // eslint-disable-next-line sf-plugin/id-flag-suggestions
    'record-id': Flags.salesforceId({
      length: 'both',
      char: 'i',
      summary: messages.getMessage('flags.record-id.summary'),
      exactlyOne: ['where', 'record-id'],
      aliases: ['sobjectid'],
      deprecateAliases: true,
    }),
    where: Flags.string({
      char: 'w',
      summary: messages.getMessage('flags.where.summary'),
      exactlyOne: ['where', 'record-id'],
    }),
    'use-tooling-api': Flags.boolean({
      char: 't',
      summary: messages.getMessage('flags.use-tooling-api.summary'),
      aliases: ['usetoolingapi'],
      deprecateAliases: true,
    }),
    perflog: perflogFlag,
  };

  public async run(): Promise<Record> {
    const { flags } = await this.parse(Get);
    this.spinner.start('Getting Record');
    const conn = flags['use-tooling-api']
      ? flags['target-org'].getConnection(flags['api-version']).tooling
      : flags['target-org'].getConnection(flags['api-version']);
    try {
      const sObjectId = flags['record-id'] ?? ((await query(conn, flags.sobject, flags.where as string)).Id as string);
      const result = await conn.sobject(flags.sobject).retrieve(sObjectId);
      if (!this.jsonEnabled()) {
        logNestedObject(new Ux({ jsonEnabled: this.jsonEnabled() }), result as never);
      }
      this.spinner.stop();
      return toAnyJson(result) as Record;
    } catch (err) {
      this.spinner.stop('failed');
      throw new SfError((err as Error).message, (err as Error).name);
    }
  }
}
