/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { resolve } from 'path';
import { Config } from '@oclif/test';
import { expect } from 'chai';
import { TestContext, MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { AnyJson, ensureJsonMap, ensureString } from '@salesforce/ts-types';
import Create from '../../../../../src/commands/force/data/record/create';

const sObjectId = '0011100001zhhyUAAQ';

interface CreateResult {
  result: { Id: string; Name: string };
}

describe('force:data:record:create', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({ root: resolve(__dirname, '../../../package.json') });
  config.topicSeparator = ' ';

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    await config.load();
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const requestWithUrl = ensureJsonMap(request);
      if (request && ensureString(requestWithUrl.url).includes('Account')) {
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
      } else {
        return Promise.resolve({});
      }
    };
  });

  it('should create a new sobject', async () => {
    const cmd = new Create(
      ['--targetusername', 'test@org.com', '--sobjecttype', 'Account', '-v', '"Name=Acme"', '--json'],
      config
    );

    const result = (await cmd.run()) as unknown as CreateResult['result'];
    expect(result.Id).to.equal(sObjectId);
    expect(result.Name).to.equal('Acme');
  });
});
