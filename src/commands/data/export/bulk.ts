/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, Logger, Messages, SfError } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { QueryJobV2 } from 'jsforce/lib/api/bulk';
import { Schema } from 'jsforce';
import { orgFlags } from '../../../flags';
import { BulkSoqlQueryResult } from '../../../dataSoqlQueryTypes';
import { createFile } from '../../../bulkUtils';
import { BulkQueryRequestCache } from '../../../bulkDataRequestCache';
import { QUERY_MAX_RECORDS_PER_PAGE } from '../../../constants';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulkv2.query');

export class BulkExport extends SfCommand<unknown> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    query: Flags.string({
      char: 'q',
      summary: messages.getMessage('flags.queryToExecute'),
      exactlyOne: ['query', 'file'],
    }),
    file: Flags.file({
      char: 'f',
      exists: true,
      summary: messages.getMessage('flags.file'),
      exactlyOne: ['query', 'file'],
      aliases: ['soqlqueryfile'],
      deprecateAliases: true,
    }),
    'output-directory': Flags.string({
      summary: messages.getMessage('flags.outputDirectory'),
      default: '.',
    }),
    'file-name': Flags.string({
      summary: messages.getMessage('flags.fileName'),
      default: 'data',
    }),
    'output-format': Flags.string({
      summary: messages.getMessage('flags.outputFormat'),
      options: ['csv', 'json'],
      default: 'json',
    }),
    wait: Flags.duration({
      unit: 'minutes',
      char: 'w',
      summary: messages.getMessage('flags.wait'),
    }),
  };

  private logger!: Logger;

  public async run(): Promise<unknown> {
    this.logger = await Logger.child('data:soql:query');
    const flags = (await this.parse(BulkExport)).flags;
    this.spinner.start('Preparing Query Job');
    // soqlqueryfile will be present if flags.query isn't. Oclif exactlyOne isn't quite that clever
    const query = flags.query ?? fs.readFileSync(flags.file as string, 'utf8');
    const conn = flags['target-org'].getConnection(flags['api-version']);
    const queryResult = await this.runBulkSoqlQuery(
      conn,
      query,
      this.logger,
      flags.wait ?? Duration.minutes(0),
      flags['output-directory'],
      flags['file-name'],
      flags['output-format']
    );

    return queryResult.result;
  }
  /**
   * Executes a SOQL query using the bulk 2.0 API
   *
   * @param connection
   * @param query
   * @param timeout
   */
  private async runBulkSoqlQuery(
    connection: Connection,
    query: string,
    logger: Logger,
    timeout: Duration,
    outputDirectory: string,
    fileName: string,
    outputFormat: string
  ): Promise<BulkSoqlQueryResult> {
    const filePath = path.resolve(outputDirectory, `${fileName}.${outputFormat}`);
    let queryJob: QueryJobV2<Schema> | undefined;
    try {
      logger.debug('Processing Query Job');

      connection.bulk2.pollTimeout = timeout.milliseconds ?? Duration.minutes(5).milliseconds;
      queryJob = await connection.bulk2.query(query, {
        // TODO: enable users to change this value based on an env variable called SF_BULK_API_V2_QUERY_MAX_RECORDS
        maxRecords: QUERY_MAX_RECORDS_PER_PAGE,
      });

      logger.debug(`Query Job ${queryJob.jobInfo?.id} processed with success`);
      this.spinner.stop();
      this.log(`Query Job ${queryJob.jobInfo?.id} processed with success`);
      this.progress.start(queryJob.jobInfo?.numberRecordsProcessed as number);

      const readStream = queryJob.stream();
      readStream.on('data', () => {
        logger.debug(`${queryJob?.jobInfo?.id} processed ${queryJob?.numberRecordsRetrieved as number} records`);
        this.progress.update(queryJob?.numberRecordsRetrieved as number);
      });

      logger.debug('Writting data to disk');
      await createFile(readStream, filePath);
      logger.debug(`All records for Query Job ${queryJob.jobInfo?.id} were saved to disk`);

      return {
        query,
        result: {
          done: true,
          totalSize: queryJob?.numberRecordsRetrieved,
          filePath,
        },
      };
    } catch (e) {
      const err = e as Error & { jobId: string };
      if (timeout.minutes === 0 && err.message.includes('Polling time out')) {
        // async query, so we can't throw an error, suggest data:query:resume --queryid <id>
        const cache = await BulkQueryRequestCache.create();
        await cache.createCacheEntryForRequest(err.jobId, connection.getUsername(), connection.getApiVersion());
        this.log(
          messages.getMessage('queryTimeout', [
            err.jobId,
            err.jobId,
            connection.getUsername(),
            outputDirectory,
            fileName,
          ])
        );
        return {
          query,
          result: { done: false, totalSize: queryJob?.numberRecordsRetrieved as number, filePath, id: err.jobId },
        };
      } else {
        throw SfError.wrap(err);
      }
    } finally {
      this.progress.stop();
    }
  }
}
