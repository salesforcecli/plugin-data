/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EOL } from 'node:os';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { validateCsv } from 'test/testUtil.js';
import { ensureString } from '@salesforce/ts-types';
import { DataImportBulkResult } from '../../../../src/commands/data/import/bulk.js';
import { DataBulkResultsResult } from '../../../../src/commands/data/bulk/results.js';

describe('data bulk results NUTs', () => {
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

  it('should get successful results from a bulk import', async () => {
    const csvFile = await generateAccountsCsv(session.dir);

    // about the type assertion at the end:
    // I'm passing `--json` in and `ensureExitCode: 0` so I should always have a JSON result.
    const bulkImport = execCmd<DataImportBulkResult>(
      `data import bulk --file ${csvFile} --sobject account --wait 10 --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result as DataImportBulkResult;

    expect(bulkImport.jobId).not.to.be.undefined;
    expect(bulkImport.jobId).to.be.length(18);

    const dataBulkResultsRes = execCmd<DataBulkResultsResult>(`data bulk results --job-id ${bulkImport.jobId} --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result as DataBulkResultsResult;

    expect(dataBulkResultsRes.status).to.equal('JobComplete');
    expect(dataBulkResultsRes.operation).to.equal('insert');
    expect(dataBulkResultsRes.object).to.equal('Account');

    await validateCsv(dataBulkResultsRes.successFilePath, 'COMMA', 10_000);
  });

  it('should get success/failure results from a bulk import', async () => {
    const csvFile = await generateAccountsCsv(session.dir, 5000);

    // about the type assertion at the end:
    // I'm passing `--json` in and `ensureExitCode: 0` so I should always have a JSON result.
    const bulkImport = execCmd<DataImportBulkResult>(
      `data import bulk --file ${csvFile} --sobject account --wait 10 --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result as DataImportBulkResult;

    expect(bulkImport.jobId).not.to.be.undefined;
    expect(bulkImport.jobId).to.be.length(18);
    expect(bulkImport.processedRecords).to.equal(10_000);
    expect(bulkImport.successfulRecords).to.equal(5000);
    expect(bulkImport.failedRecords).to.equal(5000);

    const results = execCmd<DataBulkResultsResult>(`data bulk results --job-id ${bulkImport.jobId} --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result as DataBulkResultsResult;

    expect(results.status).to.equal('JobComplete');
    expect(results.operation).to.equal('insert');
    expect(results.object).to.equal('Account');
    expect(results.processedRecords).to.equal(10_000);
    expect(results.successfulRecords).to.equal(5000);
    expect(results.failedRecords).to.equal(5000);

    await validateCsv(results.successFilePath, 'COMMA', 5000);
    await validateCsv(ensureString(results.failedFilePath), 'COMMA', 5000);
  });
});

/**
 * Generates a CSV file with 10_000 account records to insert
 *
 * Each `Account.name` field has a unique timestamp for idempotent runs.
 */
export async function generateAccountsCsv(savePath: string, badRows = 0): Promise<string> {
  const id = Date.now();

  let badRowCounter = badRows;

  let csv = 'NAME,TYPE,PHONE,WEBSITE' + EOL;

  for (let i = 1; i <= 10_000; i++) {
    if (badRows > 0 && badRowCounter !== 5000) {
      csv += `account ${id} #${i},Account,415-555-0000,http://www.accountImport${i}.com${EOL},invalidField`;
      badRowCounter++;
    } else {
      csv += `account ${id} #${i},Account,415-555-0000,http://www.accountImport${i}.com${EOL}`;
    }
  }

  const accountsCsv = path.join(savePath, 'bulkImportAccounts.csv');

  await writeFile(accountsCsv, csv);

  return accountsCsv;
}
