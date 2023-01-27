/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { strict as assert } from 'node:assert/strict';
import fs = require('fs');
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { sleep } from '@salesforce/kit';
import { ensurePlainObject } from '@salesforce/ts-types';
import { BulkResultV2 } from '../../../src/types';
import { QueryResult } from './dataSoqlQuery.nut';

let testSession: TestSession;

/** Verify that the operation completed successfully and results are available before attempting to do stuff with the results */
const isCompleted = async (cmd: string): Promise<void> => {
  let complete = false;
  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(2000);
    const result = execCmd<BulkResultV2>(cmd);
    if (result.jsonOutput?.status === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (result.jsonOutput.result.jobInfo.state === 'JobComplete') {
        complete = true;
      } else {
        // eslint-disable-next-line no-console
        console.log(result);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(result);
    }
  }
};

/* Check the status of the bulk upsert job using json output to determine progress
 * The four states of a job are Queued, JobComplete, InProgress, and Aborted. If Aborted, the test will fail
 * Otherwise run status until job is JobComplete
 */
const checkBulkResumeJsonResponse = (jobId: string, operation: 'delete' | 'upsert'): void => {
  const statusResponse = execCmd<BulkResultV2>(`data:${operation}:resume --jobid ${jobId} --json`, {
    ensureExitCode: 0,
  }).jsonOutput?.result;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(statusResponse?.jobInfo.state).to.equal('JobComplete');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(statusResponse?.records?.successfulResults).to.be.an('array').with.lengthOf(10);
};

/* Check the status of the bulk upsert job using human output to determine progress
 * The four states of a job are Queued, JobComplete, InProgress, and Aborted. If Aborted, the test will fail
 * Otherwise run status until job is JobComplete
 */
const checkBulkStatusHumanResponse = (statusCommand: string): void => {
  const statusResponse = execCmd(statusCommand, {
    ensureExitCode: 0,
  }).shellOutput.stdout.split('\n');
  const jobState = statusResponse.find((line) => line.includes('Status'));
  expect(jobState).to.include('Job Complete');
};

describe('data:bulk commands', () => {
  before(async () => {
    testSession = await TestSession.create({
      scratchOrgs: [
        {
          executable: 'sfdx',
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
        await isCompleted(`data:upsert:resume --jobid ${jobInfo.id} --json`);

        checkBulkStatusHumanResponse(`data:upsert:resume --jobid ${jobInfo.id}`);
        checkBulkResumeJsonResponse(jobInfo.id, 'upsert');

        const bulkDeleteResult = queryAndBulkDelete();
        jobInfo = bulkDeleteResult.jobInfo;
        await isCompleted(`data:delete:resume --jobid ${jobInfo.id} --json`);

        checkBulkStatusHumanResponse(`data:delete:resume --jobid ${jobInfo.id}`);
        checkBulkResumeJsonResponse(jobInfo.id, 'upsert');
      });
    });
  });
});

const queryAccountRecords = () => {
  const queryResponse = execCmd<QueryResult>(
    'data:query --query "select id from Account where phone=\'415-555-0000\'" --json',
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
  fs.writeFileSync(idsFile, `Id\n${accountIds.join('\n')}\n`);

  // Run bulk delete
  const deleteResponse: BulkResultV2 | undefined = execCmd<Awaited<BulkResultV2>>(
    `data:delete:bulk --sobjecttype Account --csvfile ${idsFile} --json --wait 5`,
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
  const response: BulkResultV2 | undefined = execCmd<BulkResultV2>(
    `data:upsert:bulk --sobjecttype Account --csvfile ${path.join(
      '.',
      'data',
      'bulkUpsert.csv'
    )} --externalid Id --json --wait 5`,
    { ensureExitCode: 0 }
  ).jsonOutput?.result as BulkResultV2;
  if (response) {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, ,@typescript-eslint/no-unsafe-assignment */
    const records = response.records?.successfulResults;
    assert.equal(records?.length, 10);
    const bulkUpsertResult = response.records?.successfulResults[0];
    assert(Object.keys(ensurePlainObject(bulkUpsertResult)).includes('sf__Id'));
    const jobInfo = response.jobInfo;
    assert('id' in jobInfo);
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, ,@typescript-eslint/no-unsafe-assignment */
  }
  return response;
};
