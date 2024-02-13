/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { expect } from 'chai';
import { SObjectTreeFileContents } from '../../../../src/dataSoqlQueryTypes.js';
import { createSObjectTypeMap } from '../../../../src/api/data/tree/importFiles.js';

describe('importFiles', () => {
  describe('createSobjectTypeMap', () => {
    it('works with a 2-level tree file with nested records', () => {
      const accountsContactsTreeJSON = JSON.parse(
        fs.readFileSync('test/api/data/tree/test-files/accounts-contacts-tree.json', 'utf-8')
      ) as SObjectTreeFileContents;

      expect(createSObjectTypeMap(accountsContactsTreeJSON.records)).to.deep.equal(
        new Map([
          ['SampleAccountRef', 'Account'],
          ['PresidentSmithRef', 'Contact'],
          ['VPEvansRef', 'Contact'],
          ['SampleAcct2Ref', 'Account'],
        ])
      );
    });
  });
});
