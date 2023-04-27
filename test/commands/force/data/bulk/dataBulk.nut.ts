/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { strict as assert } from 'node:assert/strict';
import * as fs from 'fs';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { sleep } from '@salesforce/kit';
import { QueryResult } from '../../../data/dataSoqlQuery.nut';
import { BatcherReturnType } from '../../../../../src/batcher';
import { StatusResult } from '../../../../../src/types';

let testSession: TestSession;

interface BulkStatus {
  state: string;
  totalProcessingTime: number;
}

/** Verify that the operation completed successfully and results are available before attempting to do stuff with the results */
const isCompleted = async (cmd: string): Promise<void> => {
  let complete = false;
  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(2000);
    const result = execCmd<StatusResult>(cmd);
    if (result.jsonOutput?.status === 0) {
      if ('state' in result.jsonOutput.result && result.jsonOutput.result.state === 'Closed') {
        complete = true;
      } else if (
        Array.isArray(result.jsonOutput.result) &&
        result.jsonOutput.result.every((batchInfo) => batchInfo.state === 'Completed')
      ) {
        complete = true;
      } else {
        logUnifiedResults(result.jsonOutput.result);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(`dataBulkNut got an unexpected nonzero result ${result.jsonError?.message}`);
    }
  }
};

const logUnifiedResults = (result: StatusResult): void => {
  if (!Array.isArray(result)) {
    // eslint-disable-next-line no-console
    console.log(`DataBulk.nut.ts is polling for completion.  Job ${result.id} is ${result.state}`);
  }
};
/* Check the status of the bulk upsert job using json output to determine progress
 * The four states of a job are Queued, Completed, InProgress, and Aborted. If Aborted, the test will fail
 * Otherwise run status until job is Completed
 */
const checkBulkStatusJsonResponse = (jobId: string, batchId: string): void => {
  const statusResponse = execCmd<BulkStatus[]>(
    `force:data:bulk:status --job-id ${jobId} --batch-id ${batchId} --json`,
    {
      ensureExitCode: 0,
    }
  ).jsonOutput?.result;
  expect(statusResponse).to.be.an('array').with.lengthOf(1);
  expect(statusResponse?.[0].state).to.equal('Completed');
};

/* Check the status of the bulk upsert job using human output to determine progress
 * The four states of a job are Queued, Completed, InProgress, and Aborted. If Aborted, the test will fail
 * Otherwise run status until job is Completed
 */
const checkBulkStatusHumanResponse = (statusCommand: string): void => {
  const statusResponse = execCmd(statusCommand, {
    ensureExitCode: 0,
  }).shellOutput.stdout.split('\n');
  const jobState = statusResponse.find((line) => line.startsWith('state:'));
  expect(jobState).to.include('Completed');
};

describe('force:data:bulk commands', () => {
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
    describe('data:bulk:upsert then data:bulk:status then soql:query and data:bulk:delete', () => {
      it('should upsert, query, and delete 10 accounts', async () => {
        const bulkUpsertResult = bulkInsertAccounts();
        await isCompleted(
          `force:data:bulk:status --job-id ${bulkUpsertResult.jobId} --batch-id ${bulkUpsertResult.id} --json`
        );

        checkBulkStatusHumanResponse(
          `force:data:bulk:status --job-id ${bulkUpsertResult.jobId} --batch-id ${bulkUpsertResult.id}`
        );
        checkBulkStatusJsonResponse(bulkUpsertResult.jobId, bulkUpsertResult.id);

        const bulkDeleteResult = queryAndBulkDelete();
        await isCompleted(
          `force:data:bulk:status --job-id ${bulkDeleteResult.jobId} --batch-id ${bulkDeleteResult.id} --json`
        );

        checkBulkStatusHumanResponse(
          `force:data:bulk:status --job-id ${bulkDeleteResult.jobId} --batch-id ${bulkDeleteResult.id}`
        );
        checkBulkStatusJsonResponse(bulkDeleteResult.jobId, bulkDeleteResult.id);
      });

      it('should upsert, query, and delete 10 accounts all serially', async () => {
        const bulkUpsertResult = bulkInsertAccounts();
        await isCompleted(
          `force:data:bulk:status --job-id ${bulkUpsertResult.jobId} --batch-id ${bulkUpsertResult.id} --json`
        );
        checkBulkStatusHumanResponse(
          `force:data:bulk:status --job-id ${bulkUpsertResult.jobId} --batch-id ${bulkUpsertResult.id}`
        );
        checkBulkStatusJsonResponse(bulkUpsertResult.jobId, bulkUpsertResult.id);

        const bulkDeleteResult = queryAndBulkDelete();
        await isCompleted(
          `force:data:bulk:status --job-id ${bulkUpsertResult.jobId} --batch-id ${bulkUpsertResult.id} --json`
        );

        checkBulkStatusHumanResponse(
          `force:data:bulk:status --job-id ${bulkDeleteResult.jobId} --batch-id ${bulkDeleteResult.id}`
        );
        checkBulkStatusJsonResponse(bulkDeleteResult.jobId, bulkDeleteResult.id);
      });
    });
  });
});

const queryAccountRecords = () => {
  const queryResponse = execCmd<QueryResult>(
    'force:data:soql:query --query "select id from Account where phone=\'415-555-0000\'" --json',
    {
      ensureExitCode: 0,
    }
  ).jsonOutput?.result ?? { records: [], done: false, totalSize: 0 };
  expect(queryResponse).to.have.property('records').with.lengthOf.above(9);
  return queryResponse.records;
};

const queryAndBulkDelete = () => {
  const records = queryAccountRecords();

  const accountIds = records.map((account) => account.Id);
  const idsFile = path.join(testSession.project?.dir ?? '.', 'data', 'deleteAccounts.csv');
  fs.writeFileSync(idsFile, `Id\n${accountIds.join('\n')}\n`);

  // Run bulk delete
  const deleteResponse = execCmd<BatcherReturnType>(
    `force:data:bulk:delete --sobject Account --file ${idsFile} --json`,
    {
      ensureExitCode: 0,
    }
  ).jsonOutput?.result;

  assert.equal(deleteResponse?.length, 1);
  const bulkDeleteResult = deleteResponse[0];
  assert(bulkDeleteResult.id);
  assert('jobId' in bulkDeleteResult);
  return bulkDeleteResult;
};

/** Bulk upsert 10 accounts */
const bulkInsertAccounts = () => {
  const response = execCmd<BatcherReturnType>(
    `force:data:bulk:upsert --sobject Account --file ${path.join(
      '.',
      'data',
      'bulkUpsert.csv'
    )} --externalid Id --json`,
    { ensureExitCode: 0 }
  ).jsonOutput?.result;
  assert.equal(response?.length, 1);
  const bulkUpsertResult = response[0];
  assert(bulkUpsertResult.id);
  assert('jobId' in bulkUpsertResult);
  return bulkUpsertResult;
};
