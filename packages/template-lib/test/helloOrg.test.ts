/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Org } from '@salesforce/core';
import { testSetup } from '@salesforce/core/lib/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { HelloOrg } from '../lib/helloOrg';

describe('HelloOrg', () => {
  describe('getHelloMessage', () => {
    const $$ = testSetup();
    const username = 'foo@example.com';
    const orgName = 'MyOrg';
    let org: Org;

    beforeEach(async () => {
      org = await Org.create({
        aliasOrUsername: username,
      });
      stubMethod($$.SANDBOX, HelloOrg.prototype, 'query').returns(Promise.resolve({ name: orgName }));
    });
    it('should return a string containing the username and org name', async () => {
      const helloOrg = await HelloOrg.create({ username, org });
      const message = await helloOrg.getHelloMessage();
      expect(message).to.include(username).and.to.include('MyOrg');
    });
  });
});
