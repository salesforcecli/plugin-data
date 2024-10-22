/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import * as fs from 'node:fs';
import { EOL } from 'node:os';
import { writeFile } from 'node:fs/promises';
import { PassThrough, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { exec as execSync } from 'node:child_process';
import { Connection } from '@salesforce/core';
import { stringify as csvStringify } from 'csv-stringify/sync';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { QueryResult, SaveResult, UpsertResult, UserInfo } from '@jsforce/jsforce-node';
import { expect } from 'chai';
import { Parser as csvParse } from 'csv-parse';
import { ColumnDelimiterKeys, ColumnDelimiter } from '../src/bulkUtils.js';
import EventEmitter = NodeJS.EventEmitter;

const exec = promisify(execSync);

// needs an external _listeners object since its not included in the type definition
/* eslint-disable @typescript-eslint/no-unsafe-return,@typescript-eslint/ban-types */
const createBaseFakeEmitter = function (): EventEmitter {
  return {
    on(event: string, listener: Function): EventEmitter {
      return this;
    },
    emit(event: string, ...args: any[]): boolean {
      return true;
    },
    addListener(event: string, listener: Function): EventEmitter {
      return this;
    },
    once(event: string, listener: Function): EventEmitter {
      return this;
    },
    removeListener(event: string, listener: Function): EventEmitter {
      return this;
    },
    removeAllListeners(event?: string): EventEmitter {
      return this;
    },
    setMaxListeners(n: number): EventEmitter {
      return this;
    },
    getMaxListeners(): number {
      return 10;
    },
    listeners(event: string): Function[] {
      return [];
    },
    listenerCount(event: string): number {
      return 0;
    },
    prependListener(event: string | symbol, listener: Function) {
      return this;
    },
    prependOnceListener(event: string | symbol, listener: Function) {
      return this;
    },
    off(event: string, listener: Function): EventEmitter {
      return this;
    },
    rawListeners(event: string | symbol) {
      return [];
    },
    eventNames(): Array<string | symbol> {
      return [];
    },
  };
};
/* eslint-enable @typescript-eslint/no-unsafe-return */

export const createFakeConnection = function (): Connection {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    instanceUrl: '',
    version: '',
    accessToken: '',
    loginBySoap: () =>
      new Promise<UserInfo>((resolve, reject) => {
        resolve({} as UserInfo);
      }),
    async request() {
      return new Promise<Record<string, any>>((resolve, reject) => {
        resolve({});
      });
    },
    describe: () =>
      new Promise<Record<string, any>>((resolve, reject) => {
        resolve({});
      }),
    describeGlobal: () =>
      new Promise<Record<string, any>>((resolve, reject) => {
        resolve({});
      }),
    query: () =>
      new Promise<QueryResult<object>>((resolve, reject) => {
        resolve({} as QueryResult<object>);
      }),
    queryMore: () =>
      new Promise<QueryResult<object>>((resolve, reject) => {
        resolve({} as QueryResult<object>);
      }),
    sobject: () => ({}),
    _baseUrl: () => 'https://some.sfdc.site.com',
    metadata: {
      read: () =>
        new Promise<any>((resolve, reject) => {
          resolve({});
        }),
      upsert: () =>
        new Promise<UpsertResult>((resolve, reject) => {
          resolve({} as UpsertResult);
        }),
      delete: () =>
        new Promise<SaveResult>((resolve, reject) => {
          resolve({} as SaveResult);
        }),
    },
    bulk: {
      load: () => ({
        on: () => {},
        check: () => ({}),
        poll: () => {},
        execute: () => {},
      }),
      createJob: () => {
        const job = createBaseFakeEmitter();
        return Object.assign(job, {
          createBatch(): any {
            return createBaseFakeEmitter();
          },
        });
      },
      job: () => ({}),
    },
    tooling: {
      query: () =>
        new Promise<QueryResult<object>>((resolve, reject) => {
          resolve({} as QueryResult<object>);
        }),
      retrieve: () =>
        new Promise<Record<string, any>>((resolve, reject) => {
          resolve({} as Record<string, any>);
        }),
      create: () =>
        new Promise<SaveResult>((resolve, reject) => {
          resolve({} as SaveResult);
        }),
      update: () =>
        new Promise<SaveResult>((resolve, reject) => {
          resolve({} as SaveResult);
        }),
      destroy: () =>
        new Promise<SaveResult>((resolve, reject) => {
          resolve({} as SaveResult);
        }),
      sobject: () => ({}),
    },
  } as any;
};
/**
 * Validate that a CSV file has X records
 */
export async function validateCsv(
  filePath: string,
  columnDelimiter: ColumnDelimiterKeys,
  totalQty: number
): Promise<void> {
  const csvReadStream = fs.createReadStream(filePath);
  let recordCount = 0;

  await pipeline(
    csvReadStream,
    new csvParse({ columns: true, delimiter: ColumnDelimiter[columnDelimiter] }),
    new PassThrough({
      objectMode: true,
      transform(_chunk, _encoding, callback) {
        recordCount++;
        callback(null, null);
      },
    }),
    // dummy writable
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    })
  );

  expect(totalQty).to.equal(recordCount);
}

/**
 * Validate that a JSON file has X records
 */
export async function validateJson(filePath: string, totalqty: number): Promise<void> {
  // check records have expected fields
  const fieldsRes = await exec(
    `jq 'map(has("Id") and has("Name") and has("Phone") and has("AnnualRevenue")) | all' ${filePath}`,
    {
      shell: 'pwsh',
    }
  );
  expect(fieldsRes.stdout.trim()).equal('true');

  // check all records were written
  const lengthRes = await exec(`jq length ${filePath}`, { shell: 'pwsh' });

  expect(parseInt(lengthRes.stdout.trim(), 10)).equal(totalqty);
}

export async function generateUpdatedCsv(sourceCsv: string, ids: string[], savePath: string) {
  const csvReadStream = fs.createReadStream(sourceCsv);
  const modifiedRows: Array<{ NAME: string; ID?: string }> = [];
  let counter = 0;

  await pipeline(
    csvReadStream,
    new csvParse({ columns: true, delimiter: ',' }),
    new PassThrough({
      objectMode: true,
      transform(row: { NAME: string; ID?: string }, _encoding, callback) {
        row.ID = ids[counter];
        const modifiedRow = { ID: row['ID'], ...row };
        modifiedRows.push(modifiedRow);
        counter++;
        callback(null, null);
      },
    }),
    // dummy writable
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    })
  );

  await writeFile(
    savePath,
    csvStringify(modifiedRows, {
      header: true,
    })
  );

  return savePath;
}

/**
 * Generates a CSV file with 10_000 account records to insert
 *
 * Each `Account.name` field has a unique timestamp for idempotent runs.
 */
export async function generateAccountsCsv(savePath: string): Promise<string> {
  const id = Date.now();

  let csv = 'NAME,TYPE,PHONE,WEBSITE' + EOL;

  for (let i = 1; i <= 10_000; i++) {
    csv += `account ${id} #${i},Account,415-555-0000,http://www.accountImport${i}.com${EOL}`;
  }

  const accountsCsv = path.join(savePath, 'bulkImportAccounts1.csv');

  await writeFile(accountsCsv, csv);

  return accountsCsv;
}
