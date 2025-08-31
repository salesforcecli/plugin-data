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
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { DataImportBulkResult } from '../../../../src/commands/data/import/bulk.js';
import { generateAccountsCsv } from '../../../testUtil.js';

describe('data import bulk NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
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
    await session?.clean();
  });

  it('should import account records', async () => {
    const csvFile = await generateAccountsCsv(session.dir);

    const result = execCmd<DataImportBulkResult>(
      `data import bulk --file ${csvFile} --sobject Account --wait 10 --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result?.jobId).not.be.undefined;
    expect(result?.jobId.length).to.equal(18);
    expect(result?.processedRecords).to.equal(10_000);
    expect(result?.successfulRecords).to.equal(10_000);
    expect(result?.failedRecords).to.equal(0);
  });

  describe('csv', () => {
    it('should detect PIPE as the column separator', async () => {
      const csvFile = await generateAccountsCsv(session.dir, 'PIPE');

      const result = execCmd<DataImportBulkResult>(
        `data import bulk --file ${csvFile} --sobject Account --wait 10 --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      expect(result?.jobId).not.be.undefined;
      expect(result?.jobId.length).to.equal(18);
      expect(result?.processedRecords).to.equal(10_000);
      expect(result?.successfulRecords).to.equal(10_000);
      expect(result?.failedRecords).to.equal(0);
    });
  });

  it('should import CSV exported by `data export bulk`', async () => {
    const csvFile = await generateAccountsCsv(session.dir, 'PIPE');

    const importRes = execCmd<DataImportBulkResult>(
      `data import bulk --file ${csvFile} --sobject Account --wait 10 --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(importRes?.jobId).not.be.undefined;
    expect(importRes?.jobId.length).to.equal(18);
    expect(importRes?.processedRecords).to.equal(10_000);
    expect(importRes?.successfulRecords).to.equal(10_000);
    expect(importRes?.failedRecords).to.equal(0);

    execCmd<DataImportBulkResult>(
      'data export bulk --output-file accounts.csv --query "select name,type,phone,website from account" --wait 10',
      { ensureExitCode: 0 }
    );

    const lastImportRes = execCmd<DataImportBulkResult>(
      'data import bulk --file accounts.csv --sobject Account --wait 10 --json',
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(lastImportRes?.jobId).not.be.undefined;
    expect(lastImportRes?.jobId.length).to.equal(18);
    // there might be additional records in the scratch org, here we ensure import processed the 10K in the CSV file)
    expect(lastImportRes?.processedRecords).to.greaterThan(10_000);
    expect(lastImportRes?.successfulRecords).to.greaterThan(10_000);
    expect(lastImportRes?.failedRecords).to.equal(0);
  });

  it('should report error msg from a failed job', async () => {
    const csvFile = await generateAccountsCsv(session.dir);

    // we pass `Contact` instead of `Account` on purpose to make the job fail
    const result = execCmd<DataImportBulkResult>(
      `data import bulk --file ${csvFile} --sobject Contact --wait 10 --json`,
      { ensureExitCode: 1 }
    ).jsonOutput;

    expect(result?.name).to.equal('JobFailedError');
    expect(result?.message).to.include('Job failed to be processed due to');
  });
});
