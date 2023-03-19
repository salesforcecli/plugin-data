/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { ReadStream } from 'fs';
import { Connection, Messages } from '@salesforce/core';
import { Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { Duration } from '@salesforce/kit';
import { orgFlags } from '../../../../flags';
import { Batcher, BatcherReturnType } from '../../../../batcher';
import { validateSobjectType } from '../../../../bulkUtils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.delete');

export default class Delete extends SfCommand<BatcherReturnType> {
  public static readonly examples = messages.getMessages('examples');
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public static readonly flags = {
    ...orgFlags,
    file: Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.csvfile'),
      required: true,
      exists: true,
      aliases: ['csvfile'],
      deprecateAliases: true,
    }),
    sobject: Flags.string({
      char: 's',
      summary: messages.getMessage('flags.sobjecttype'),
      required: true,
      aliases: ['sobjecttype'],
      deprecateAliases: true,
    }),
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      summary: messages.getMessage('flags.wait'),
      min: 0,
      default: Duration.minutes(0),
    }),
  };

  public async run(): Promise<BatcherReturnType> {
    const { flags } = await this.parse(Delete);

    const conn: Connection = flags['target-org'].getConnection(flags['api-version']);
    this.spinner.start('Bulk Delete');

    await validateSobjectType(flags.sobject, conn);

    const csvRecords: ReadStream = fs.createReadStream(flags.file, { encoding: 'utf-8' });
    const job = conn.bulk.createJob<'delete'>(flags.sobject, 'delete');
    const batcher: Batcher = new Batcher(
      conn,
      new Ux({ jsonEnabled: this.jsonEnabled() }),
      this.config.bin,
      this.config.pjson.oclif.topicSeparator ?? ':'
    );

    // eslint-disable-next-line @typescript-eslint/no-misused-promises,no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      job.on('error', (err): void => {
        throw err;
      });

      try {
        resolve(await batcher.createAndExecuteBatches(job, csvRecords, flags.sobject, flags.wait?.minutes));
        this.spinner.stop();
      } catch (e) {
        this.spinner.stop('error');
        reject(e);
      }
    });
  }
}
