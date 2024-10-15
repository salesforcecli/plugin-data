/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { EOL } from 'node:os';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { DataImportBulkResult } from '../../../../src/commands/data/import/bulk.js';

describe('data import resume NUTs', () => {
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

  it('should resume bulk import', async () => {
    const csvFile = await generateAccountsCsv(session.dir);

    // about the type assertion at the end:
    // I'm passing `--json` in and `ensureExitCode: 0` so I should always have a JSON result.
    const exportAsyncResult = execCmd<DataImportBulkResult>(
      `data import bulk --file ${csvFile} --sobject account --async --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result as DataImportBulkResult;

    expect(exportAsyncResult.jobId).not.to.be.undefined;
    expect(exportAsyncResult.jobId).to.be.length(18);

    const importResumeResult = execCmd<DataImportBulkResult>(
      `data import resume -i ${exportAsyncResult.jobId} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result as DataImportBulkResult;

    expect(importResumeResult.processedRecords).to.equal(10_000);
    expect(importResumeResult.successfulRecords).to.equal(10_000);
    expect(importResumeResult.failedRecords).to.equal(0);
  });

  it('should resume bulk import, --use-most-recent', async () => {
    const csvFile = await generateAccountsCsv(session.dir);
    // eslint-disable-next-line no-console
    console.log(`csvFile: ${csvFile}`);

    const command = `data import bulk --file ${csvFile} --sobject account --async --json`;

    // about the type assertion at the end:
    // I'm passing `--json` in and `ensureExitCode: 0` so I should always have a JSON result.
    const exportAsyncResult = execCmd<DataImportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput
      ?.result as DataImportBulkResult;

    expect(exportAsyncResult.jobId).not.to.be.undefined;
    expect(exportAsyncResult.jobId).to.be.length(18);

    const importResumeResult = execCmd<DataImportBulkResult>('data import resume --use-most-recent --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result as DataImportBulkResult;

    expect(importResumeResult.jobId).not.to.be.undefined;
    expect(importResumeResult.jobId).to.be.length(18);

    // validate the cache is returning the job ID from the last async import
    expect(importResumeResult.jobId).to.equal(exportAsyncResult.jobId);

    expect(importResumeResult.processedRecords).to.equal(10_000);
    expect(importResumeResult.successfulRecords).to.equal(10_000);
    expect(importResumeResult.failedRecords).to.equal(0);
  });
});

/**
 * Generates a CSV file with 10_000 account records to insert
 *
 * Each `Account.name` field has a unique timestamp for idempotent runs.
 */
async function generateAccountsCsv(savePath: string): Promise<string> {
  const id = Date.now();

  let csv = 'NAME,TYPE,PHONE,WEBSITE' + EOL;

  for (let i = 0; i <= 10_000; i++) {
    csv += `account ${id} #${i},Account,415-555-0000,http://www.accountImport${i}.com${EOL}`;
  }

  const accountsCsv = path.join(savePath, 'bulkImportAccounts1.csv');

  await writeFile(accountsCsv, csv);

  return accountsCsv;
}
