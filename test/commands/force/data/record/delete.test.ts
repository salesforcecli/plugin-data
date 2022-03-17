/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, test } from '@salesforce/command/lib/test';
// import { ensureJsonMap, ensureString } from '@salesforce/ts-types';

const sObjectId = '0011100001zhhyUAAQ';

interface DeleteResult {
  status: number;
  name?: string;
  result?: { Id: string; IsDeleted: boolean };
}

describe('force:data:record:delete', () => {
  test
    // .withConnectionRequest((request) => {
    //   const requestMap = ensureJsonMap(request);
    //   if (ensureString(requestMap.url).includes('Account')) {
    //     return Promise.resolve({
    //       attributes: {
    //         type: 'Account',
    //         url: `/services/data/v50.0/sobjects/Account/${sObjectId}`,
    //       },
    //       Id: sObjectId,
    //       IsDeleted: true,
    //     });
    //   }
    //   return Promise.resolve({});
    // })
    .stdout()
    .command([
      'force:data:record:delete',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'Account',
      '--sobjectid',
      sObjectId,
      '--json',
    ])
    .it('should delete the sobject by sobjectid', (ctx) => {
      const result = JSON.parse(ctx.stdout) as DeleteResult;
      expect(result.status).to.equal(0);
      expect(result.result?.Id).to.equal('0011100001zhhyUAAQ');
      expect(result.result?.IsDeleted).to.equal(true);
    });

  test

    .stdout()
    .command([
      'force:data:record:delete',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'Account',
      '--sobjectid',
      sObjectId,
      '--where',
      '"Name=Acme"',
      '-v',
      '"Name=NewName"',
      '--json',
    ])
    .it('should throw an error if both --where and --sobjectid are provided', (ctx) => {
      const result = JSON.parse(ctx.stdout) as DeleteResult;
      expect(result.status).to.equal(1);
    });

  test
    //
    // .withConnectionRequest(() => {
    //   return Promise.resolve({});
    // })
    .stdout()
    .command([
      'force:data:record:delete',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'Account',
      '--where',
      '"Name=Acme"',
      '--json',
    ])
    .it('should throw an error if the where flag returns nothing', (ctx) => {
      const result = JSON.parse(ctx.stdout) as DeleteResult;
      expect(result.status).to.equal(1);
      expect(result.name).to.equal('DataRecordGetNoRecord');
    });
});
