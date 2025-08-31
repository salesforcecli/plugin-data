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
import path from 'node:path';
import { strict as assert } from 'node:assert/strict';
import fs from 'node:fs';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { sleep } from '@salesforce/kit';
import { JobInfo } from '@jsforce/jsforce-node/lib/api/bulk.js';
import { BatcherReturnType, BulkResult } from '../../../../../src/batcher.js';
import { StatusResult } from '../../../../../src/types.js';
import { QueryResult } from '../../../data/query/query.nut.js';
import { DataExportBulkResult } from '../../../../../src/commands/data/export/bulk.js';

let testSession: TestSession;

type BulkStatus = {
  state: string;
  totalProcessingTime: number;
};

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

      // Bulk v1 batch limit is 10K records so this NUT ensures we handle multiple batches correctly.
      it('should upsert, query and delete 60K accounts (sync)', async () => {
        // bulk v1 upsert
        const cmdRes = execCmd<BatcherReturnType>(
          `force:data:bulk:upsert --sobject Account --file ${path.join(
            '.',
            'data',
            'bulkUpsertLarge.csv'
          )} --externalid Id --wait 10 --json`,
          { ensureExitCode: 0 }
        ).jsonOutput?.result;
        assert.equal(cmdRes?.length, 1);
        // guaranteed by the assertion, done for ts
        const upsertJobResult = cmdRes[0];

        if (isBulkJob(upsertJobResult)) {
          assert.equal(upsertJobResult.numberBatchesCompleted, '8');
          assert.equal(upsertJobResult.numberBatchesFailed, '0');
          assert.equal(upsertJobResult.numberRecordsProcessed, '76380');
        } else {
          assert.fail('upsertJobResult does not contain bulk job info.');
        }

        // bulk v2 export to get IDs of accounts to delete
        const outputFile = 'export-accounts.csv';
        const result = execCmd<DataExportBulkResult>(
          `data export bulk -q "select id from account where phone = '415-555-0000'" --output-file ${outputFile} --wait 10 --json`,
          { ensureExitCode: 0 }
        ).jsonOutput?.result;
        expect(result?.totalSize).to.equal(76_380);
        expect(result?.filePath).to.equal(outputFile);

        // bulk v1 delete
        const cmdDeleteRes = execCmd<BatcherReturnType>(
          `force:data:bulk:delete --sobject Account --file ${outputFile} --wait 10 --json`,
          { ensureExitCode: 0 }
        ).jsonOutput?.result;
        assert.equal(cmdDeleteRes?.length, 1);
        // guaranteed by the assertion, done for ts
        const deleteJobResult = cmdDeleteRes[0];
        if (isBulkJob(deleteJobResult)) {
          assert.equal(deleteJobResult.numberBatchesCompleted, '8');
          assert.equal(deleteJobResult.numberBatchesFailed, '0');
          assert.equal(deleteJobResult.numberRecordsProcessed, '76380');
        } else {
          assert.fail('deleteJobResult does not contain bulk job info.');
        }
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
  // guaranteed by the assertion, done for ts
  const bulkUpsertResult = response[0];
  assert(bulkUpsertResult.id);
  assert('jobId' in bulkUpsertResult);
  return bulkUpsertResult;
};

function isBulkJob(info: JobInfo | BulkResult): info is JobInfo {
  return (info as JobInfo).numberBatchesCompleted !== undefined;
}
