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
import type { BulkResultV2 } from '../../../src/types.js';
import type { QueryResult } from '../data/query/query.nut.js';

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
  expect(jobState).to.include('JobComplete');
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

const queryAndBulkDelete = (): BulkResultV2 => {
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
  )} --external-id Id --json --wait 10 --column-delimiter COMMA`;
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
