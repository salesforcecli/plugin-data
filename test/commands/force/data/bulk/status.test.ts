/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { $$, expect, test } from '@salesforce/command/lib/test';
import { stubMethod } from '@salesforce/ts-sinon';
import { Org } from '@salesforce/core';

interface StatusResult {
  status: number;
  message: string;
}

describe('force:data:bulk:status', () => {
  test
    .do(() => {
      const Job = {
        getAuthInfoFields: () => ({ orgId: '123' }),
        bulk: {
          job: () => ({
              id: '75054000006yv68AAA',
              state: 'Open',
              options: {},
              type: null,
              operation: null,
              list: () => [
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
                  },
                ],
            }),
        },
      };
      stubMethod($$.SANDBOX, Org.prototype, 'getConnection').returns(Job);
    })
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .command([
      'force:data:bulk:status',
      '--targetusername',
      'test@org.com',
      '--batchid',
      '751540000070Q4RAAU',
      '--jobid',
      '75054000006ybyHAAQ',
      '--json',
    ])
    .it('will fail with the correct error message', (ctx) => {
      const result = JSON.parse(ctx.stdout) as StatusResult;
      expect(result.message).to.equal('Unable to find batch 751540000070Q4RAAU for job 75054000006ybyHAAQ.');
      expect(result.status).to.equal(1);
    });

  test
    .do(() => {
      const Job = {
        getAuthInfoFields: () => ({ orgId: '123' }),
        bulk: {
          job: () => ({
              id: '75054000006yv68AAA',
              state: 'Open',
              options: {},
              type: null,
              operation: null,
              list: () => [
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
                  },
                ],
            }),
        },
      };
      stubMethod($$.SANDBOX, Org.prototype, 'getConnection').returns(Job);
    })
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .command([
      'force:data:bulk:status',
      '--targetusername',
      'test@org.com',
      '--batchid',
      '751540000070aNsAAI',
      '--jobid',
      '75054000006yv68AAA',
      '--json',
    ])
    .it('will successfully find the batchid and jobid', (ctx) => {
      const result = JSON.parse(ctx.stdout) as never;
      expect(result).to.deep.equal({
        result: [
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
          },
        ],
        status: 0,
      });
    });
});
