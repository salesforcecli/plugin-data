/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { resolve } from 'path';
import { strict as assert } from 'assert';
import { AnyJson, ensureJsonMap, ensureString } from '@salesforce/ts-types';
import { expect } from 'chai';
import { TestContext, MockTestOrgData, shouldThrow } from '@salesforce/core/lib/testSetup';
import { Config } from '@oclif/test';
import { SfError } from '@salesforce/core';
import Update from '../../../../../src/commands/force/data/record/update';

const sObjectId = '0011100001zhhyUAAQ';

interface UpdateResult {
  status: number;
  result: { Id: string; Name: string };
}

describe('force:data:record:update', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({ root: resolve(__dirname, '../../../package.json') });
  config.topicSeparator = ' ';

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    await config.load();
  });
  afterEach(async () => {
    $$.restore();
  });

  it('should update the sobject with the provided values', async () => {
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const requestMap = ensureJsonMap(request);
      if (ensureString(requestMap.url).includes('Account')) {
        return Promise.resolve({
          attributes: {
            type: 'Account',
            url: `/services/data/v50.0/sobjects/Account/${sObjectId}`,
          },
          Id: sObjectId,
          IsDeleted: false,
          Name: 'NewName',
          PhotoUrl: `/services/images/photo/0011100001zhhyUAAQ${sObjectId}`,
          OwnerId: '00511000009LARJAA4',
          CreatedDate: '2020-11-17T21:47:42.000+0000',
          CreatedById: '00511000009LARJAA4',
          LastModifiedDate: '2020-11-17T21:47:42.000+0000',
          LastModifiedById: '00511000009LARJAA4',
          SystemModstamp: '2020-11-17T21:47:42.000+0000',
          LastViewedDate: '2020-11-17T21:47:42.000+0000',
          LastReferencedDate: '2020-11-17T21:47:42.000+0000',
        });
      }
      return Promise.resolve({});
    };
    const cmd = new Update(
      [
        '--targetusername',
        'test@org.com',
        '--sobjecttype',
        'Account',
        '--sobjectid',
        sObjectId,
        '-v',
        '"Name=NewName"',
        '--json',
      ],
      config
    );
    const result = (await cmd.run()) as unknown as UpdateResult['result'];
    expect(result.Id).to.equal('0011100001zhhyUAAQ');
    expect(result.Name).to.equal('NewName');
  });

  it('should print the error message with reasons why the record could not be updated', async () => {
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const requestMap = ensureJsonMap(request);
      if (ensureString(requestMap.url).includes('Account')) {
        return Promise.reject({
          errorCode: 'FIELD_CUSTOM_VALIDATION_EXCEPTION',
          message: 'name cannot start with x',
          fields: [],
        });
      }
      return Promise.resolve({});
    };

    const cmd = new Update(
      [
        '--targetusername',
        'test@org.com',
        '--sobjecttype',
        'Account',
        '--sobjectid',
        sObjectId,
        '-v',
        '"Name=Xavier"',
        '--json',
      ],
      config
    );

    try {
      await shouldThrow(cmd.run());
    } catch (e) {
      assert(e instanceof SfError);
      expect(e.message).to.include('name cannot start with x');
      expect(e.message).to.include('FIELD_CUSTOM_VALIDATION_EXCEPTION');
      expect(e.exitCode).to.equal(1);
    }
  });

  it('should throw an error if both --where and --sobjectid are provided', async () => {
    const cmd = new Update(
      [
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
      ],
      config
    );
    try {
      await shouldThrow(cmd.run());
    } catch (e) {
      // failed as expected
    }
  });
});
