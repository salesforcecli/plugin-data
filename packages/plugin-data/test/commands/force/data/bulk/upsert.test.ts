/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ReadStream } from 'fs';
import { $$, expect, test } from '@salesforce/command/lib/test';
import { stubMethod } from '@salesforce/ts-sinon';
import { fs } from '@salesforce/core';
import { Batcher } from '../../../../../src/batcher';

describe('force:data:bulk:upsert', () => {
  const expected = [
    {
      $: {
        xmlns: 'http://www.force.com/2009/06/asyncapi/dataload',
      },
      id: '751540000070aNTAAY',
      jobId: '75054000006yvAYAAY',
      state: 'Queued',
      createdDate: '2020-11-30T16:13:15.000Z',
      systemModstamp: '2020-11-30T16:13:15.000Z',
      numberRecordsProcessed: '0',
      numberRecordsFailed: '0',
      totalProcessingTime: '0',
      apiActiveProcessingTime: '0',
      apexProcessingTime: '0',
    },
  ];

  test
    .withOrg({ username: 'test@org.com' }, true)
    .do(() => {
      stubMethod($$.SANDBOX, fs, 'fileExists').resolves(true);
      stubMethod($$.SANDBOX, fs, 'createReadStream').resolves(ReadStream.prototype);
      stubMethod($$.SANDBOX, Batcher.prototype, 'createAndExecuteBatches').resolves(expected);
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
      const result = JSON.parse(ctx.stdout);
      expect(result).to.deep.equal({ status: 0, result: expected });
    });

  test
    .withOrg({ username: 'test@org.com' }, true)
    .do(() => {
      stubMethod($$.SANDBOX, fs, 'fileExists').resolves(true);
      stubMethod($$.SANDBOX, fs, 'createReadStream').resolves(ReadStream.prototype);
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
      const result = JSON.parse(ctx.stdout);
      expect(result.commandName).to.equal('Upsert');
      expect(result.exitCode).to.equal(1);
      expect(result.message).to.equal('Error');
    });
});
