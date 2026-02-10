/*
 * Copyright 2026, Salesforce, Inc.
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
