/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { ReadStream } from 'fs';
import { Connection, Messages, SfdxError, fs } from '@salesforce/core';
import { flags, FlagsConfig } from '@salesforce/command';
import { Job, JobInfo } from 'jsforce';
import { Batcher, BulkResult } from '../../../../batcher';
import { DataCommand } from '../../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.delete');

export default class Delete extends DataCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    csvfile: flags.string({
      char: 'f',
      description: messages.getMessage('flags.csvfile'),
      required: true,
    }),
    sobjecttype: flags.string({
      char: 's',
      description: messages.getMessage('flags.sobjecttype'),
      required: true,
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('flags.wait'),
      min: 0,
    }),
  };

  public async run(): Promise<BulkResult[] | JobInfo[]> {
    let result: BulkResult[] | JobInfo[];

    try {
      await this.throwIfFileDoesntExist(this.flags.csvfile);

      const conn: Connection = this.org.getConnection();
      this.ux.startSpinner('Bulk Delete');

      const csvRecords: ReadStream = fs.createReadStream(this.flags.csvfile);
      const job: Job = conn.bulk.createJob(this.flags.sobjecttype, 'delete');

      const batcher: Batcher = new Batcher(conn, this.ux);

      result = await batcher.createAndExecuteBatches(job, csvRecords, this.flags.sobjecttype, this.flags.wait);

      this.ux.stopSpinner();
    } catch (e) {
      this.ux.stopSpinner('error');
      throw SfdxError.wrap(e);
    }

    return result;
  }
}
