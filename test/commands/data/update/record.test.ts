/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { resolve } from 'node:path';
import { strict as assert } from 'node:assert';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnyJson, ensureJsonMap, ensureString } from '@salesforce/ts-types';
import { expect } from 'chai';
import { TestContext, MockTestOrgData, shouldThrow } from '@salesforce/core/testSetup';
import { Config } from '@oclif/core/config';
import { SfError } from '@salesforce/core/sfError';
import type { SaveResult } from '@jsforce/jsforce-node';
import Update from '../../../../src/commands/data/update/record.js';

const sObjectId = '0011100001zhhyUAAQ';

describe('data:update:record', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({
    root: resolve(dirname(fileURLToPath(import.meta.url)), '../../../package.json'),
  });

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
