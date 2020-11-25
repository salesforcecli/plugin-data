/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { ReadStream } from 'fs';
import { Connection, Messages, SfdxError, fs as fscore, Org } from '@salesforce/core';
import { flags, FlagsConfig } from '@salesforce/command';
import { DataCommand } from '../../../../dataCommand';
import Upsert, { Job } from './upsert';

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
    wait: flags.number({
      char: 'w',
      description: messages.getMessage('flags.wait'),
    }),
  };
  public org!: Org;

  public async run(): Promise<void> {
    const conn: Connection = this.org.getConnection();
    this.ux.startSpinner('Bulk Delete');

    await this.throwIfFileDoesntExist(this.flags.csvfile);

    const csvRecords: ReadStream = fscore.createReadStream(this.flags.csvfile);
    try {
      const job: Job = conn.bulk.createJob(this.flags.sobjecttype, 'delete') as Job;

      await Upsert.createAndExecuteBatches(job, csvRecords, this.flags.sobjecttype, this.ux, this.flags.wait);
      this.ux.stopSpinner();
    } catch (e) {
      this.ux.stopSpinner();
      throw SfdxError.wrap(e);
    }
  }
}
