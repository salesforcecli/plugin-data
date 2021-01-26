/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { ReadStream } from 'fs';
import { flags, FlagsConfig } from '@salesforce/command';
import { Connection, fs, Messages } from '@salesforce/core';
import { JobInfo } from 'jsforce';
import { Batcher, BulkResult } from '../../../../batcher';
import { DataCommand } from '../../../../dataCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.upsert');

export default class Upsert extends DataCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    externalid: flags.string({
      char: 'i',
      description: messages.getMessage('flags.externalid'),
      required: true,
    }),
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

  public async run(): Promise<JobInfo[] | BulkResult[]> {
    const conn: Connection = this.org.getConnection();
    this.ux.startSpinner('Bulk Upsert');

    await this.throwIfFileDoesntExist(this.flags.csvfile);

    const batcher: Batcher = new Batcher(conn, this.ux);
    const csvStream: ReadStream = fs.createReadStream(this.flags.csvfile);

    const job = conn.bulk.createJob(this.flags.sobjecttype, 'upsert', {
      extIdField: this.flags.externalid,
      concurrencyMode: 'Parallel',
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises,no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      job.on('error', (err): void => {
        reject(err);
      });

      try {
        resolve(
          await batcher.createAndExecuteBatches(
            job,
            csvStream,
            this.flags.sobjecttype,
            this.flags.wait,
            this.flags.json
          )
        );
        this.ux.stopSpinner();
      } catch (e) {
        this.ux.stopSpinner('error');
        reject(e);
      }
    });
  }
}
