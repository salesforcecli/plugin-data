/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import fs = require('fs');
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { getNumber, getString } from '@salesforce/ts-types';
import { QueryResult } from '../soql/query/dataSoqlQuery.nut';

let testSession: TestSession;

interface BulkUpsertDelete {
  id: string;
  jobId: string;
}

interface BulkStatus {
  state: string;
  totalProcessingTime: number;
}

interface ShellString {
  code: number;
  stdout: string;
  stderr: string;
}

/* Check the status of the bulk upsert job using json output to determine progress
 * The four states of a job are Queued, Completed, InProgress, and Aborted. If Aborted, the test will fail
 * Otherwise run status until job is Completed
 */
const checkBulkStatusJsonResponse = (jobId: string, batchId: string): void => {
  let totalProcessingTime;
  let jobState;
  do {
    const statusResponse = execCmd<BulkStatus[]>(
      `force:data:bulk:status --jobid ${jobId} --batchid ${batchId} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result ?? [{ state: 'InProgress', totalProcessingTime: 0 }];
    expect(statusResponse).to.be.an('array').with.lengthOf(1);
    totalProcessingTime = getNumber(statusResponse[0], 'totalProcessingTime') ?? 0;
    jobState = getString(statusResponse[0], 'state', 'InProgress') ?? 'InProgress';
  } while (totalProcessingTime < 10000 && (jobState === 'InProgress' || jobState === 'Queued'));
  expect(jobState).to.equal('Completed');
};

/* Check the status of the bulk upsert job using human output to determine progress
 * The four states of a job are Queued, Completed, InProgress, and Aborted. If Aborted, the test will fail
 * Otherwise run status until job is Completed
 */
const checkBulkStatusHumanResponse = (statusCommand: string): void => {
  let totalProcessingTime = 0;
  let jobState: string;
  do {
    const statusResponse = (execCmd<BulkStatus[]>(statusCommand.replace(/^sfdx /, ''), {
      ensureExitCode: 0,
    }).shellOutput as ShellString).stdout.split('\n');
    jobState = statusResponse.find((line) => line.startsWith('state:')) ?? 'InProgress';
    const totalProcessingTimeLine =
      statusResponse.find((line) => line.startsWith('totalProcessingTime:')) ?? 'totalProcessingTime: 0';
    totalProcessingTime = parseInt(totalProcessingTimeLine.split(/\s+/)[1], 10);
  } while (totalProcessingTime < 10000 && (jobState.includes('InProgress') || jobState.includes('Queued')));
  expect(jobState).to.include('Completed');
};

function queryAccountRecords() {
  const queryResponse = execCmd<QueryResult>(
    'force:data:soql:query --query "select id from Account where phone=\'415-555-0000\'" --json',
    {
      ensureExitCode: 0,
    }
  ).jsonOutput?.result ?? { records: [], done: false, totalSize: 0 };
  expect(queryResponse).to.have.property('records').with.lengthOf(10);
  return queryResponse.records;
}

describe('data:bulk commands', () => {
  before(() => {
    testSession = TestSession.create({
      setupCommands: [
        'sfdx force:org:create -f config/project-scratch-def.json --setdefaultusername --wait 10 --durationdays 1',
      ],
      project: { sourceDir: path.join('test', 'test-files', 'data-project') },
    });
  });

  after(async () => {
    testSession?.clean();
  });

  describe('data:bulk verify json responses', () => {
    describe('data:bulk:upsert then data:bulk:status then soql:query and data:bulk:delete', () => {
      it('should upsert, query, and delete 10 accounts', () => {
        // Bulk upsert 10 accounts
        const response = execCmd<BulkUpsertDelete[]>(
          `force:data:bulk:upsert --sobjecttype Account --csvfile ${path.join(
            '.',
            'data',
            'bulkUpsert.csv'
          )} --externalid Id --json`,
          { ensureExitCode: 0 }
        ).jsonOutput?.result ?? [{ id: '', jobId: '' }];
        expect(response).to.be.an('array').with.lengthOf(1);
        const bulkUpsertResult = response[0];
        expect(bulkUpsertResult).to.have.property('jobId');
        expect(bulkUpsertResult).to.have.property('id');

        checkBulkStatusJsonResponse(bulkUpsertResult.jobId, bulkUpsertResult.id);

        const records = queryAccountRecords();

        const accountIds = records.map((account) => account.Id);
        const idsFile = path.join(testSession.project?.dir ?? '.', 'data', 'deleteAccounts.csv');
        fs.writeFileSync(idsFile, `Id\n${accountIds.join('\n')}\n`);

        // Run bulk delete
        const deleteResponse = execCmd<BulkUpsertDelete[]>(
          `force:data:bulk:delete --sobjecttype Account --csvfile ${idsFile} --json`,
          {
            ensureExitCode: 0,
          }
        ).jsonOutput?.result ?? [{ id: '', jobId: '' }];
        expect(deleteResponse).to.be.an('array').with.lengthOf(1);
        const bulkDeleteResult = deleteResponse[0];
        expect(bulkDeleteResult).to.have.property('jobId');
        expect(bulkDeleteResult).to.have.property('id');

        // Query for the status of the bulk delete job and make sure it completed
        checkBulkStatusJsonResponse(bulkUpsertResult.jobId, bulkUpsertResult.id);
      });
    });
  });
  describe('data:bulk verify human responses', () => {
    describe('data:bulk:upsert then data:bulk:status then soql:query and data:bulk:delete', () => {
      it('should upsert, query, and delete 10 accounts', () => {
        // Bulk upsert 10 accounts
        const response = (execCmd<BulkUpsertDelete[]>(
          `force:data:bulk:upsert --sobjecttype Account --csvfile ${path.join(
            '.',
            'data',
            'bulkUpsert.csv'
          )} --externalid Id`,
          { ensureExitCode: 0 }
        ).shellOutput as ShellString).stdout;
        expect(response).to.match(/Check batch.*?status with the command:/g);
        let statusCheckCommand =
          response.split('\n').find((line) => line.startsWith('sfdx force:data:bulk:status')) ?? '';

        checkBulkStatusHumanResponse(statusCheckCommand);

        // Query for the accounts created and create a file with ids
        const records = queryAccountRecords();

        const accountIds = records.map((account) => account.Id);
        const idsFile = path.join(testSession.project?.dir ?? '.', 'data', 'deleteAccounts.csv');
        fs.writeFileSync(idsFile, `Id\n${accountIds.join('\n')}\n`);

        // Run bulk delete
        const deleteResponse = (execCmd<BulkUpsertDelete[]>(
          `force:data:bulk:delete --sobjecttype Account --csvfile ${idsFile}`,
          {
            ensureExitCode: 0,
          }
        ).shellOutput as ShellString).stdout;
        expect(response).to.match(/Check batch.*?status with the command:/g);
        statusCheckCommand =
          deleteResponse.split('\n').find((line) => line.startsWith('sfdx force:data:bulk:status')) ?? '';

        checkBulkStatusHumanResponse(statusCheckCommand);
      });
    });
  });
});
