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
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Config } from '@oclif/core/config';
import { expect } from 'chai';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { AnyJson, ensureJsonMap, ensureString } from '@salesforce/ts-types';
import type { SaveResult } from '@jsforce/jsforce-node';
import Create from '../../../../src/commands/data/create/record.js';
const sObjectId = '0011100001zhhyUAAQ';

describe('data:create:record', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({
    root: resolve(dirname(fileURLToPath(import.meta.url)), '../../../package.json'),
  });

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    await config.load();
    $$.fakeConnectionRequest = (request: AnyJson): Promise<SaveResult> => {
      const requestWithUrl = ensureJsonMap(request);
      if (request && ensureString(requestWithUrl.url).includes('Account')) {
        return Promise.resolve({
          id: sObjectId,
          success: true,
          errors: [],
        });
      }
      throw new Error('Unexpected request: ' + JSON.stringify(request));
    };
  });

  it('should create a new sobject', async () => {
    const cmd = new Create(
      ['--target-org', 'test@org.com', '--sobject', 'Account', '-v', '"Name=Acme"', '--json'],
      config
    );

    const result = await cmd.run();
    expect(result.id).to.equal(sObjectId);
  });
});
