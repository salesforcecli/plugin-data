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
import { Batch, JobInfo, BatchInfo, Job } from 'jsforce';
import { Batcher, Batches } from '../../src/batcher';

let styledHeaderSpy: sinon.SinonStub;
let logSpy: sinon.SinonStub;
let batcher: Batcher;

/* eslint-disable @typescript-eslint/ban-ts-comment */

describe('batcher', () => {
  beforeEach(async () => {
    const ux: UX = await UX.create();
    styledHeaderSpy = stubMethod($$.SANDBOX, ux, 'styledHeader');
    logSpy = stubMethod($$.SANDBOX, ux, 'log');
    batcher = new Batcher(Connection.prototype, ux);
  });

  describe('bulkBatchStatus', () => {
    const summary = { id: '123', operation: 'upsert', state: 'done', object: 'Account' };

    it('will correctly call to print the expected messages 1 log, 1 styledHeader', async () => {
      batcher.bulkStatus(summary);
      expect(styledHeaderSpy.callCount).to.equal(1);
      expect(logSpy.callCount).to.equal(1);
    });

    it('will correctly call to print the expected messages 1 log, 2 styledHeader', async () => {
      batcher.bulkStatus(summary, [], 123);
      expect(styledHeaderSpy.callCount, 'styledHeader').to.equal(2);
      expect(logSpy.callCount, 'logSpy').to.equal(1);
    });

    it('will correctly call to print the expected messages 3 log, 2 styledHeader', async () => {
      batcher.bulkStatus(summary, [{ errors: ['error1', 'error2'], id: '123' }]);
      expect(styledHeaderSpy.callCount).to.equal(2);
      expect(logSpy.callCount).to.equal(3);
    });

    it('will correctly call to print the expected messages 3 log, 3 styledHeader', async () => {
      batcher.bulkStatus(summary, [{ errors: ['error1', 'error2'], id: '123' }], 123, true);
      expect(styledHeaderSpy.callCount).to.equal(3);
      expect(logSpy.callCount).to.equal(3);
    });
  });

  describe('csv file parsing tests', () => {
    let inStream: stream.Readable;
    let exitSpy: sinon.SinonSpy;

    beforeEach(() => {
      exitSpy = spyMethod($$.SANDBOX, SfdxError, 'wrap');
      inStream = new stream.Readable({
        read() {},
      });
    });

    it('Should create objects with the correct field names', async () => {
      inStream.push(`name,field1,field2${os.EOL}`);
      inStream.push(`obj1,val1,val2${os.EOL}`);
      inStream.push(`obj2,val3,val4${os.EOL}`);
      inStream.push(null);
      // @ts-ignore private method
      const batches = await batcher.splitIntoBatches(inStream);
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

    it('Should create another batch after 10000 records', async () => {
      inStream.push(`name , field1, field2${os.EOL}`);
      for (let i = 0; i < 10005; i++) {
        inStream.push(`obj1,val1,val2${os.EOL}`);
      }
      inStream.push(null);
      // @ts-ignore private method
      const batches = batcher.splitIntoBatches(inStream);
      const result = await batches;
      expect(result.length).to.equal(2);
      expect(result[0].length).to.equal(10000);
      expect(result[1].length).to.equal(5);
      expect(exitSpy.notCalled).to.equal(true);
    });

    it('should be able to read through line breaks within fields', async () => {
      inStream.push(`name,field1,field2${os.EOL}`);
      inStream.push(`obj1,"val1\n\nval1","\nval2"${os.EOL}`);
      inStream.push(null);
      // @ts-ignore private method
      const batches = await batcher.splitIntoBatches(inStream);
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

    it('Should handle embedded commas', async () => {
      inStream.push(`"na,me",field1,field2${os.EOL}`);
      inStream.push(`"obj,1",val1,val2${os.EOL}`);
      inStream.push(`"obj,2",val3,val4${os.EOL}`);
      inStream.push(null);
      // @ts-ignore private method
      const batches = await batcher.splitIntoBatches(inStream);
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
    let creationSpy: sinon.SinonSpy;
    let exitSpy: sinon.SinonSpy;
    let waitForCompletionSpy: sinon.SinonStub;
    // let listenerSpy: sinon.SinonSpy;
    // let closeJobSpy: sinon.SinonSpy;

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
    } as Job;
    beforeEach(() => {
      createdBatches = [];
      // only stub the methods we need, cast to unknown then to Batch
      const batch: Batch = ({
        check(): BatchInfo {
          return {} as BatchInfo;
        },
      } as unknown) as Batch;

      const batchListeners: Map<string, (result: Record<string, string>) => void> = new Map<
        string,
        (result: Record<string, string>) => void
      >();
      creationSpy = stubMethod($$.SANDBOX, job, 'createBatch').callsFake(
        (): Batch => {
          // @ts-ignore
          batch.on = (event: string, listener: (result: Record<string, string>) => void) => {
            batchListeners.set(event, listener);
            return batch;
          };
          // just add the emit function to avoid defining all the Event Emitter functions too
          batch['emit'] = (event: string, ...args: never[]): boolean => {
            if (event === 'error' || event === 'queue') {
              // eslint-disable-next-line @typescript-eslint/ban-types
              batchListeners.forEach((listener: Function) => {
                listener(args[0]);
              });
            }
            return true;
          };
          createdBatches.push(batch);
          return batch;
        }
      );
      exitSpy = spyMethod($$.SANDBOX, SfdxError, 'wrap');
      waitForCompletionSpy = stubMethod($$.SANDBOX, Batcher.prototype, 'waitForCompletion');
    });

    afterEach(() => {
      createdBatches = [];
    });

    it('Should create all batches and should wait for completion', async () => {
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
      stubMethod($$.SANDBOX, Batcher.prototype, 'splitIntoBatches').resolves(batches);
      await batcher.createAndExecuteBatches(job, ReadStream.prototype, 'TestObject__c', 2);
      expect(creationSpy.calledTwice).to.be.true;
      expect(waitForCompletionSpy.calledTwice).to.be.true;
      expect(exitSpy.notCalled).to.be.true;
    });

    it('Should handle a batch error', async () => {
      const batches: Batches = [
        [
          { field1: 'aaa', field2: 'bbb' },
          { field1: 'ccc', field2: 'ddd' },
        ],
      ];

      stubMethod($$.SANDBOX, Batcher.prototype, 'splitIntoBatches').resolves(batches);
      await batcher.createAndExecuteBatches(job, ReadStream.prototype, 'TestObject__c', 5);
      createdBatches[0]['emit']('error', new Error('test error from bulkUpsertTest.ts'));
      expect(creationSpy.calledOnce).to.be.true;
      expect(createdBatches.length).to.equal(1);
    });

    it('should report failures in batches to the user ', async () => {
      const batches: Batches = [
        [
          { field1: 'aaa', field2: 'bbb' },
          { field1: 'ccc', field2: 'ddd' },
        ],
      ];

      const newBatch = job.createBatch();
      // @ts-ignore
      newBatch.check = (): BatchInfo => {
        return {
          id: 'INCORRECT BATCH',
          jobId: '',
          state: 'Failed',
          stateMessage: 'Invalid batch',
          numberRecordsFailed: '1',
          numberRecordsProcessed: '2',
          totalProcessingTime: '100',
        } as BatchInfo;
      };
      stubMethod($$.SANDBOX, Batcher.prototype, 'splitIntoBatches').resolves(batches);
      waitForCompletionSpy.throws('Invalid Batch');
      try {
        await batcher.createAndExecuteBatches(job, ReadStream.prototype, 'TestObject__c', 3);
        newBatch.emit('queue', []);
        chai.assert.fail('the above should throw');
      } catch (e) {
        expect((e as Error).name).to.equal('Invalid Batch');
      }
    });

    describe('timeout errors', () => {
      it('Should properly handle External Id Required errors', async () => {
        const batches: Batches = [
          [
            { field1: 'aaa', field2: 'bbb' },
            { field1: 'ccc', field2: 'ddd' },
          ],
        ];

        stubMethod($$.SANDBOX, Batcher.prototype, 'splitIntoBatches').resolves(batches);
        const batch = job.createBatch();
        batch.emit('External ID was blank');
        try {
          await batcher.createAndExecuteBatches(job, ReadStream.prototype, 'TestObject__c', 5);
        } catch (e) {
          expect((e as Error).message).to.equal('An External ID is required on TestObject__c to perform an upsert.');
        }
      });

      it('Should properly handle timeout errors', async () => {
        const batches: Batches = [
          [
            { field1: 'aaa', field2: 'bbb' },
            { field1: 'ccc', field2: 'ddd' },
          ],
        ];

        stubMethod($$.SANDBOX, Batcher.prototype, 'splitIntoBatches').resolves(batches);
        const batch = job.createBatch();
        batch.emit('Polling time out');
        try {
          await batcher.createAndExecuteBatches(job, ReadStream.prototype, 'TestObject__c', 5);
        } catch (e) {
          expect((e as Error).message).to.contain('The operation timed out. Check the status with command');
        }
      });
    });
  });
});
