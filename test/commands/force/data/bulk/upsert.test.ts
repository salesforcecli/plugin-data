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

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { SfError } from '@salesforce/core/sfError';
import { TestContext, MockTestOrgData, shouldThrow } from '@salesforce/core/testSetup';
import { Config } from '@oclif/core/config';
import { expect } from 'chai';
import Upsert from '../../../../../src/commands/force/data/bulk/upsert.js';
describe('force:data:bulk:upsert', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  let config: Config;

  before(async () => {
    config = new Config({ root: resolve(dirname(fileURLToPath(import.meta.url)), '../../../..') });
    await config.load();
  });

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    $$.SANDBOX.stub(fs, 'existsSync').returns(true);
    $$.SANDBOX.stub(fs, 'createReadStream').throws(new SfError('Error'));
    // @ts-expect-error only stubbing a very small part
    $$.SANDBOX.stub(fs.promises, 'stat').resolves({ isFile: () => true });
  });

  afterEach(async () => {
    $$.SANDBOX.restore();
  });

  it('should fail correctly with error message', async () => {
    const cmd = new Upsert(
      [
        '--target-org',
        'test@org.com',
        '--sobject',
        'custom__c',
        '--file',
        'fileToUpsert.csv',
        '--externalid',
        'field__c',
        '--json',
      ],
      config
    );
    try {
      await shouldThrow(cmd.run());
    } catch (err) {
      if (!(err instanceof SfError)) {
        expect.fail('Expected SfError to be thrown');
      }
      expect(err.exitCode).to.equal(1);
      // expect(err.commandName).to.equal('Upsert');
      expect(err.message).to.equal('Error');
    }
  });
});
