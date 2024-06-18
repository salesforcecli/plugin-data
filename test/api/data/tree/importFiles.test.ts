/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { Messages } from '@salesforce/core';

import { expect, assert } from 'chai';
import { SObjectTreeFileContents } from '../../../../src/types.js';
import { FileInfo, createSObjectTypeMap, validateNoRefs } from '../../../../src/api/data/tree/importFiles.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'importApi');

describe('importFiles', () => {
  describe('validateNoRefs', () => {
    const good: FileInfo = {
      rawContents: '',
      records: [
        {
          attributes: {
            type: 'Account',
            referenceId: 'ref1',
          },
        },
      ],
      filePath: 'testPath',
      sobject: 'Account',
    };
    it('return a good FileInfo', () => {
      expect(validateNoRefs(good)).to.deep.equal(good);
    });
    it('throws for a bad ref', () => {
      const bad = {
        ...good,
        // eslint-disable-next-line camelcase
        records: [...good.records, { attributes: { type: 'Account', referenceId: 'ref2' }, Field__c: '@ContactRef46' }],
      };
      const expectedError = messages.getMessage('error.RefsInFiles', [bad.filePath]);
      try {
        validateNoRefs(bad);
        throw new Error('Expected an error');
      } catch (e) {
        assert(e instanceof Error);
        expect(e.message).to.equal(expectedError);
      }
    });
  });
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
