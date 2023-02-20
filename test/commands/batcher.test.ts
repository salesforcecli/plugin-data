/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Readable } from 'stream';
import { ReadStream } from 'fs';
import * as os from 'os';
import { expect } from 'chai';
import { Ux } from '@salesforce/sf-plugins-core';
import { Connection, SfError } from '@salesforce/core';
import { JobInfo } from 'jsforce/api/bulk';
import * as sinon from 'sinon';
import { Batcher, splitIntoBatches } from '../../src/batcher';

let styledHeaderSpy: sinon.SinonStub;
let logSpy: sinon.SinonStub;
let batcher: Batcher;
let ux: Ux;
// let conn: sinon.SinonStub;
/* eslint-disable @typescript-eslint/ban-ts-comment */

describe('batcher', () => {
  const $$ = sinon.createSandbox();
  describe('bulkBatchStatus', () => {
    const summary: JobInfo = { id: '123', operation: 'upsert', state: 'Closed', object: 'Account' };
    beforeEach(() => {
      const conn = $$.stub(Connection.prototype);
      ux = new Ux();
      styledHeaderSpy = $$.stub(ux, 'styledHeader');
      logSpy = $$.stub(ux, 'log');

      batcher = new Batcher(conn, ux, 'sfdx', ':');
    });

    afterEach(() => {
      $$.restore();
    });

    it('will correctly call to print the expected messages 1 log, 1 styledHeader', () => {
      batcher.bulkStatus(summary);
      expect(styledHeaderSpy.callCount).to.equal(1);
      expect(logSpy.callCount).to.equal(1);
    });

    it('will correctly call to print the expected messages 1 log, 2 styledHeader', () => {
      batcher.bulkStatus(summary, [], 123);
      expect(styledHeaderSpy.callCount, 'styledHeader').to.equal(2);
      expect(logSpy.callCount, 'logSpy').to.equal(1);
    });

    it('will correctly call to print the expected messages 3 log, 2 styledHeader', () => {
      batcher.bulkStatus(summary, [{ errors: ['error1', 'error2'], success: false, id: '123' }]);
      expect(styledHeaderSpy.callCount).to.equal(2);
      expect(logSpy.callCount).to.equal(3);
    });

    it('will correctly call to print the expected messages 3 log, 3 styledHeader', () => {
      batcher.bulkStatus(summary, [{ errors: ['error1', 'error2'], success: false, id: '123' }], 123, true);
      expect(styledHeaderSpy.callCount).to.equal(3);
      expect(logSpy.callCount).to.equal(3);
    });
  });

  describe('csv file parsing tests', () => {
    let inStream: ReadStream;
    let exitSpy: sinon.SinonSpy;
    beforeEach(() => {
      exitSpy = $$.stub(SfError, 'wrap');
      // I couldn't figure out how to construct a ReadStream, but this is a close cousin
      inStream = Readable.from([]) as ReadStream;
    });
    afterEach(() => {
      $$.restore();
    });
    it('Should create objects with the correct field names', async () => {
      inStream.push(`name,field1,field2${os.EOL}`);
      inStream.push(`obj1,val1,val2${os.EOL}`);
      inStream.push(`obj2,val3,val4${os.EOL}`);
      inStream.push(null);
      const batches = await splitIntoBatches(inStream);
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
      const batches = splitIntoBatches(inStream);
      const result = await batches;
      expect(result.length).to.equal(2);
      expect(result[0].length).to.equal(10000);
      expect(result[1].length).to.equal(5);
      expect(exitSpy.notCalled).to.equal(true);
    });
    it('Should not create another batch for exactly 10000 records', async () => {
      inStream.push(`name , field1, field2${os.EOL}`);
      for (let i = 0; i < 10000; i++) {
        inStream.push(`obj1,val1,val2${os.EOL}`);
      }
      inStream.push(null);
      const batches = splitIntoBatches(inStream);
      const result = await batches;
      expect(result.length).to.equal(1);
      expect(result[0].length).to.equal(10000);
      expect(exitSpy.notCalled).to.equal(true);
    });
    it('Should create another batch after 10MB of data', async () => {
      // generate a large string for use as a field value
      let bigField = '';
      while (bigField.length <= 2000) {
        bigField += 'l';
      }
      inStream.push(`"n""am""e",field1,field2${os.EOL}`);
      for (let i = 0; i < 5000; i++) {
        inStream.push(`obj1,"v""al""1",${bigField}${os.EOL}`);
      }
      inStream.push(null);
      const batches = splitIntoBatches(inStream);
      const result = await batches;
      expect(result.length).to.equal(2);
      expect(result[0].length).to.equal(4952);
      expect(result[1].length).to.equal(48);
      expect(exitSpy.notCalled).to.equal(true);
    });
    it('should be able to read through line breaks within fields', async () => {
      inStream.push(`name,field1,field2${os.EOL}`);
      inStream.push(`obj1,"val1\n\nval1","\nval2"${os.EOL}`);
      inStream.push(null);
      const batches = await splitIntoBatches(inStream);
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
      const batches = await splitIntoBatches(inStream);
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
});
