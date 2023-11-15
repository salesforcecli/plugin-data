/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Messages } from '@salesforce/core';
import { Flags } from '@salesforce/sf-plugins-core';
import { BulkUpsertRequestCache } from '../../../bulkDataRequestCache.js';
import { BulkOperationCommand } from '../../../bulkOperationCommand.js';
import { BulkResultV2 } from '../../../types.js';
import { validateSobjectType } from '../../../bulkUtils.js';

Messages.importMessagesDirectory(dirname(fileURLToPath(import.meta.url)));
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulkv2.upsert');

export default class Upsert extends BulkOperationCommand {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'external-id': Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.external-id.summary'),
      required: true,
      aliases: ['externalid'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<BulkResultV2> {
    const { flags } = await this.parse(Upsert);
    const conn = flags['target-org'].getConnection(flags['api-version']);

    await validateSobjectType(flags.sobject, conn);

    return this.runBulkOperation(
      flags.sobject,
      flags.file,
      conn,
      flags.async ? 0 : flags.wait?.minutes,
      flags.verbose,
      'upsert',
      {
        extIdField: flags['external-id'],
      }
    );
  }

  // eslint-disable-next-line class-methods-use-this
  protected async getCache(): Promise<BulkUpsertRequestCache> {
    return BulkUpsertRequestCache.create();
  }
}
