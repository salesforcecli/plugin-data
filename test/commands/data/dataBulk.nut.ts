/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import { strict as assert } from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { expect, config as chaiConfig } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { sleep } from '@salesforce/kit';
import { ensurePlainObject } from '@salesforce/ts-types';
import type { SaveResult } from '@jsforce/jsforce-node';
import { BulkResultV2 } from '../../../src/types.js';
import { QueryResult } from '../data/query/query.nut.js';

chaiConfig.truncateThreshold = 0;

let testSession: TestSession;

/** Verify that the operation completed successfully and results are available before attempting to do stuff with the results */
const isCompleted = async (cmd: string): Promise<void> => {
  let complete = false;
  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(2000);
    const result = execCmd<BulkResultV2>(cmd);
    if (result.jsonOutput?.status === 0) {
      if (result.jsonOutput.result.jobInfo.state === 'JobComplete') {
        complete = true;
      }
    }
  }
};

/* Check the status of the bulk upsert job using json output to determine progress
 * The four states of a job are Queued, JobComplete, InProgress, and Aborted. If Aborted, the test will fail
 * Otherwise run status until job is JobComplete
 */
const checkBulkResumeJsonResponse = (jobId: string, operation: 'delete' | 'upsert'): void => {
  const statusResponse = execCmd<BulkResultV2>(`data:${operation}:resume --job-id ${jobId} --json`, {
    ensureExitCode: 0,
  }).jsonOutput?.result;
  expect(statusResponse?.jobInfo.state).to.equal('JobComplete');
  expect(statusResponse?.records?.successfulResults).to.be.an('array').with.lengthOf(10);
};

/* Check the status of the bulk upsert job using human output to determine progress
 * The four states of a job are Queued, JobComplete, InProgress, and Aborted. If Aborted, the test will fail
 * Otherwise run status until job is JobComplete
 */
