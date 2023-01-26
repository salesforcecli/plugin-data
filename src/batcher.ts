/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EventEmitter } from 'events';
import { ReadStream } from 'fs';
import { SfError } from '@salesforce/core';
import { BatchState, IngestJobV2Results, JobInfo } from 'jsforce/api/bulk';
import { Record, Schema } from 'jsforce';
import { stringify } from 'csv-stringify/sync';
import { Duration } from '@salesforce/kit';
import { IngestJobV2, IngestOperation } from 'jsforce/lib/api/bulk';
import parse = require('csv-parse');

const POLL_FREQUENCY_MS = 5000;

const timer = (wait: number): Promise<never> =>
  new Promise((): NodeJS.Timer => setInterval(() => {
    throw new Error('TimeOut');
  }, wait ?? 0));

export type BulkResult = {
  $: {
    xmlns: string;
  };
  id: string;
  jobId: string;
  state: BatchState;
  createdDate: string;
  systemModStamp: string;
  numberRecordsProcessed: string;
  numberRecordsFailed: string;
  totalProcessingTime: string;
  apiActiveProcessingTime: string;
  apexProcessingTime: string;
};

export type BatcherReturnType = BulkResult[] | JobInfo[];

export class Batcher extends EventEmitter {

  public constructor() {
    super();
  }

  /**
   * create and execute batches based on the record arrays; wait for completion response if -w flag is set with > 0 minutes
   * to get proper logging/printing to console pass the instance of UX that called this method
   *
   * @param job {Job}
   * @param input
   * @param sobjectType {string}
   * @param wait {number}
   */
  public async createAndExecuteBatches<J extends Schema, T extends IngestOperation>(
    job: IngestJobV2<Schema, IngestOperation>,
    input: ReadStream,
    sobjectType: string,
    wait?: number
  ): Promise<IngestJobV2Results<Schema>> {
    const timeNow = Date.now() + Duration.minutes(wait ?? 0).milliseconds;
    this.emit('bulkStatusTotals', {
      totalRecords: 0,
      totalBatches: 0
    });
    const records = await loadBulkRecords(input);
    await job.uploadData(records);
    await job.close();
    if (wait) {
      await Promise.race([job.poll(POLL_FREQUENCY_MS, timeNow), timer]);
    }
    return job.getAllResults();
  }
}

/**
 * registers the listener in charge of distributing all csv records into batches
 *
 * @param readStream - the read stream
 * @returns {Promise<Batches>}
 */
export const loadBulkRecords = async (readStream: ReadStream): Promise<Record[]> => {
  // split all records into batches
  const batches: Record[] = [];
  let batchHeaderBytes = 0;


  return new Promise((resolve, reject) => {
    const parser = parse({
      columns: true,
      // library option is snakecase
      // eslint-disable-next-line camelcase
      skip_empty_lines: true,
      bom: true
    });

    readStream.pipe(parser);

    parser.on('data', (element: Record) => {
      if (!batchHeaderBytes) {
        // capture header byte length
        batchHeaderBytes = Buffer.byteLength(stringify([Object.keys(element)]) + '\n', 'utf8');
      }
      // capture row byte length
      batches.push(element);
    });

    parser.on('error', (err) => {
      readStream.destroy();
      reject(SfError.wrap(err));
    });

    parser.on('end', () => {
      readStream.destroy();
      resolve(batches);
    });
  });
};
