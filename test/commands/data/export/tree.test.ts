/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { resolve } from 'path';
import { AnyJson, ensureJsonMap, ensureString, isString } from '@salesforce/ts-types';
import { expect } from 'chai';
import { TestContext, MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { Config } from '@oclif/core';
import Export from '../../../../src/commands/data/export/tree';

const query = 'SELECT Id, Name from Account';

// Query response used by the connection stub.
const queryResponse = {
  totalSize: 1,
  done: true,
  records: [
    {
      attributes: {
        type: 'Account',
        url: '/services/data/v51.0/sobjects/Account/0019A00000GNvvAQAT',
      },
      Id: '0019A00000GNvvAQAT',
      Name: 'Sample Account for Entitlements',
    },
  ],
};

// Abbreviated response of Account SObject metadata used by the connection stub.
const ACCOUNT_META = {
  name: 'Account',
  childRelationships: [
    { childSObject: 'Case', field: 'AccountId', relationshipName: 'Cases' },
    {
      childSObject: 'Contact',
      field: 'AccountId',
      relationshipName: 'Contacts',
    },
  ],
  fields: [
    { name: 'Name', referenceTo: [], type: 'string' },
    { name: 'Type', referenceTo: [], type: 'picklist' },
    { name: 'Industry', referenceTo: [], type: 'picklist' },
  ],
};

interface ExportResult {
  status: string;
  message?: string;
  result: AnyJson;
}

describe('data:export:tree', () => {
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

  it('returns Account record', async () => {
    $$.SANDBOX.stub(fs, 'writeFileSync').returns();
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      if (isString(request) && request.includes('sobjects/Account/describe')) {
        return Promise.resolve(ACCOUNT_META);
      } else {
        const requestMap = ensureJsonMap(request);
        if (ensureString(requestMap.url).includes('query?q=SELECT')) {
          return Promise.resolve(queryResponse);
        }
      }
      return Promise.resolve({});
    };
    const cmd = new Export(['--target-org', 'test@org.com', '--query', query, '--json'], config);

    const result = (await cmd.run()) as unknown as ExportResult;
    expect(result).to.deep.equal({
      records: [
        {
          attributes: {
            type: 'Account',
            referenceId: 'AccountRef1',
          },
          Name: 'Sample Account for Entitlements',
        },
      ],
    });
  });
});
