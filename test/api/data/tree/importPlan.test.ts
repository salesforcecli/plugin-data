/*
 * Copyright 2025, Salesforce, Inc.
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
/* eslint-disable camelcase */ // for salesforce __c style fields

import { expect, assert } from 'chai';
import { shouldThrowSync } from '@salesforce/core/testSetup';
import {
  replaceRefsInTheSameFile,
  EnrichedPlanPart,
  replaceRefs,
  fileSplitter,
  _validatePlanContents,
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

      expect(replaceRefsInTheSameFile(planPart).ready).to.deep.equal(planPart);
      expect(replaceRefsInTheSameFile(planPart).notReady).to.be.undefined;
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
      expect(result).to.deep.equal({
        ready: {
          filePath: 'somePath',
          sobject: 'Foo__c',
          records: [{ attributes: { referenceId: 'Foo__cRef1', type: 'Foo__c' } }],
          files: [],
        },
        notReady: {
          filePath: 'somePath',
          sobject: 'Foo__c',
          records: [
            { attributes: { referenceId: 'Foo__cRef2', type: 'Foo__c' }, lookup__c: '@Foo__cRef1' },
            { attributes: { referenceId: 'Foo__cRef3', type: 'Foo__c' }, lookup__c: '@Foo__cRef2' },
          ],
          files: [],
        },
      });
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
  describe('plan validation', () => {
    it('good plan in classic format, one file', () => {
      const plan = [
        {
          sobject: 'Account',
          saveRefs: true,
          resolveRefs: true,
          files: ['Account.json'],
        },
      ];

      const { parsedPlans, warnings } = _validatePlanContents('some/path', plan);
      expect(parsedPlans).to.deep.equal(plan);
      expect(warnings).to.be.length(1);
      expect(warnings[0]).to.include('saveRefs');
    });

    it('good plan in classic format, multiple files', () => {
      const plan = [
        {
          sobject: 'Account',
          saveRefs: true,
          resolveRefs: true,
          files: ['Account.json', 'Account2.json'],
        },
      ];

      const { parsedPlans, warnings } = _validatePlanContents('some/path', plan);
      expect(parsedPlans).to.deep.equal(plan);
      expect(warnings).to.be.length(1);
      expect(warnings[0]).to.include('saveRefs');
    });

    it('throws on bad plan (missing sobject property)', () => {
      const plan = [
        {
          saveRefs: true,
          resolveRefs: true,
          files: ['Account.json', 'Account2.json'],
        },
      ];

      try {
        shouldThrowSync(() => _validatePlanContents('some/path', plan));
      } catch (e) {
        assert(e instanceof Error);
        expect(e.name).to.equal('InvalidDataImportError');
      }
    });
    it('throws when files property contains non-strings', () => {
      const plan = [
        {
          sobject: 'Account',
          saveRefs: true,
          resolveRefs: true,
          files: [{ file: 'foo', contentType: 'application/json', saveRefs: true, resolveRefs: true }],
        },
      ];
      try {
        shouldThrowSync(() => _validatePlanContents('some/plan', plan));
      } catch (e) {
        assert(e instanceof Error);
        expect(e.message).to.include('The `files` property of the plan objects must contain only strings');
      }
    });
    it('good plan in new format', () => {
      const plan = [
        {
          sobject: 'Account',
          files: ['Account.json'],
        },
      ];
      const { parsedPlans, warnings } = _validatePlanContents('some/path', plan);
      expect(parsedPlans).to.deep.equal(plan);
      expect(warnings).to.be.length(0);
    });
  });
});
