/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { ReadStream } from 'fs';
import { $$, expect, test } from '@salesforce/command/lib/test';
import { stubMethod } from '@salesforce/ts-sinon';
import { Batcher } from '../../../../../src/batcher';

interface DeleteResult {
  status: number;
  name: string;
  message: string;
}

describe('force:data:bulk:delete', () => {
  test

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
      const result = JSON.parse(ctx.stdout) as DeleteResult;
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
      stubMethod($$.SANDBOX, Batcher.prototype, 'createAndExecuteBatches').resolves(expected);
    })

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
      const result = JSON.parse(ctx.stdout) as never;
      expect(result).to.deep.equal({ status: 0, result: expected });
    });
});
