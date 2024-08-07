/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { ReadStream } from 'node:fs';

import { Connection, Messages } from '@salesforce/core';
import { Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { orgFlags } from '../../../../flags.js';
import { Batcher, BatcherReturnType } from '../../../../batcher.js';
import { validateSobjectType } from '../../../../bulkUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.delete');

export default class Delete extends SfCommand<BatcherReturnType> {
  public static readonly examples = messages.getMessages('examples');
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public static readonly flags = {
    ...orgFlags,
    file: Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.file.summary'),
      required: true,
      exists: true,
      aliases: ['csvfile'],
      deprecateAliases: true,
    }),
    sobject: Flags.string({
      char: 's',
      summary: messages.getMessage('flags.sobject.summary'),
      required: true,
      aliases: ['sobjecttype'],
      deprecateAliases: true,
    }),
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      summary: messages.getMessage('flags.wait.summary'),
      min: 0,
      defaultValue: 0,
    }),
  };

  public async run(): Promise<BatcherReturnType> {
    const { flags } = await this.parse(Delete);

    const conn: Connection = flags['target-org'].getConnection(flags['api-version']);
    this.spinner.start('Bulk Delete');

    const sobject = await validateSobjectType(flags.sobject, conn);

    const csvRecords: ReadStream = fs.createReadStream(flags.file, { encoding: 'utf-8' });
    const job = conn.bulk.createJob<'delete'>(sobject, 'delete');
    const batcher: Batcher = new Batcher(conn, new Ux({ jsonEnabled: this.jsonEnabled() }));

    // eslint-disable-next-line @typescript-eslint/no-misused-promises,no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      job.on('error', (err): void => {
        throw err;
      });

      try {
        resolve(await batcher.createAndExecuteBatches(job, csvRecords, sobject, flags.wait?.minutes));
        this.spinner.stop();
      } catch (e) {
        this.spinner.stop('error');
        reject(e);
      }
    });
  }
}
