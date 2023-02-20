/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { resolve } from 'path';
import { strict as assert } from 'assert';
import { Messages } from '@salesforce/core';
import { ensureJsonMap, ensureString, AnyJson } from '@salesforce/ts-types';
import { expect } from 'chai';
import { TestContext, MockTestOrgData, shouldThrow } from '@salesforce/core/lib/testSetup';

import { Config } from '@oclif/core';
import Get from '../../../../src/commands/data/get/record';

const sObjectId = '0011100001zhhyUAAQ';
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

describe('data:get:record', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({ root: resolve(__dirname, '../../../package.json') });

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
          IsDeleted: false,
          Name: 'Acme',
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
  });

  afterEach(async () => {
    $$.restore();
  });

  it('returns record for provided record-id', async () => {
    const cmd = new Get(
      ['--target-org', 'test@org.com', '--sobject', 'Account', '--record-id', sObjectId, '--json'],
      config
    );

    const result = await cmd.run();

    expect(result.Id).to.equal('0011100001zhhyUAAQ');
  });

  it('should throw an error if values provided to where flag are invalid', async () => {
    const cmd = new Get(
      ['--target-org', 'test@org.com', '--sobject', 'Account', '--where', '"Name"', '--json'],
      config
    );
    try {
      await shouldThrow(cmd.run());
    } catch (e) {
      assert(e instanceof Error);
      expect(e.message).to.equal(messages.getMessage('TextUtilMalformedKeyValuePair', ['Name']));
    }
  });
});
