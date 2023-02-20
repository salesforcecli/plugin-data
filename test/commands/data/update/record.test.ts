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
import { Config } from '@oclif/core';
import { SfError } from '@salesforce/core';
import { SaveResult } from 'jsforce';
import Update from '../../../../src/commands/data/update/record';

const sObjectId = '0011100001zhhyUAAQ';

describe('data:update:record', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({ root: resolve(__dirname, '../../../package.json') });

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
      if (ensureString(requestMap.url).includes('query')) {
        return Promise.resolve({
          records: ensureString(requestMap.url).includes('Account')
            ? [
                {
                  Id: sObjectId,
                },
              ]
            : [],
        });
      }
      if (ensureString(requestMap.url).includes('Account')) {
        return Promise.resolve({
          id: sObjectId,
          success: true,
          errors: [],
        });
      }
      return Promise.resolve({});
    };
    const cmd = new Update(
      [
        '--target-org',
        'test@org.com',
        '--sobject',
        'Account',
        '--record-id',
        sObjectId,
        '-v',
        '"Name=NewName"',
        '--json',
      ],
      config
    );
    const result = (await cmd.run()) as unknown as SaveResult;
    expect(result.id).to.equal('0011100001zhhyUAAQ');
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
        '--target-org',
        'test@org.com',
        '--sobject',
        'Account',
        '--record-id',
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

  it('should throw an error if both --where and --record-id are provided', async () => {
    const cmd = new Update(
      [
        '--target-org',
        'test@org.com',
        '--sobject',
        'Account',
        '--record-id',
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
