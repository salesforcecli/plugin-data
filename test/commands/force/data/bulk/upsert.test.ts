/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { ReadStream } from 'fs';
import * as fse from 'fs-extra';
import { $$, expect, test } from '@salesforce/command/lib/test';
import { stubMethod } from '@salesforce/ts-sinon';
import { Batcher } from '../../../../../src/batcher';

interface UpsertResult {
  commandName: string;
  exitCode: number;
  message: string;
}

describe('force:data:bulk:upsert', () => {
  const expectedBatch = {
    $: {
      xmlns: 'http://www.force.com/2009/06/asyncapi/dataload',
    },
    id: '7513F000003y0iZQAQ',
    jobId: '7503F000004rVluQAE',
    state: 'Queued',
    createdDate: '2021-01-20T02:30:06.000Z',
    systemModstamp: '2021-01-20T02:30:06.000Z',
    numberRecordsProcessed: '0',
    numberRecordsFailed: '0',
    totalProcessingTime: '0',
    apiActiveProcessingTime: '0',
    apexProcessingTime: '0',
  };

  test
    .withOrg({ username: 'test@org.com' }, true)
    .do(() => {
      stubMethod($$.SANDBOX, fse, 'pathExists').resolves(true);
      stubMethod($$.SANDBOX, fs, 'createReadStream').returns(ReadStream.prototype);
      stubMethod($$.SANDBOX, Batcher.prototype, 'createAndExecuteBatches').resolves(expectedBatch);
    })
    .stdout()
    .command([
      'force:data:bulk:upsert',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'custom__c',
      '--csvfile',
      'fileToUpsert.csv',
      '--externalid',
      'field__c',
      '--json',
    ])
    .it('should upsert the data correctly', (ctx) => {
      const result = JSON.parse(ctx.stdout) as never;
      expect(result).to.deep.equal({ status: 0, result: expectedBatch });
    });

  const expectedJob = {
    id: '7503F000004rVEMQA2',
    operation: 'upsert',
    object: 'custom__c',
    createdById: '0053F000007vESSQA2',
    createdDate: '2021-01-19T23:05:32.000Z',
    systemModstamp: '2021-01-19T23:05:33.000Z',
    state: 'Closed',
    externalIdFieldName: 'field__c',
    concurrencyMode: 'Parallel',
    contentType: 'CSV',
    numberBatchesQueued: '0',
    numberBatchesInProgress: '0',
    numberBatchesCompleted: '1',
    numberBatchesFailed: '0',
    numberBatchesTotal: '1',
    numberRecordsProcessed: '18',
    numberRetries: '0',
    apiVersion: '50.0',
    numberRecordsFailed: '0',
    totalProcessingTime: '80',
    apiActiveProcessingTime: '46',
    apexProcessingTime: '0',
  };

  test
    .withOrg({ username: 'test@org.com' }, true)
    .do(() => {
      stubMethod($$.SANDBOX, fse, 'pathExists').resolves(true);
      stubMethod($$.SANDBOX, fs, 'createReadStream').returns(ReadStream.prototype);
      stubMethod($$.SANDBOX, Batcher.prototype, 'createAndExecuteBatches').resolves(expectedJob);
    })
    .stdout()
    .command([
      'force:data:bulk:upsert',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'custom__c',
      '--csvfile',
      'fileToUpsert.csv',
      '--externalid',
      'field__c',
      '--wait',
      '5',
      '--json',
    ])
    .it('should upsert the data correctly while waiting', (ctx) => {
      const result = JSON.parse(ctx.stdout) as never;
      expect(result).to.deep.equal({ status: 0, result: expectedJob });
    });

  test
    .withOrg({ username: 'test@org.com' }, true)
    .do(() => {
      stubMethod($$.SANDBOX, fse, 'pathExists').resolves(true);
      stubMethod($$.SANDBOX, fs, 'createReadStream').returns(ReadStream.prototype);
      stubMethod($$.SANDBOX, Batcher.prototype, 'createAndExecuteBatches').throws('Error');
    })
    .stdout()
    .command([
      'force:data:bulk:upsert',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'custom__c',
      '--csvfile',
      'fileToUpsert.csv',
      '--externalid',
      'field__c',
      '--json',
    ])
    .it('should fail correctly with error message', (ctx) => {
      const result = JSON.parse(ctx.stdout) as UpsertResult;
      expect(result.commandName).to.equal('Upsert');
      expect(result.exitCode).to.equal(1);
      expect(result.message).to.equal('Error');
    });

  const expectedSerialJob = {
    id: '7503F000004rVEMQA2',
    operation: 'upsert',
    object: 'custom__c',
    createdById: '0053F000007vESSQA2',
    createdDate: '2021-01-19T23:05:32.000Z',
    systemModstamp: '2021-01-19T23:05:33.000Z',
    state: 'Closed',
    externalIdFieldName: 'field__c',
    concurrencyMode: 'Serial',
    contentType: 'CSV',
    numberBatchesQueued: '0',
    numberBatchesInProgress: '0',
    numberBatchesCompleted: '1',
    numberBatchesFailed: '0',
    numberBatchesTotal: '1',
    numberRecordsProcessed: '18',
    numberRetries: '0',
    apiVersion: '50.0',
    numberRecordsFailed: '0',
    totalProcessingTime: '80',
    apiActiveProcessingTime: '46',
    apexProcessingTime: '0',
  };

  test
    .withOrg({ username: 'test@org.com' }, true)
    .do(() => {
      stubMethod($$.SANDBOX, fse, 'pathExists').resolves(true);
      stubMethod($$.SANDBOX, fs, 'createReadStream').returns(ReadStream.prototype);
      stubMethod($$.SANDBOX, Batcher.prototype, 'createAndExecuteBatches').resolves(expectedSerialJob);
    })
    .stdout()
    .command([
      'force:data:bulk:upsert',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'custom__c',
      '--csvfile',
      'fileToUpsert.csv',
      '--externalid',
      'field__c',
      '--wait',
      '5',
      '--json',
      '--serial',
    ])
    .it('should upsert the data correctly while waiting', (ctx) => {
      const result = JSON.parse(ctx.stdout) as never;
      expect(result).to.deep.equal({ status: 0, result: expectedSerialJob });
    });
});
