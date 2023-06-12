/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { Messages } from '@salesforce/core';
import { Flags } from '@salesforce/sf-plugins-core';
import { BulkUpsertRequestCache } from '../../../bulkDataRequestCache';
import { BulkOperationCommand } from '../../../bulkOperationCommand';
import { BulkResultV2 } from '../../../types';
import { validateSobjectType } from '../../../bulkUtils';
import { writeBatches } from '../../../batcher';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulkv2.upsert');

export default class Upsert extends BulkOperationCommand {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'external-id': Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.externalid'),
      required: true,
      aliases: ['externalid'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<BulkResultV2> {
    const { flags } = await this.parse(Upsert);
    const conn = flags['target-org'].getConnection(flags['api-version']);

    await validateSobjectType(flags.sobject, conn);
    // if the file is >150 mb, break it up into chunks, we'll deploy those individually
    const fileStat = fs.statSync(flags.file);
    if (fileStat.size >= 150000000) {
      const batches = writeBatches(fs.readFileSync(flags.file, { encoding: 'utf8' }));

      const results = await Promise.all(
        batches.map(async (batch, i) =>
          this.runBulkOperation(flags.sobject, `batch${i}.csv`, conn, flags.async ? 0 : flags.wait?.minutes, 'upsert', {
            extIdField: flags['external-id'],
          })
        )
      );

      batches.map((batch, i) => {
        fs.unlinkSync(`batch${i}.csv`);
      });

      return {
        jobInfo: results[results.length - 1].jobInfo,
        records: results.flatMap((r) => r.records)[0],
      } as BulkResultV2;
    }

    return this.runBulkOperation(flags.sobject, flags.file, conn, flags.async ? 0 : flags.wait?.minutes, 'upsert', {
      extIdField: flags['external-id'],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  protected async getCache(): Promise<BulkUpsertRequestCache> {
    return BulkUpsertRequestCache.create();
  }
}
