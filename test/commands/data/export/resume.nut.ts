/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { ensureNumber } from '@salesforce/ts-types';
import { validateCsv, validateJson } from '../../../testUtil.js';
import { DataExportBulkResult } from '../../../../src/commands/data/export/bulk.js';
import { DataExportResumeResult } from '../../../../src/commands/data/export/resume.js';

describe('data export resume NUTs', () => {
  let session: TestSession;
  let totalAccountRecords: number | undefined;

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

    execCmd(`data:import:bulk --sobject Account --file ${path.join('data', 'bulkUpsertLarge.csv')} --json --wait 10`, {
      ensureExitCode: 0,
    });

    totalAccountRecords = execCmd<{ totalSize: number }>('data query -q "select count() from account" --json', {
      ensureExitCode: 0,
      cli: 'sf',
    }).jsonOutput?.result.totalSize;
  });

  after(async () => {
    await session?.clean();
  });

  const soqlQuery = 'select id,name,phone, annualrevenue from account';
  const soqlQueryFields = ['Id', 'Name', 'Phone', 'AnnualRevenue'];

  it('should resume export in csv format', async () => {
    const outputFile = 'export-accounts.csv';
    const command = `data export bulk -q "${soqlQuery}" --output-file ${outputFile} --async --json`;

    const exportAsyncResult = execCmd<DataExportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

    expect(exportAsyncResult?.jobId).to.be.length(18);
    expect(exportAsyncResult?.filePath).to.equal(outputFile);

    const exportResumeResult = execCmd<DataExportResumeResult>(
      `data export resume -i ${exportAsyncResult?.jobId} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(exportResumeResult?.totalSize).to.be.equal(totalAccountRecords);
    expect(exportResumeResult?.filePath).to.equal(outputFile);

    await validateCsv(
      path.join(session.dir, 'data-project', outputFile),
      'COMMA',
      ensureNumber(exportResumeResult?.totalSize)
    );
  });

  it('should resume export in json format', async () => {
    const outputFile = 'export-accounts.json';
    const command = `data export bulk -q "${soqlQuery}" --output-file ${outputFile} --async --result-format json --json`;

    const exportAsyncResult = execCmd<DataExportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

    expect(exportAsyncResult?.jobId).to.be.length(18);
    expect(exportAsyncResult?.filePath).to.equal(outputFile);

    const exportResumeResult = execCmd<DataExportResumeResult>(
      `data export resume -i ${exportAsyncResult?.jobId} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(exportResumeResult?.totalSize).to.be.equal(totalAccountRecords);
    expect(exportResumeResult?.filePath).to.equal(outputFile);

    await validateJson(
      path.join(session.dir, 'data-project', outputFile),
      soqlQueryFields,
      ensureNumber(totalAccountRecords)
    );
  });
});
