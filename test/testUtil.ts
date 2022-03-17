/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Batch, BatchInfo } from 'jsforce/lib/api/bulk';

import { QueryResult, SaveResult, UpsertResult, UserInfo } from 'jsforce';
import { Connection } from '@salesforce/core';

import { getArray, getString } from '@salesforce/ts-types';
import Parser = require('fast-xml-parser');
import EventEmitter = NodeJS.EventEmitter;

// needs an external _listeners object since its not included in the type definition
/* eslint-disable @typescript-eslint/no-unsafe-return,@typescript-eslint/ban-types */
export const createBaseFakeEmitter = function (): EventEmitter {
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

export const createBaseFakeConnection = function (): Connection {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    instanceUrl: '',
    version: '',
    accessToken: '',
    loginBySoap: () => {
      return new Promise<UserInfo>(function (resolve, reject) {
        resolve({} as UserInfo);
      });
    },
    async request() {
      return new Promise<Record<string, any>>(function (resolve, reject) {
        resolve({});
      });
    },
    describe: () => {
      return new Promise<Record<string, any>>(function (resolve, reject) {
        resolve({});
      });
    },
    describeGlobal: () => {
      return new Promise<Record<string, any>>(function (resolve, reject) {
        resolve({});
      });
    },
    query: () => {
      return {} as QueryResult<object>;
    },
    queryMore: () => {
      return {} as QueryResult<object>;
    },
    sobject: () => {
      return {};
    },
    _baseUrl: () => {
      return 'https://some.sfdc.site.com';
    },
    metadata: {
      read: () => {
        return new Promise<any>(function (resolve, reject) {
          resolve({});
        });
      },
      upsert: () => {
        return new Promise<UpsertResult>(function (resolve, reject) {
          resolve({} as UpsertResult);
        });
      },
      delete: () => {
        return new Promise<SaveResult>(function (resolve, reject) {
          resolve({} as SaveResult);
        });
      },
    },
    bulk: {
      load: () => {
        return {
          on: () => {},
          check: () => {
            return {};
          },
          poll: () => {},
          execute: () => {},
        };
      },
      createJob: () => {
        const job = createBaseFakeEmitter();
        return Object.assign(job, {
          createBatch(): any {
            return createBaseFakeEmitter();
          },
        });
      },
      job: () => {
        return {};
      },
    },
    tooling: {
      query: () => {
        return {} as QueryResult<object>;
      },
      retrieve: () => {
        return new Promise<Record<string, any>>(function (resolve, reject) {
          resolve({} as Record<string, any>);
        });
      },
      create: () => {
        return new Promise<SaveResult>(function (resolve, reject) {
          resolve({} as SaveResult);
        });
      },
      update: () => {
        return new Promise<SaveResult>(function (resolve, reject) {
          resolve({} as SaveResult);
        });
      },
      destroy: () => {
        return new Promise<SaveResult>(function (resolve, reject) {
          resolve({} as SaveResult);
        });
      },
      sobject: () => {
        return {};
      },
    },
  } as any;
};

export const createFakeConnection = function (): Connection {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    instanceUrl: '',
    version: '',
    accessToken: '',
    loginBySoap: () => {
      return new Promise<UserInfo>(function (resolve, reject) {
        resolve({} as UserInfo);
      });
    },
    async request() {
      return new Promise<Record<string, any>>(function (resolve, reject) {
        resolve({});
      });
    },
    describe: () => {
      return new Promise<Record<string, any>>(function (resolve, reject) {
        resolve({});
      });
    },
    describeGlobal: () => {
      return new Promise<Record<string, any>>(function (resolve, reject) {
        resolve({});
      });
    },
    autoFetchQuery: () => {
      return new Promise<QueryResult<object>>(function (resolve, reject) {
        resolve({} as QueryResult<object>);
      });
    },
    query: () => {
      return new Promise<QueryResult<object>>(function (resolve, reject) {
        resolve({} as QueryResult<object>);
      });
    },
    queryMore: () => {
      return new Promise<QueryResult<object>>(function (resolve, reject) {
        resolve({} as QueryResult<object>);
      });
    },
    sobject: () => {
      return {};
    },
    _baseUrl: () => {
      return 'https://some.sfdc.site.com';
    },
    metadata: {
      read: () => {
        return new Promise<any>(function (resolve, reject) {
          resolve({});
        });
      },
      upsert: () => {
        return new Promise<UpsertResult>(function (resolve, reject) {
          resolve({} as UpsertResult);
        });
      },
      delete: () => {
        return new Promise<SaveResult>(function (resolve, reject) {
          resolve({} as SaveResult);
        });
      },
    },
    bulk: {
      load: () => {
        return {
          on: () => {},
          check: () => {
            return {};
          },
          poll: () => {},
          execute: () => {},
        };
      },
      createJob: () => {
        const job = createBaseFakeEmitter();
        return Object.assign(job, {
          createBatch(): any {
            return createBaseFakeEmitter();
          },
        });
      },
      job: () => {
        return {};
      },
    },
    tooling: {
      query: () => {
        return new Promise<QueryResult<object>>(function (resolve, reject) {
          resolve({} as QueryResult<object>);
        });
      },
      autoFetchQuery: () => {
        return new Promise<QueryResult<object>>(function (resolve, reject) {
          resolve({} as QueryResult<object>);
        });
      },
      retrieve: () => {
        return new Promise<Record<string, any>>(function (resolve, reject) {
          resolve({} as Record<string, any>);
        });
      },
      create: () => {
        return new Promise<SaveResult>(function (resolve, reject) {
          resolve({} as SaveResult);
        });
      },
      update: () => {
        return new Promise<SaveResult>(function (resolve, reject) {
          resolve({} as SaveResult);
        });
      },
      destroy: () => {
        return new Promise<SaveResult>(function (resolve, reject) {
          resolve({} as SaveResult);
        });
      },
      sobject: () => {
        return {};
      },
    },
  } as any;
};

export const createBaseFakeBatch = function (): typeof Batch {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    on(event: string, callback?: (result: Record<string, any>) => any): void {},
    check(callback?: (err: Error, info: BatchInfo) => any): BatchInfo {
      return {} as BatchInfo;
    },
    poll(interval: number, timeout: number): void {},
    execute(records?: Array<Record<string, any>>, callback?: Function): void {},
  } as any;
};

export const toXMLObject = function (xmlString: string): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return Parser.parse(xmlString, { arrayMode: false });
};

let currentCommandResponse: Record<string, any> | undefined;
export const setCurrentResponse = function (response: Record<string, any>): void {
  currentCommandResponse = response;
};

export const getCurrentResponse = function (): Record<string, any> | undefined {
  return currentCommandResponse;
};

export const getFlag = function (command: unknown, flagName: string): any {
  const flags = getArray(command, 'flags');
  return flags ? flags.find((value: any) => getString(value, 'name') === flagName) : undefined;
};
