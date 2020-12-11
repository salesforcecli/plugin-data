/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  BaseConnection,
  Batch,
  BatchInfo,
  Job,
  QueryResult,
  RecordResult,
  SaveResult,
  SObject,
  UpsertResult,
  UserInfo,
} from 'jsforce';
import Parser = require('fast-xml-parser');

import EventEmitter = NodeJS.EventEmitter;

// needs an external _listeners object since its not included in the type definition
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

export const createBaseFakeConnection = function (): BaseConnection {
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
      return {} as SObject<object>;
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
            return {} as BatchInfo;
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
        return {} as Job;
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
        return new Promise<RecordResult>(function (resolve, reject) {
          resolve({} as RecordResult);
        });
      },
      update: () => {
        return new Promise<RecordResult>(function (resolve, reject) {
          resolve({} as RecordResult);
        });
      },
      destroy: () => {
        return new Promise<RecordResult>(function (resolve, reject) {
          resolve({} as RecordResult);
        });
      },
      sobject: () => {
        return {} as SObject<object>;
      },
    },
  } as any;
};

export const createBaseFakeBatch = function (): Batch {
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
  return Parser.parse(xmlString, { arrayMode: false });
};

let currentCommandResponse: Record<string, any> | undefined;
export const setCurrentResponse = function (response: Record<string, any>) {
  currentCommandResponse = response;
};

export const getCurrentResponse = function (): Record<string, any> | undefined {
  return currentCommandResponse;
};

export const getFlag = function (command: any, flagName: string) {
  const flags = command.flags;
  if (flags) {
    const flag = flags.find(function (value: any): boolean {
      return value.name === flagName;
    });
    return flag;
  }
};
