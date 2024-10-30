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

describe('data export bulk NUTs', () => {
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

  it('should export records in csv format', async () => {
    const outputFile = 'export-accounts.csv';
    const command = `data export bulk -q "${soqlQuery}" --output-file ${outputFile} --wait 10 --json`;

    const result = execCmd<DataExportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

    expect(result?.totalSize).to.equal(totalAccountRecords);
    expect(result?.filePath).to.equal(outputFile);

    await validateCsv(path.join(session.dir, 'data-project', outputFile), 'COMMA', ensureNumber(result?.totalSize));
  });

  it('should export records in csv format with PIPE delimiter', async () => {
    const outputFile = 'export-accounts.csv';
    const command = `data export bulk -q "${soqlQuery}" --output-file ${outputFile} --wait 10 --column-delimiter PIPE --json`;

    const result = execCmd<DataExportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

    expect(result?.totalSize).to.equal(totalAccountRecords);
    expect(result?.filePath).to.equal(outputFile);

    await validateCsv(path.join(session.dir, 'data-project', outputFile), 'PIPE', ensureNumber(result?.totalSize));
  });

  it('should export records in json format', async () => {
    const outputFile = 'export-accounts.json';
    const command = `data export bulk -q "${soqlQuery}" --output-file ${outputFile} --wait 10 --result-format json --json`;

    const result = execCmd<DataExportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

    expect(result?.totalSize).to.equal(totalAccountRecords);
    expect(result?.filePath).to.equal(outputFile);

    await validateJson(path.join(session.dir, 'data-project', outputFile), ensureNumber(totalAccountRecords));
  });
});
