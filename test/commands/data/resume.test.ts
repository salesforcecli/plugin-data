/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as path from 'path';
import { TestContext, MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { Config } from '@oclif/core';
import { expect } from 'chai';
import Bulk, { Batch, BulkOperation, Job, JobInfo, JobState } from 'jsforce/lib/api/bulk';
import stripAnsi = require('strip-ansi');
import Status from '../../../src/commands/data/resume';

describe('force:data:bulk:status', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({ root: path.resolve(__dirname, '../../..') });
  let stdoutSpy: sinon.SinonSpy;

  const unusedInterfaceParts = {
    _bulk: undefined,
    _batches: {},
    _jobInfo: undefined,
    _error: undefined,
    info(): Promise<JobInfo> {
      throw new Error('Function not implemented.');
    },
    open(): Promise<JobInfo> {
      throw new Error('Function not implemented.');
    },
    createBatch(): Batch<any, BulkOperation> {
      throw new Error('Function not implemented.');
    },
    batch(batchId: string): Batch<any, BulkOperation> {
      throw new Error('Function not implemented.');
    },
    check(): Promise<JobInfo> {
      throw new Error('Function not implemented.');
    },
    ready(): Promise<string> {
      throw new Error('Function not implemented.');
    },
    close(): Promise<JobInfo> {
      throw new Error('Function not implemented.');
    },
    abort(): Promise<JobInfo> {
      throw new Error('Function not implemented.');
    },
    _changeState(state: JobState): Promise<JobInfo> {
      throw new Error('Function not implemented.');
    },
    addListener(eventName: string | symbol, listener: (...args: any[]) => void): Job<any, BulkOperation> {
      throw new Error('Function not implemented.');
    },
    on(eventName: string | symbol, listener: (...args: any[]) => void): Job<any, BulkOperation> {
      throw new Error('Function not implemented.');
    },
    once(eventName: string | symbol, listener: (...args: any[]) => void): Job<any, BulkOperation> {
      throw new Error('Function not implemented.');
    },
    removeListener(eventName: string | symbol, listener: (...args: any[]) => void): Job<any, BulkOperation> {
      throw new Error('Function not implemented.');
    },
    off(eventName: string | symbol, listener: (...args: any[]) => void): Job<any, BulkOperation> {
      throw new Error('Function not implemented.');
    },
    removeAllListeners(event?: string | symbol): Job<any, BulkOperation> {
      throw new Error('Function not implemented.');
    },
    setMaxListeners(n: number): Job<any, BulkOperation> {
      throw new Error('Function not implemented.');
    },
    getMaxListeners(): number {
      throw new Error('Function not implemented.');
    },
    // eslint-disable-next-line @typescript-eslint/ban-types
    listeners(eventName: string | symbol): Function[] {
      throw new Error('Function not implemented.');
    },
    // eslint-disable-next-line @typescript-eslint/ban-types
    rawListeners(eventName: string | symbol): Function[] {
      throw new Error('Function not implemented.');
    },
    emit(eventName: string | symbol, ...args: any[]): boolean {
      throw new Error('Function not implemented.');
    },
    listenerCount(eventName: string | symbol): number {
      throw new Error('Function not implemented.');
    },
    prependListener(eventName: string | symbol, listener: (...args: any[]) => void): Job<any, BulkOperation> {
      throw new Error('Function not implemented.');
    },
    prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void): Job<any, BulkOperation> {
      throw new Error('Function not implemented.');
    },
    eventNames(): Array<string | symbol> {
      throw new Error('Function not implemented.');
    },
  };
  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    await config.load();
    stdoutSpy = $$.SANDBOX.stub(process.stdout, 'write');

    $$.SANDBOXES.CONNECTION.stub(Bulk.prototype, 'job').returns({
      id: '75054000006yv68AAA',
      state: 'Open',
      options: {},
      type: null,
      operation: null,
      list: async () =>
        Promise.resolve([
          {
            id: '751540000070aNsAAI',
            jobId: '75054000006yv68AAA',
            state: 'Completed',
            createdDate: '2020-11-30T16:14:21.000Z',
            systemModstamp: '2020-11-30T16:14:21.000Z',
            numberRecordsProcessed: '1',
            numberRecordsFailed: '1',
            totalProcessingTime: '185',
            apiActiveProcessingTime: '55',
            apexProcessingTime: '0',
            // won't appear on the real API response, but jsforce says it's required
            stateMessage: '',
          },
        ]),
      ...unusedInterfaceParts,
    });
  });

  afterEach(async () => {
    $$.restore();
  });

  it('will fail with the correct error message for not found', async () => {
    await Status.run(
      [
        '--targetusername',
        'test@org.com',
        '--batchid',
        '751540000070Q4RAAU',
        '--jobid',
        '75054000006ybyHAAQ',
        '--json',
      ],
      config
    );
    const result = JSON.parse(stripAnsi(stdoutSpy.args.flat().join(''))) as {
      message: string;
      status: number;
      exitCode: number;
    };
    expect('exitCode' in result).to.equal(true);
    expect(result.message).to.equal('Unable to find batch 751540000070Q4RAAU for job 75054000006ybyHAAQ.');
    expect(result.exitCode).to.equal(1);
  });

  it('will successfully find the batchid and jobid', async () => {
    const cmd = new Status(
      [
        '--targetusername',
        'test@org.com',
        '--batchid',
        '751540000070aNsAAI',
        '--jobid',
        '75054000006yv68AAA',
        '--json',
      ],
      config
    );

    // eslint-disable-next-line no-underscore-dangle
    const result = await cmd._run();

    expect(result).to.deep.equal([
      {
        apexProcessingTime: '0',
        apiActiveProcessingTime: '55',
        createdDate: '2020-11-30T16:14:21.000Z',
        id: '751540000070aNsAAI',
        jobId: '75054000006yv68AAA',
        numberRecordsFailed: '1',
        numberRecordsProcessed: '1',
        state: 'Completed',
        systemModstamp: '2020-11-30T16:14:21.000Z',
        totalProcessingTime: '185',
        // TODO: remove once jsforce types are corrected
        stateMessage: '',
      },
    ]);
  });
});
