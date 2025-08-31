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
import { shouldThrow } from '@salesforce/core/testSetup';
import { Logger } from '@salesforce/core';
import {
  replaceRefsInTheSameFile,
  EnrichedPlanPart,
  replaceRefs,
  fileSplitter,
  validatePlanContents,
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
    // ensure no static rootLogger
    // @ts-expect-error private stuff
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Logger.rootLogger = undefined;
    const logger = new Logger({ name: 'importPlanTest', useMemoryLogger: true });
    afterEach(() => {
      // @ts-expect-error private stuff
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      logger.memoryLogger.loggedData = [];
    });
    const validator = validatePlanContents(logger);
    it('good plan in classic format', async () => {
      const plan = [
        {
          sobject: 'Account',
          saveRefs: true,
          resolveRefs: true,
          files: ['Account.json'],
        },
      ];
      expect(await validator('some/path', plan)).to.equal(plan);
      expect(getLogMessages(logger)).to.include('saveRefs');
    });
    it('good plan in classic format', async () => {
      const plan = [
        {
          sobject: 'Account',
          saveRefs: true,
          resolveRefs: true,
          files: ['Account.json', 'Account2.json'],
        },
      ];
      expect(await validator('some/path', plan)).to.equal(plan);
    });
    it('throws on bad plan (missing the object)', async () => {
      const plan = [
        {
          saveRefs: true,
          resolveRefs: true,
          files: ['Account.json', 'Account2.json'],
        },
      ];
      try {
        await shouldThrow(validator('some/path', plan));
      } catch (e) {
        assert(e instanceof Error);
        expect(e.name).to.equal('InvalidDataImportError');
      }
    });
    // TODO: remove this test when schema moves to simple files only
    it('throws when files are an object that meets current schema', async () => {
      const plan = [
        {
          sobject: 'Account',
          saveRefs: true,
          resolveRefs: true,
          files: [{ file: 'foo', contentType: 'application/json', saveRefs: true, resolveRefs: true }],
        },
      ];
      try {
        await shouldThrow(validator('some/path', plan));
      } catch (e) {
        assert(e instanceof Error);
        expect(e.name, JSON.stringify(e)).to.equal('NonStringFilesError');
      }
    });
    it('good plan in new format is valid and produces no warnings', async () => {
      const plan = [
        {
          sobject: 'Account',
          files: ['Account.json'],
        },
      ];
      expect(await validator('some/path', plan)).to.equal(plan);
      expect(getLogMessages(logger)).to.not.include('saveRefs');
    });
  });
});

const getLogMessages = (logger: Logger): string =>
  logger
    .getBufferedRecords()
    .map((i) => i.msg)
    .join('/n');
