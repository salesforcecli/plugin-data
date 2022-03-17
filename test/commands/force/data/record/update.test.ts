/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, test } from '@salesforce/command/lib/test';
// import { ensureJsonMap, ensureString } from '@salesforce/ts-types';
import { SfError } from '@salesforce/core';

const sObjectId = '0011100001zhhyUAAQ';

interface UpdateResult {
  status: number;
  result: { Id: string; Name: string };
}

describe('force:data:record:update', () => {
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
    //       IsDeleted: false,
    //       Name: 'NewName',
    //       PhotoUrl: `/services/images/photo/0011100001zhhyUAAQ${sObjectId}`,
    //       OwnerId: '00511000009LARJAA4',
    //       CreatedDate: '2020-11-17T21:47:42.000+0000',
    //       CreatedById: '00511000009LARJAA4',
    //       LastModifiedDate: '2020-11-17T21:47:42.000+0000',
    //       LastModifiedById: '00511000009LARJAA4',
    //       SystemModstamp: '2020-11-17T21:47:42.000+0000',
    //       LastViewedDate: '2020-11-17T21:47:42.000+0000',
    //       LastReferencedDate: '2020-11-17T21:47:42.000+0000',
    //     });
    //   }
    //   return Promise.resolve({});
    // })
    .stdout()
    .command([
      'force:data:record:update',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'Account',
      '--sobjectid',
      sObjectId,
      '-v',
      '"Name=NewName"',
      '--json',
    ])
    .it('should update the sobject with the provided values', (ctx) => {
      const result = JSON.parse(ctx.stdout) as UpdateResult;
      expect(result.status).to.equal(0);
      expect(result.result.Id).to.equal('0011100001zhhyUAAQ');
      expect(result.result.Name).to.equal('NewName');
    });

  test

    // .withConnectionRequest(() => {
    //   return Promise.reject({
    //     errorCode: 'FIELD_CUSTOM_VALIDATION_EXCEPTION',
    //     message: 'name cannot start with x',
    //     fields: [],
    //   });
    // })
    .stdout()
    .command([
      'force:data:record:update',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'Account',
      '--sobjectid',
      sObjectId,
      '-v',
      '"Name=Xavier"',
      '--json',
    ])
    .it('should print the error message with reasons why the record could not be updated', (ctx) => {
      const result = JSON.parse(ctx.stdout) as SfError;
      expect(result.message).to.include('name cannot start with x');
      expect(result.message).to.include('FIELD_CUSTOM_VALIDATION_EXCEPTION');
      expect(result.exitCode).to.equal(1);
    });

  test

    .stdout()
    .command([
      'force:data:record:update',
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
      const result = JSON.parse(ctx.stdout) as UpdateResult;
      expect(result.status).to.equal(1);
    });
});
