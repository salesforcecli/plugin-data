/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
