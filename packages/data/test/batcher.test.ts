/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import stream = require('stream');
import { ReadStream } from 'fs';
import { UX } from '@salesforce/command';
import { spyMethod, stubMethod } from '@salesforce/ts-sinon';
import { $$ } from '@salesforce/command/lib/test';
import { expect } from 'chai';
import { Connection, SfdxError } from '@salesforce/core';
import { Batch, JobInfo, BatchInfo } from 'jsforce';
import { Batcher, Batches } from '../src/batcher';
import EventEmitter = NodeJS.EventEmitter;

describe('batcher', () => {
  describe('bulkBatchStatus', () => {
    const summary = { id: '123', operation: 'upsert', state: 'done', object: 'Account' };

    it('will correctly call to print the expected messages 1 log, 1 styledHeader', async () => {
      const ux: UX = await UX.create();
      const styledHeaderSpy = stubMethod($$.SANDBOX, ux, 'styledHeader');
      const logSpy = stubMethod($$.SANDBOX, ux, 'log');
      Batcher.bulkBatchStatus(summary, ux);
      expect(styledHeaderSpy.callCount).to.equal(1);
      expect(logSpy.callCount).to.equal(1);
    });

    it('will correctly call to print the expected messages 1 log, 2 styledHeader', async () => {
      const ux: UX = await UX.create();
      const styledHeaderSpy = stubMethod($$.SANDBOX, ux, 'styledHeader');
      const logSpy = stubMethod($$.SANDBOX, ux, 'log');
      Batcher.bulkBatchStatus(summary, ux, [], 123);
      expect(styledHeaderSpy.callCount).to.equal(2);
      expect(logSpy.callCount).to.equal(1);
    });

    it('will correctly call to print the expected messages 3 log, 2 styledHeader', async () => {
      const ux: UX = await UX.create();
      const styledHeaderSpy = stubMethod($$.SANDBOX, ux, 'styledHeader');
      const logSpy = stubMethod($$.SANDBOX, ux, 'log');
      Batcher.bulkBatchStatus(summary, ux, [{ errors: ['error1', 'error2'], id: '123' }]);
      expect(styledHeaderSpy.callCount).to.equal(2);
      expect(logSpy.callCount).to.equal(3);
    });

    it('will correctly call to print the expected messages 3 log, 3 styledHeader', async () => {
      const ux: UX = await UX.create();
      const styledHeaderSpy = stubMethod($$.SANDBOX, ux, 'styledHeader');
      const logSpy = stubMethod($$.SANDBOX, ux, 'log');
      Batcher.bulkBatchStatus(summary, ux, [{ errors: ['error1', 'error2'], id: '123' }], 123, true);
      expect(styledHeaderSpy.callCount).to.equal(3);
      expect(logSpy.callCount).to.equal(3);
    });
  });

  describe('csv file parsing tests', () => {
    let inStream: any;
    let exitSpy: sinon.SinonSpy;

    beforeEach(() => {
      exitSpy = spyMethod($$.SANDBOX, SfdxError, 'wrap');
      inStream = new stream.Readable({
        read() {},
      });
    });

    it('Should create objects with the correct field names', async function (): Promise<void> {
      inStream.push(`name,field1,field2${os.EOL}`);
      inStream.push(`obj1,val1,val2${os.EOL}`);
      inStream.push(`obj2,val3,val4${os.EOL}`);
      inStream.push(null);
      // @ts-ignore private method
      const batches = await Batcher.splitIntoBatches(inStream);
      expect(batches).to.deep.equal([
        [
          {
            name: 'obj1',
            field1: 'val1',
            field2: 'val2',
          },
          {
            name: 'obj2',
            field1: 'val3',
            field2: 'val4',
          },
        ],
      ]);
      expect(exitSpy.notCalled).to.equal(true);
    });

    it('Should create another batch after 10000 records', async function (): Promise<any> {
      inStream.push(`name , field1, field2${os.EOL}`);
      for (let i = 0; i < 10005; i++) {
        inStream.push(`obj1,val1,val2${os.EOL}`);
      }
      inStream.push(null);
      // @ts-ignore private method
      const batches = Batcher.splitIntoBatches(inStream);
      const result = await batches;
      expect(result.length).to.equal(2);
      expect(result[0].length).to.equal(10000);
      expect(result[1].length).to.equal(5);
      expect(exitSpy.notCalled).to.equal(true);
    });

    it('should be able to read through line breaks within fields', async function (): Promise<any> {
      inStream.push(`name,field1,field2${os.EOL}`);
      inStream.push(`obj1,"val1\n\nval1","\nval2"${os.EOL}`);
      inStream.push(null);
      // @ts-ignore private method
      const batches = await Batcher.splitIntoBatches(inStream);
      expect(batches).to.deep.equal([
        [
          {
            name: 'obj1',
            field1: 'val1\n\nval1',
            field2: '\nval2',
          },
        ],
      ]);
      expect(exitSpy.notCalled).to.equal(true);
    });

    it('Should handle embedded commas', async function (): Promise<void> {
      inStream.push(`"na,me",field1,field2${os.EOL}`);
      inStream.push(`"obj,1",val1,val2${os.EOL}`);
      inStream.push(`"obj,2",val3,val4${os.EOL}`);
      inStream.push(null);
      // @ts-ignore private method
      const batches = await Batcher.splitIntoBatches(inStream);
      expect(batches).to.deep.equal([
        [
          {
            'na,me': 'obj,1',
            field1: 'val1',
            field2: 'val2',
          },
          {
            'na,me': 'obj,2',
            field1: 'val3',
            field2: 'val4',
          },
        ],
      ]);
      expect(exitSpy.notCalled).to.equal(true);
    });
  });

  describe('Batch creation tests', () => {
    const fakeConnection: Connection = Connection.prototype;
    let creationSpy: sinon.SinonSpy;
    let exitSpy: sinon.SinonSpy;
    let waitForCompletionSpy: sinon.SinonStub;
    let listenerSpy: sinon.SinonSpy;
    let closeJobSpy: sinon.SinonSpy;

    let createdBatches: Batch[];
    const job = {
      async close(): Promise<JobInfo> {
        return {} as JobInfo;
      },
      async list(): Promise<BatchInfo[]> {
        return [];
      },
      async check(): Promise<JobInfo> {
        return {} as JobInfo;
      },
      createBatch(): Batch {
        // defined in before block
        return {} as Batch;
      },
    } as any;
    beforeEach(() => {
      createdBatches = [];
      // only stub the methods we need, cast to unknown then to Batch
      const batch: Batch = ({
        on(): void {},
        check(): BatchInfo {
          return {} as BatchInfo;
        },
        poll(): void {},
        execute(): void {},
      } as unknown) as Batch;

      const batchListeners: any = {};
      creationSpy = stubMethod($$.SANDBOX, job, 'createBatch').callsFake(
        (): Batch => {
          batch.on = function (event: string, listener?: (result: Record<string, any>) => any): any {
            if (!batchListeners[event]) {
              batchListeners[event] = [];
            }
            batchListeners[event].push(listener);
            return batch;
          } as any;
          // just add the emit function to avoid defining all the Event Emitter functions too
          batch['emit'] = function (event: string, ...args: any[]): boolean {
            if (event === 'error' || event === 'queue') {
              batchListeners[event].forEach(function (listener: Function): void {
                listener(args[0]);
              });
            }
            return true;
          };
          listenerSpy = stubMethod($$.SANDBOX, batch, 'on').callsFake(function (
            event: string,
            listener: Function
          ): EventEmitter {
            if (!batchListeners[event]) {
              batchListeners[event] = [];
            }
            batchListeners[event].push(listener);
            return {} as EventEmitter;
          });
          createdBatches.push(batch);
          return batch;
        }
      );
      exitSpy = spyMethod($$.SANDBOX, SfdxError, 'wrap');
      waitForCompletionSpy = stubMethod($$.SANDBOX, Batcher, 'waitForCompletion');
      closeJobSpy = spyMethod($$.SANDBOX, job, 'close');
    });

    afterEach(function (): void {
      createdBatches = [];
    });

    it('Should create all batches and should wait for completion', async (): Promise<void> => {
      const batches: Batches = [
        [
          { field1: 'aaa', field2: 'bbb' },
          { field1: 'ccc', field2: 'ddd' },
        ],
        [
          { field1: '111', field2: '222' },
          { field1: '333', field2: '444' },
        ],
      ];
      stubMethod($$.SANDBOX, Batcher, 'splitIntoBatches').resolves(batches);
      await Batcher.createAndExecuteBatches(
        job,
        ReadStream.prototype,
        'TestObject__c',
        await UX.create(),
        fakeConnection,
        2
      );
      expect(creationSpy.calledTwice).to.be.true;
      expect(waitForCompletionSpy.calledTwice).to.be.true;
      expect(exitSpy.notCalled).to.be.true;
    });

    it('Should handle a batch error', async (): Promise<void> => {
      const batches: Batches = [
        [
          { field1: 'aaa', field2: 'bbb' },
          { field1: 'ccc', field2: 'ddd' },
        ],
      ];

      stubMethod($$.SANDBOX, Batcher, 'splitIntoBatches').resolves(batches);
      await Batcher.createAndExecuteBatches(
        job,
        ReadStream.prototype,
        'TestObject__c',
        await UX.create(),
        fakeConnection,
        5
      );
      expect(creationSpy.calledOnce).to.be.true;
      expect(createdBatches.length).to.equal(1);
      createdBatches[0]['emit']('error', new Error('test error from bulkUpsertTest.ts'));
    });

    it('should close jobs once batches are queued', async (): Promise<any> => {
      const batches: Batches = [
        [
          { field1: 'aaa', field2: 'bbb' },
          { field1: 'ccc', field2: 'ddd' },
        ],
      ];

      stubMethod($$.SANDBOX, Batcher, 'splitIntoBatches').resolves(batches);
      await Batcher.createAndExecuteBatches(
        job,
        ReadStream.prototype,
        'TestObject__c',
        await UX.create(),
        fakeConnection,
        2
      );
      expect(listenerSpy.calledWith('queue')).to.be.true;
      expect(creationSpy.calledOnce).to.be.true;
      createdBatches[0]['emit']('queue', []);
      expect(closeJobSpy.calledOnce).to.be.true;
    });

    it('should report failures in batches to the user ', async (): Promise<any> => {
      const batches: Batches = [
        [
          { field1: 'aaa', field2: 'bbb' },
          { field1: 'ccc', field2: 'ddd' },
        ],
      ];

      const newBatch = job.createBatch();
      newBatch.check = (): BatchInfo => {
        return {
          id: 'INCORRECT BATCH',
          jobId: '',
          state: 'Failed',
          stateMessage: 'Invalid batch',
          numberRecordsFailed: '1',
          numberRecordsProcessed: '2',
          totalProcessingTime: '100',
        } as any;
      };
      stubMethod($$.SANDBOX, Batcher, 'splitIntoBatches').resolves(batches);
      waitForCompletionSpy.throws('Invalid Batch');
      try {
        await Batcher.createAndExecuteBatches(
          job,
          ReadStream.prototype,
          'TestObject__c',
          await UX.create(),
          fakeConnection,
          3
        );
        newBatch['emit']('queue', []);
        chai.assert.fail('the above should throw');
      } catch (e) {
        expect(e.name).to.equal('Invalid Batch');
      }
    });
  });
});
