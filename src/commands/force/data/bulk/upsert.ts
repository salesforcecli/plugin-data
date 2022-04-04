/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import * as fs from 'fs';
import { ReadStream } from 'fs';
import { flags, FlagsConfig } from '@salesforce/command';
import { Connection, Messages } from '@salesforce/core';
import { Job, JobInfo } from 'jsforce/job';
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
    csvfile: flags.filepath({
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
    serial: flags.boolean({
      char: 'r',
      description: messages.getMessage('flags.serial'),
      default: false,
    }),
  };

  public async run(): Promise<JobInfo[] | BulkResult[]> {
    const conn: Connection = this.ensureOrg().getConnection();
    this.ux.startSpinner('Bulk Upsert');

    await this.throwIfFileDoesntExist(this.flags.csvfile as string);

    const batcher: Batcher = new Batcher(conn, this.ux);
    const csvStream: ReadStream = fs.createReadStream(this.flags.csvfile as string, { encoding: 'utf-8' });

    const concurrencyMode = this.flags.serial ? 'Serial' : 'Parallel';
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const job: Job = conn.bulk.createJob(this.flags.sobjecttype, 'upsert', {
      extIdField: this.flags.externalid as string,
      concurrencyMode,
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
            this.flags.sobjecttype as string,
            this.flags.wait as number
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
