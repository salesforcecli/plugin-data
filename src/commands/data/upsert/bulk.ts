/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as os from 'os';
import { Connection, Messages } from '@salesforce/core';
import { Flags } from '@salesforce/sf-plugins-core';
import { Duration } from '@salesforce/kit';
import { BulkUpsertRequestCache } from '../../../bulkDataRequestCache';
import { BulkOperationCommand } from '../../../bulkOperationCommand';
import { BulkResultV2 } from '../../../types';
import { validateSobjectType } from '../../../bulkUtils';

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
    // if the file is >150 mb, break it up into 149 mb chunks and we'll deploy those individually
    // TODO: should be 15000000, not 1 for testing
    const fileStat = fs.statSync(flags.file);
    if (fileStat.size >= 1) {
      await this.bulkUpsert({
        file: flags.file,
        wait: flags.wait,
        async: flags.async,
        conn,
        externalId: flags['external-id'],
        sobject: flags.sobject,
      });
    }

    return this.runBulkOperation(flags.sobject, flags.file, conn, flags.async ? 0 : flags.wait?.minutes, 'upsert', {
      extIdField: flags['external-id'],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  protected async getCache(): Promise<BulkUpsertRequestCache> {
    return BulkUpsertRequestCache.create();
  }

  private async bulkUpsert(options: {
    file: string;
    sobject: string;
    externalId: string;
    async: boolean;
    wait: Duration;
    conn: Connection;
  }): Promise<BulkResultV2> {
    // const readStream = fs.createReadStream(options.file, { encoding: 'utf8', highWaterMark: 150 * 1024 });
    // // get first line of csv to create header for other files from
    // // naive approach first, optimize once it's working and UTs are in place
    //
    // const rl = readline.createInterface({
    //   input: readStream,
    //   crlfDelay: Infinity,
    // });
    //
    // const firstLine = (await events.once(rl, 'line')) as unknown as string[];
    //
    // let counter = 0;
    // const files: string[] = [];
    //
    // // eslint-disable-next-line @typescript-eslint/no-misused-promises
    // readStream.on('data', async (data) => {
    //   if (data !== null) {
    //     fs.writeFileSync(`temp${counter++}.csv`, firstLine[0] + os.EOL + data);
    //     files.push(`temp${counter}.csv`);
    //     // eslint-disable-next-line no-console
    //     console.log('done writing');
    //     if (fs.existsSync(`temp${counter}.csv`)) {
    //       await this.runBulkOperation(
    //         options.sobject,
    //         `temp${counter}.csv`,
    //         options.conn,
    //         options.async ? 0 : options.wait?.minutes,
    //         'upsert',
    //         {
    //           extIdField: options.externalId,
    //         }
    //       );
    //     }
    //   }
    // });
    //
    // await Promise.all(files.map((f) => fs.promises.unlink(f)));

    const data = fs.readFileSync(options.file, { encoding: 'utf8' });
    const lines = data.split(os.EOL);
    const firstLine = lines[0];
    const rest = lines.splice(10);
    const chunks = [];
    const results: BulkResultV2[] = [];
    for (let i = 0; i < rest.length; i += 10) {
      const chunk = [firstLine, ...rest.slice(i, i + 10)];
      chunks.push(chunk.join(os.EOL));
      fs.writeFileSync(`temp${i / 10}.csv`, chunk.join(os.EOL));
      results.push(
        // eslint-disable-next-line no-await-in-loop
        await this.runBulkOperation(
          options.sobject,
          `temp${i / 10}.csv`,
          options.conn,
          options.async ? 0 : options.wait?.minutes,
          'upsert',
          {
            extIdField: options.externalId,
          }
        )
      );
      fs.unlinkSync(`temp${i / 10}.csv`);
    }

    return {
      jobInfo: results[results.length - 1].jobInfo,
      records: results.flatMap((r) => r.records)[0],
    } as BulkResultV2;
  }
}
