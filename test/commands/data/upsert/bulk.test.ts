/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { stubMethod } from '@salesforce/ts-sinon';
import { SfError } from '@salesforce/core';
import { TestContext, MockTestOrgData, shouldThrow } from '@salesforce/core/lib/testSetup';
import { Config } from '@oclif/core';
import { expect } from 'chai';
import Upsert from '../../../../src/commands/data/upsert/bulk';
import { BulkResultV2 } from '../../../../src/types';
import { writeBatches } from '../../../../src/batcher';

describe('data:upsert:bulk', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  let config: Config;

  before(async () => {
    config = new Config({ root: path.resolve(__dirname, '../../../..') });
    await config.load();
  });

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    $$.SANDBOX.stub(fs, 'existsSync').returns(true);
    $$.SANDBOX.stub(fs, 'createReadStream').throws(new SfError('Error'));
    stubMethod($$.SANDBOX, fs.promises, 'stat').resolves({ isFile: () => true });
  });

  afterEach(async () => {
    $$.SANDBOX.restore();
  });

  it('should fail correctly with error message', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    $$.SANDBOX.stub(fs, 'statSync').returns({ size: 1000 });
    const cmd = new Upsert(
      [
        '--target-org',
        'test@org.com',
        '--sobject',
        'custom__c',
        '--file',
        'fileToUpsert.csv',
        '--externalid',
        'field__c',
        '--json',
      ],
      config
    );
    try {
      await shouldThrow(cmd.run());
    } catch (err) {
      if (!(err instanceof SfError)) {
        expect.fail('Expected SfError to be thrown');
      }
      expect(err.exitCode).to.equal(1);
      // expect(err.commandName).to.equal('Upsert');
      expect(err.message).to.equal('Error');
    }
  });

  it('should split 150 mb files up into batches', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    $$.SANDBOX.stub(fs, 'statSync').returns({ size: 150000001 });
    $$.SANDBOX.stub(fs, 'readFileSync').returns(`COL1,COL2${os.EOL}VAL1,VAL2`);
    const unlinkSyncStub = $$.SANDBOX.stub(fs, 'unlinkSync');
    const writeFileSyncStub = $$.SANDBOX.stub(fs, 'writeFileSync');
    const cmd = new Upsert(
      [
        '--target-org',
        'test@org.com',
        '--sobject',
        'custom__c',
        '--file',
        'fileToUpsert.csv',
        '--externalid',
        'field__c',
        '--json',
      ],
      config
    );
    const batchResult = {
      jobInfo: {
        id: '123',
        jobType: 'V2Ingest',
        operation: 'upsert',
        apiVersion: '55.0',
        columnDelimiter: 'COMMA',
        state: 'Open',
        externalIdFieldName: 'field__c',
        lineEnding: 'LF',
        object: 'custom__c',
        contentType: 'CSV',
        concurrencyMode: 'Parallel',
        contentUrl: 'https://test.salesforce.com',
        createdDate: '2021-01-01T00:00:00.000+0000',
        createdById: '123',
        systemModstamp: '2021-01-01T00:00:00.000+0000',
      },
      records: { successfulResults: [], failedResults: [], unprocessedRecords: [] },
    } as BulkResultV2;
    $$.SANDBOX.stub(cmd, 'runBulkOperation').resolves(batchResult);
    const result = await cmd.run();
    expect(result).to.deep.equal(batchResult);
    expect(writeFileSyncStub.callCount).to.equal(1);
    expect(unlinkSyncStub.callCount).to.equal(1);
  });

  it('will split a large file into multiple 150mb batches', async () => {
    $$.SANDBOX.stub(Buffer, 'byteLength').onFirstCall().returns(100).onSecondCall().returns(150000001);
    const writeFileSyncStub = $$.SANDBOX.stub(fs, 'writeFileSync');
    const result = writeBatches(`COL1,COL2${os.EOL}VAL1,VAL2${os.EOL}VAL3,VAL4${os.EOL}VAL5,VAL6`);
    expect(result.length).to.equal(2);
    expect(writeFileSyncStub.calledTwice).to.be.true;
  });
});
