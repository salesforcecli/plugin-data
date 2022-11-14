/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { ReadStream } from 'fs';
import { Connection, Messages, SfError } from '@salesforce/core';
import { SfCommand, Flags, Ux } from '@salesforce/sf-plugins-core';
import { Duration } from '@salesforce/kit';
import { Batcher, BatcherReturnType } from '../../../../batcher';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/plugin-data', 'bulk.delete', [
  'examples',
  'summary',
  'description',
  'flags.targetusername',
  'flags.csvfile',
  'flags.sobjecttype',
  'flags.wait',
]);

export default class Delete extends SfCommand<BatcherReturnType> {
  public static readonly examples = messages.getMessages('examples');
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static flags = {
    targetusername: Flags.requiredOrg({
      required: true,
      char: 'u',
      summary: messages.getMessage('flags.targetusername'),
    }),
    csvfile: Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.csvfile'),
      required: true,
      exists: true,
    }),
    sobjecttype: Flags.string({
      char: 's',
      summary: messages.getMessage('flags.sobjecttype'),
      required: true,
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
    let result: BatcherReturnType;

    try {
      const conn: Connection = flags.targetusername.getConnection();
      this.spinner.start('Bulk Delete');

      const csvRecords: ReadStream = fs.createReadStream(flags.csvfile, { encoding: 'utf-8' });
      const job = conn.bulk.createJob<'delete'>(flags.sobjecttype, 'delete');

      const batcher: Batcher = new Batcher(conn, new Ux({ jsonEnabled: this.jsonEnabled() }));

      result = await batcher.createAndExecuteBatches(job, csvRecords, flags.sobjecttype, flags.wait?.minutes);

      this.spinner.stop();
      return result;
    } catch (e) {
      this.spinner.stop('error');
      if (!(e instanceof Error)) {
        throw e;
      }
      throw SfError.wrap(e);
    }
  }
}
