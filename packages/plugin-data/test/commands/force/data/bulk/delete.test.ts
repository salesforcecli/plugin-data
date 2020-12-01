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
import { Batcher } from '@salesforce/data';

describe('force:data:bulk:delete', () => {
  test
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .command([
      'force:data:bulk:delete',
      '--csvfile',
      'nonexistant.csv',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'Account',
      '--json',
    ])
    .it("should throw an error if the file doesn't exist", (ctx) => {
      const result = JSON.parse(ctx.stdout);
      expect(result.status).to.equal(1);
      expect(result.name).to.equal('PathDoesNotExist');
      expect(result.message).to.equal('The specified path [nonexistant.csv] does not exist');
    });

  const expected = {
    $: {
      xmlns: 'http://www.force.com/2009/06/asyncapi/dataload',
    },
    id: '751540000070aNnAAI',
    jobId: '75054000006yvAsAAI',
    state: 'Queued',
    createdDate: '2020-11-30T16:14:00.000Z',
    systemModstamp: '2020-11-30T16:14:00.000Z',
    numberRecordsProcessed: '0',
    numberRecordsFailed: '0',
    totalProcessingTime: '0',
    apiActiveProcessingTime: '0',
    apexProcessingTime: '0',
  };

  test
    .do(() => {
      stubMethod($$.SANDBOX, fs, 'fileExists').resolves(true);
      stubMethod($$.SANDBOX, fs, 'createReadStream').returns(ReadStream.prototype);
      stubMethod($$.SANDBOX, Batcher, 'createAndExecuteBatches').resolves(expected);
    })
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .command([
      'force:data:bulk:delete',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'Account',
      '--csvfile',
      'toDelete.csv',
      '--json',
    ])
    .it('should properly print output once a bulk delete operation is done', (ctx) => {
      const result = JSON.parse(ctx.stdout);
      expect(result).to.deep.equal({ status: 0, result: expected });
    });
});