const checkBulkStatusHumanResponse = (statusCommand: string): void => {
  const statusResponse = execCmd(statusCommand, {
    ensureExitCode: 0,
  }).shellOutput.stdout.split(os.EOL);
  const jobState = statusResponse.find((line) => line.includes('Status'));
  expect(jobState).to.include('Job Complete');
};

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
        const bulkUpsertResult: BulkResultV2 = bulkInsertAccounts();
        let jobInfo = bulkUpsertResult.jobInfo;
        expect(jobInfo).to.have.property('id');
        await isCompleted(`data:upsert:resume --job-id ${jobInfo.id} --json`);

        checkBulkStatusHumanResponse(`data:upsert:resume --job-id ${jobInfo.id}`);
        checkBulkResumeJsonResponse(jobInfo.id, 'upsert');

        const bulkDeleteResult = queryAndBulkDelete();
        jobInfo = bulkDeleteResult.jobInfo;
        await isCompleted(`data:delete:resume --job-id ${jobInfo.id} --json`);

        checkBulkStatusHumanResponse(`data:delete:resume --job-id ${jobInfo.id}`);
        checkBulkResumeJsonResponse(jobInfo.id, 'delete');
      });
    });
  });

  describe('bulk data commands with --verbose', () => {
    it('should print table because of --verbose and errors', () => {
      fs.writeFileSync(path.join(testSession.project.dir, 'data.csv'), `Id${os.EOL}001000000000000AAA`);

      const result = execCmd('data:delete:bulk --sobject Account --file data.csv --wait 10 --verbose', {
        ensureExitCode: 1,
      }).shellOutput;
      // Bulk Failures [1]
      // ==========================================================================
      // | Id                 Sf_Id Error
      // | ────────────────── ───── ───────────────────────────────────────────────
      // | 001000000000000AAA       MALFORMED_ID:malformed id 001000000000000AAA:--

      expect(result).to.include('Bulk Failures [1]');
      expect(result).to.include('Id');
      expect(result).to.include('Sf_Id');
      expect(result).to.include('Error');
      expect(result).to.include('INVALID_CROSS_REFERENCE_KEY:invalid cross reference id');
      // expect(result).to.include('MALFORMED_ID:bad id')
    });

    it('should not print table because of errors and missing --verbose', () => {
      fs.writeFileSync(path.join(testSession.project.dir, 'data.csv'), `Id${os.EOL}001000000000000AAA`);

      const result = execCmd('data:delete:bulk --sobject Account --file data.csv --wait 10', { ensureExitCode: 1 })
        .shellOutput.stdout;

      expect(result).to.not.include('Bulk Failures [1]');
    });

    it('should not print error table when there are no errors', () => {
      // insert account
      const accountId = execCmd<SaveResult>('data:create:record -s Account  --values Name=test --json', {
        ensureExitCode: 0,
      }).jsonOutput?.result.id;
      fs.writeFileSync(path.join(testSession.project.dir, 'account.csv'), `Id${os.EOL}${accountId}`);
      const result = execCmd('data:delete:bulk --sobject Account --file account.csv --wait 10 --verbose', {
        ensureExitCode: 0,
      }).shellOutput.stdout; // eslint-disable-next-line no-console
      expect(result).to.include('| Status Job Complete | Records processed 1 | Records failed 0');
    });

    it('should have information in --json', () => {
      fs.writeFileSync(path.join(testSession.project.dir, 'data.csv'), `Id${os.EOL}001000000000000AAA`);

      const result = execCmd<BulkResultV2>(
        'data:delete:bulk --sobject Account --file data.csv --wait 10 --verbose --json',
        { ensureExitCode: 1 }
      ).jsonOutput?.result.records;
      /*
        {
          "status": 1,
          "result": {
            "jobInfo": {
              "id": "<ID>",
              "operation": "delete",
              "object": "Account",
              // ...
            },
            "records": {
              "successfulResults": [],
              "failedResults": [
                {
                  "sf__Id": "",
                  "sf__Error": "MALFORMED_ID:malformed id 001000000000000AAA:--",
                  "Id": "001000000000000AAA"

              ],
              "unprocessedRecords": []
            }
          },
          "warnings": []
        }
      */

      expect(result?.failedResults[0]).to.have.all.keys('sf__Id', 'sf__Error', 'Id');
      expect(result?.failedResults[0].sf__Id).to.equal('001000000000000AAA');
      expect(result?.failedResults[0].sf__Error).to.equal('INVALID_CROSS_REFERENCE_KEY:invalid cross reference id:--');
      // expect(result?.failedResults[0].sf__Error).to.equal('MALFORMED_ID:bad id       001000000000000AAA:--')
      expect(result?.failedResults[0].Id).to.equal('001000000000000AAA');
      expect(result?.successfulResults.length).to.equal(0);
    });

    it('should print verbose success with json', () => {
      // insert account
      const accountId = execCmd<SaveResult>('data:create:record -s Account --values Name=test --json', {
        ensureExitCode: 0,
      }).jsonOutput?.result.id;
      fs.writeFileSync(path.join(testSession.project.dir, 'account.csv'), `Id${os.EOL}${accountId}`);

      const result = execCmd<BulkResultV2>(
        'data:delete:bulk --sobject Account --file account.csv --wait 10 --verbose --json',
        { ensureExitCode: 0 }
      ).jsonOutput?.result.records;
      expect(result?.successfulResults[0]).to.have.all.keys('sf__Id', 'sf__Created', 'Id');
      expect(result?.successfulResults[0].sf__Id).to.equal(accountId);
      expect(result?.successfulResults[0].sf__Created).to.equal('false');
      expect(result?.successfulResults[0].Id).to.equal(accountId);
      expect(result?.failedResults.length).to.equal(0);
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

const queryAndBulkDelete = (): BulkResultV2 => {
  const records = queryAccountRecords();

  const accountIds = records.map((account) => account.Id);
  const idsFile = path.join(testSession.project?.dir ?? '.', 'data', 'deleteAccounts.csv');
  fs.writeFileSync(idsFile, `Id${os.EOL}${accountIds.join(os.EOL)}${os.EOL}`);

  // Run bulk delete
  const deleteResponse: BulkResultV2 | undefined = execCmd<Awaited<BulkResultV2>>(
    `data:delete:bulk --sobject Account --file ${idsFile} --json --wait 10`,
    {
      ensureExitCode: 0,
    }
  ).jsonOutput?.result;

  assert.equal(deleteResponse?.records?.successfulResults.length, 10);
  const bulkDeleteResult = deleteResponse?.records?.successfulResults[0];
  assert('Id' in bulkDeleteResult);
  return deleteResponse;
};

/** Bulk upsert 10 accounts */
const bulkInsertAccounts = (): BulkResultV2 => {
  const cmd = `data:upsert:bulk --sobject Account --file ${path.join(
    '.',
    'data',
    'bulkUpsert.csv'
  )} --external-id Id --json --wait 10`;
  const rawResponse = execCmd(cmd);
  const response: BulkResultV2 | undefined = rawResponse.jsonOutput?.result as BulkResultV2;
  if (response?.records) {
    const records = response.records?.successfulResults;
    assert.equal(records?.length, 10);
    const bulkUpsertResult = response.records?.successfulResults[0];
    assert(Object.keys(ensurePlainObject(bulkUpsertResult)).includes('sf__Id'));
    const jobInfo = response.jobInfo;
    assert('id' in jobInfo);
  }
  return response;
};
