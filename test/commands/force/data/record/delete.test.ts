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
import { Org } from '@salesforce/core';
import { expect } from 'chai';
import { Config } from '@oclif/test';

import Delete from '../../../../../src/commands/force/data/record/delete';

const sObjectId = '0011100001zhhyUAAQ';

interface DeleteResult {
  status: number;
  name?: string;
  result?: { Id: string; IsDeleted: boolean };
}

describe('force:data:record:delete', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({ root: resolve(__dirname, '../../../package.json') });
  config.topicSeparator = ' ';

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    await config.load();
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const requestMap = ensureJsonMap(request);
      if (ensureString(requestMap.url).includes('Account')) {
        return Promise.resolve({
          attributes: {
            type: 'Account',
            url: `/services/data/v50.0/sobjects/Account/${sObjectId}`,
          },
          Id: sObjectId,
          IsDeleted: true,
        });
      }
      return Promise.resolve({});
    };
  });

  afterEach(async () => {
    $$.restore();
  });

  it('should delete the sobject by sobjectid', async () => {
    const cmd = new Delete(
      ['--targetusername', 'test@org.com', '--sobjecttype', 'Account', '--sobjectid', sObjectId, '--json'],
      config
    );
    const result = (await cmd.run()) as unknown as DeleteResult['result'];
    expect(result?.Id).to.equal('0011100001zhhyUAAQ');
    expect(result?.IsDeleted).to.equal(true);
  });

  it('should throw an error if both --where and --sobjectid are provided', async () => {
    const cmd = new Delete(
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
      // expected an error
    }
  });

  it('should throw an error if the where flag returns nothing', async () => {
    $$.SANDBOX.stub(Org.prototype, 'getConnection').returns({
      sobject: () => ({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore enable any typing here
        find: () => [],
      }),
    });

    const cmd = new Delete(
      ['--targetusername', 'test@org.com', '--sobjecttype', 'Account', '--where', '"Name=Acme"', '--json'],
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
