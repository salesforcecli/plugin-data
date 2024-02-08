/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable camelcase */ // for salesforce __c style fields

import { expect } from 'chai';
import {
  replaceRefsInTheSameFile,
  EnrichedPlanPart,
  replaceRefs,
  fileSplitter,
} from '../../../../src/api/data/tree/importPlan.js';

describe('importPlan', () => {
  describe('replaceRefsInTheSameFile', () => {
    it('returns the ref when there are no unresolved refs', () => {
      const planPart = {
        filePath: 'somePath',
        sobject: 'Foo__c',
        records: [{ attributes: { referenceId: 'FooRef1', type: 'Foo__c' } }],
        files: [],
      } satisfies EnrichedPlanPart;

      expect(replaceRefsInTheSameFile(planPart)).to.deep.equal([planPart]);
    });
    it('splits the ref into two plan "files" if there are unresolved', () => {
      const planPart = {
        filePath: 'somePath',
        sobject: 'Foo__c',
        records: [
          { attributes: { referenceId: 'Foo__cRef1', type: 'Foo__c' } },
          { attributes: { referenceId: 'Foo__cRef2', type: 'Foo__c' }, lookup__c: '@Foo__cRef1' },
          { attributes: { referenceId: 'Foo__cRef3', type: 'Foo__c' }, lookup__c: '@Foo__cRef2' },
        ],
        files: [],
      } satisfies EnrichedPlanPart;

      const result = replaceRefsInTheSameFile(planPart);
      expect(result).to.deep.equal([
        {
          filePath: 'somePath (no refs)',
          sobject: 'Foo__c',
          records: [{ attributes: { referenceId: 'Foo__cRef1', type: 'Foo__c' } }],
          files: [],
        },
        {
          filePath: 'somePath (refs to be resolved)',
          sobject: 'Foo__c',
          records: [
            { attributes: { referenceId: 'Foo__cRef2', type: 'Foo__c' }, lookup__c: '@Foo__cRef1' },
            { attributes: { referenceId: 'Foo__cRef3', type: 'Foo__c' }, lookup__c: '@Foo__cRef2' },
          ],
          files: [],
        },
      ]);
    });
  });
  describe('replaceRefs', () => {
    it('replaces refs in a record', () => {
      const records = [
        { attributes: { referenceId: 'Foo__cRef1', type: 'Foo__c' } },
        { attributes: { referenceId: 'Foo__cRef2', type: 'Foo__c' }, lookup__c: '@Foo__cRef1' },
        { attributes: { referenceId: 'Foo__cRef3', type: 'Foo__c' }, lookup__c: '@Foo__cRef2' },
      ];
      const resultsSoFar = [
        { refId: 'Foo__cRef1', type: 'Foo__c', id: '001000000000001' },
        { refId: 'Foo__cRef2', type: 'Foo__c', id: '001000000000002' },
      ];
      expect(replaceRefs(resultsSoFar)(records)).to.deep.equal([
        { attributes: { referenceId: 'Foo__cRef1', type: 'Foo__c' } },
        { attributes: { referenceId: 'Foo__cRef2', type: 'Foo__c' }, lookup__c: '001000000000001' },
        { attributes: { referenceId: 'Foo__cRef3', type: 'Foo__c' }, lookup__c: '001000000000002' },
      ]);
    });
  });
  describe('fileSplitter', () => {
    const planPartBase = {
      filePath: 'somePath',
      sobject: 'Foo__c',
      records: [],
      files: [],
    } satisfies EnrichedPlanPart;

    it('returns the same file if it has less than 200 records', () => {
      const records = new Array(40).fill({ attributes: { referenceId: 'FooRef1', type: 'Foo__c' } });
      const result = fileSplitter({ ...planPartBase, records });
      expect(result).to.have.length(1);
      expect(result[0].records).to.have.length(40);
    });
    it('splits a bigger file into multiple files', () => {
      const records = new Array(500).fill({ attributes: { referenceId: 'FooRef1', type: 'Foo__c' } });

      const result = fileSplitter({ ...planPartBase, records });
      expect(result).to.have.length(3);
      expect(result[0].records).to.have.length(200);
      expect(result[1].records).to.have.length(200);
      expect(result[2].records).to.have.length(100);
    });
  });
});
