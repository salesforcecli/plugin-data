/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { resolve } from 'path';
import { strict as assert } from 'assert';
import { TestContext, MockTestOrgData, shouldThrow } from '@salesforce/core/lib/testSetup';

import { ensureJsonMap, ensureString, AnyJson } from '@salesforce/ts-types';
import { expect } from 'chai';
import { Config } from '@oclif/core';

import { SaveResult } from 'jsforce';
import Delete from '../../../../src/commands/data/delete/record';

const sObjectId = '0011100001zhhyUAAQ';

describe('data:delete:record', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({ root: resolve(__dirname, '../../../package.json') });

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
