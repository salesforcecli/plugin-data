/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import fs = require('fs');
import { assert, expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { getNumber, getString } from '@salesforce/ts-types';
import { QueryResult } from '../tree/dataTree.nut';

let testSession: TestSession;

interface BulkUpsertDelete {
  id: string;
  jobId: string;
  state: string;
  createdDate: string;
  systemModstamp: string;
  numberRecordsProcessed: number;
  numberRecordsFailed: number;
  totalProcessingTime: number;
  apiActiveProcessingTime: number;
  apexProcessingTime: number;
}

interface BulkStatus {
  id: string;
  jobId: string;
  state: string;
  createdDate: string;
  systemModstamp: string;
  numberRecordsProcessed: number;
  numberRecordsFailed: number;
  totalProcessingTime: number;
  apiActiveProcessingTime: number;
  apexProcessingTime: number;
}

describe('data:bulk commands', () => {
  before(async () => {
    testSession = TestSession.create({
      setupCommands: ['sfdx force:org:create -f config/project-scratch-def.json --setdefaultusername --wait 10'],
      project: { sourceDir: path.join('test', 'test-files', 'data-project') },
    });
  });

  after(async () => {
    testSession?.clean();
  });

  describe('data:bulk:upsert then data:bulk:status then soql:query and data:bulk:delete', () => {
    it('should upsert, query, and delete 10 accounts', async () => {
      // Bulk upsert 10 accounts
      const response = execCmd<BulkUpsertDelete[]>(
        `force:data:bulk:upsert --sobjecttype Account --csvfile ${path.join(
          '.',
          'data',
          'bulkUpsert.csv'
        )} --externalid Id --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      expect(response?.result).to.be.an('array').with.lengthOf(1);
      const bulkUpsertResult = response?.result[0];
      expect(bulkUpsertResult).to.have.property('jobId');
      expect(bulkUpsertResult).to.have.property('id');

      /* Check the status of the bulk upsert job
       * The four states of a job are Queued, Completed, InProgress, and Aborted. If Aborted, the test will fail
       * Otherwise run status until job is Completed
       */
      let totalProcessingTime;
      let jobState;
      let statusResponse;
      do {
        statusResponse = execCmd<BulkStatus[]>(
          `force:data:bulk:status --jobid ${getString(bulkUpsertResult, 'jobId')} --batchid ${getString(
            bulkUpsertResult,
            'id'
          )} --json`,
          { ensureExitCode: 0 }
        ).jsonOutput;
        expect(statusResponse?.result).to.be.an('array').with.lengthOf(1);
        totalProcessingTime = getNumber(statusResponse?.result[0], 'totalProcessingTime') ?? 0;
        jobState = getString(statusResponse?.result[0], 'state') ?? 'InProgress';
      } while (totalProcessingTime < 10000 && (jobState === 'InProgress' || jobState === 'Queued'));
      expect(jobState).to.equal('Completed');

      // Query for the accounts created and create a file with ids
      const queryResponse = execCmd<QueryResult>(
        'force:data:soql:query --query "select id from Account where phone=\'415-555-0000\'" --json',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput;
      expect(queryResponse?.result).to.have.property('records').with.lengthOf(10);
      const records = queryResponse?.result.records ?? [];

      const accountIds = records.map((account) => account.Id);
      const idsFile = path.join(testSession.project?.dir ?? '.', 'data', 'deleteAccounts.csv');
      try {
        if (fs.existsSync(idsFile)) {
          fs.unlinkSync(idsFile);
        }
        fs.writeFileSync(idsFile, `Id\n${accountIds.join('\n')}\n`);
      } catch (error) {
        assert.fail('', '', 'Could not create csv file of ids to delete');
      }

      // Run bulk delete
      const deleteResponse = execCmd<BulkUpsertDelete[]>(
        `force:data:bulk:delete --sobjecttype Account --csvfile ${idsFile} --json`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput;
      expect(deleteResponse?.result).to.be.an('array').with.lengthOf(1);
      const bulkDeleteResult = deleteResponse?.result[0];
      expect(bulkDeleteResult).to.have.property('jobId');
      expect(bulkDeleteResult).to.have.property('id');

      // Query for the status of the bulk delete job and make sure it completed
      do {
        statusResponse = execCmd<BulkStatus[]>(
          `force:data:bulk:status --jobid ${getString(bulkUpsertResult, 'jobId')} --batchid ${getString(
            bulkUpsertResult,
            'id'
          )} --json`,
          { ensureExitCode: 0 }
        ).jsonOutput;
        expect(statusResponse?.result).to.be.an('array').with.lengthOf(1);
        totalProcessingTime = getNumber(statusResponse?.result[0], 'totalProcessingTime') ?? 0;
        jobState = getString(statusResponse?.result[0], 'state', 'InProgress') ?? 'InProgress';
      } while (totalProcessingTime < 10000 && (jobState === 'InProgress' || jobState === 'Queued'));
      expect(jobState).to.equal('Completed');
    });
  });
});
