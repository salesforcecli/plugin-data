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
import path from 'node:path';
import { strict as assert } from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { expect, config as chaiConfig } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { ensurePlainObject } from '@salesforce/ts-types';
import type { BulkResultV2 } from '../../../src/types.js';
import type { QueryResult } from '../data/query/query.nut.js';

chaiConfig.truncateThreshold = 0;

let testSession: TestSession;

describe('data:bulk commands', () => {
  before(async () => {
    testSession = await TestSession.create({
      scratchOrgs: [
        {
          config: 'config/project-scratch-def.json',
          setDefault: true,
        },
      ],
      project: { sourceDir: path.join('test', 'test-files', 'data-project') },
      devhubAuthStrategy: 'AUTO',
    });
  });

  after(async () => {
    await testSession?.clean();
  });

  describe('data:bulk verify json and human responses', () => {
    describe('data:upsert:bulk then data:upsert:resume then soql:query and data:delete:bulk', () => {
      it('should upsert, query, and delete 10 accounts', async () => {
        const cmd = `data:upsert:bulk --sobject Account --file ${path.join(
          '.',
          'data',
          'bulkUpsert.csv'
        )} --external-id Id --json --wait 10 --column-delimiter COMMA`;
        const rawResponse = execCmd(cmd);
        const response: BulkResultV2 | undefined = rawResponse.jsonOutput?.result as BulkResultV2;

        expect(response.jobInfo).to.have.property('id');
        expect(response.jobInfo.state).to.equal('JobComplete');
        expect(response.records?.successfulResults).to.be.an('array').with.lengthOf(10);
        const bulkUpsertResult = response.records?.successfulResults[0];
        assert(Object.keys(ensurePlainObject(bulkUpsertResult)).includes('sf__Id'));

        const records = queryAccountRecords();

        const accountIds = records.map((account) => account.Id);
        const idsFile = path.join(testSession.project?.dir ?? '.', 'data', 'deleteAccounts.csv');
        fs.writeFileSync(idsFile, `Id${os.EOL}${accountIds.join(os.EOL)}${os.EOL}`);

        // Run bulk delete
        const deleteResponse: BulkResultV2 | undefined = execCmd<Awaited<BulkResultV2>>(
          `data:delete:bulk --sobject Account --file ${idsFile} --json --wait 10 --line-ending ${
            os.platform() === 'win32' ? 'CRLF' : 'LF'
          }`,
          {
            ensureExitCode: 0,
          }
        ).jsonOutput?.result;

        expect(deleteResponse?.jobInfo).to.have.property('id');
        expect(deleteResponse?.jobInfo.state).to.equal('JobComplete');
        expect(deleteResponse?.records?.successfulResults.length).to.equal(10);
        const bulkDeleteResult = deleteResponse?.records?.successfulResults[0];
        assert(Object.keys(ensurePlainObject(bulkDeleteResult)).includes('sf__Id'));
      });
    });
  });

  describe('bulk data commands', () => {
    it('should not print table because of errors', () => {
      fs.writeFileSync(path.join(testSession.project.dir, 'data.csv'), `Id${os.EOL}001000000000000AAA`);

      const result = execCmd('data:delete:bulk --sobject Account --file data.csv --wait 10', { ensureExitCode: 1 })
        .shellOutput.stdout;

      expect(result).to.not.include('Bulk Failures [1]');
    });

    it('bulk upsert should have information in --json', () => {
      const result = execCmd<BulkResultV2>(
        `data:upsert:bulk --sobject Account --file ${path.join(
          '.',
          'data',
          'bulkUpsertBackquote.csv'
        )} --external-id Id --wait 10 --json --column-delimiter BACKQUOTE`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result.records;

      expect(result?.successfulResults.length).to.equal(10);
      expect(result?.failedResults.length).to.equal(0);
      expect(result?.unprocessedRecords.length).to.equal(0);

      expect(result?.successfulResults[0]).to.have.all.keys(
        'sf__Id',
        'sf__Created',
        'ANNUALREVENUE',
        'NAME',
        'PHONE',
        'TYPE',
        'WEBSITE'
      );
      expect(result?.successfulResults[0].sf__Id?.length).to.equal(18);
    });
  });
});

const queryAccountRecords = () => {
  const queryResponse = execCmd<QueryResult>(
    `data:query --query "select id from Account where phone='${'415-555-0000'.toString()}'" --json`,
    {
      ensureExitCode: 0,
    }
  ).jsonOutput?.result ?? { records: [], done: false, totalSize: 0 };
  expect(queryResponse).to.have.property('records').with.lengthOf.above(9);
  return queryResponse.records;
};
