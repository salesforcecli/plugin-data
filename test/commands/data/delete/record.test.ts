/*
 * Copyright 2025, Salesforce, Inc.
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
import { TestContext, MockTestOrgData, shouldThrow } from '@salesforce/core/testSetup';
import { ensureJsonMap, ensureString, AnyJson } from '@salesforce/ts-types';
import { expect } from 'chai';
import { Config } from '@oclif/core/config';

import type { SaveResult } from '@jsforce/jsforce-node';
import Delete from '../../../../src/commands/data/delete/record.js';

const sObjectId = '0011100001zhhyUAAQ';

describe('data:delete:record', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({
    root: resolve(dirname(fileURLToPath(import.meta.url)), '../../../package.json'),
  });

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    await config.load();
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const requestMap = ensureJsonMap(request);
      if (ensureString(requestMap.url).includes('Account') && requestMap.method === 'DELETE') {
        return Promise.resolve({
          id: sObjectId,
          success: true,
          errors: [],
        });
      }
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
      throw new Error('Unexpected request: ' + JSON.stringify(request));
    };
  });

  afterEach(async () => {
    $$.restore();
  });

  it('should delete the sobject by record-id', async () => {
    const cmd = new Delete(
      ['--target-org', 'test@org.com', '--sobject', 'Account', '--record-id', sObjectId, '--json'],
      config
    );
    const result = (await cmd.run()) as unknown as SaveResult;
    expect(result?.id).to.equal('0011100001zhhyUAAQ');
  });

  it('should throw an error if both --where and --record-id are provided', async () => {
    const cmd = new Delete(
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
      // expected an error
    }
  });

  it('should throw an error if the where flag returns nothing', async () => {
    const cmd = new Delete(
      ['--target-org', 'test@org.com', '--sobject', 'Contact', '--where', '"Name=Acme"', '--json'],
      config
    );
    try {
      await cmd.run();
    } catch (e) {
      assert(e instanceof Error);
      expect(e.name).to.equal('DataRecordGetNoRecord');
    }
  });
});
