/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { QueryResult, SaveResult, UpsertResult, UserInfo } from 'jsforce';
import { Connection } from '@salesforce/core';
import EventEmitter = NodeJS.EventEmitter;

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
