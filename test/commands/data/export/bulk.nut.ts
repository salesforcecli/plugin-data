/*
 * Copyright 2026, Salesforce, Inc.
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
  const soqlQueryFields = ['Id', 'Name', 'Phone', 'AnnualRevenue'];

  it('should export records in csv format', async () => {
    const outputFile = 'export-accounts.csv';
    const command = `data export bulk -q "${soqlQuery}" --output-file ${outputFile} --wait 10 --json`;

    const result = execCmd<DataExportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

    expect(result?.totalSize).to.equal(totalAccountRecords);
    expect(result?.filePath).to.equal(outputFile);

    await validateCsv(path.join(session.dir, 'data-project', outputFile), 'COMMA', ensureNumber(result?.totalSize));
  });

  it('should export +1 million records in csv format', async () => {
    const outputFile = 'export-scratch-info.csv';
    const command = `data export bulk -q "select id,ExpirationDate from scratchorginfo" --output-file ${outputFile} --wait 10 --json -o ${session.hubOrg.username}`;

    const result = execCmd<DataExportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

    expect(result?.totalSize).to.be.greaterThan(1_000_000);
    expect(result?.filePath).to.equal(outputFile);

    await validateCsv(path.join(session.dir, 'data-project', outputFile), 'COMMA', ensureNumber(result?.totalSize));
  });

  it('should export +1 million records in json format', async () => {
    const outputFile = 'export-scratch-info.json';
    const command = `data export bulk -q "SELECT Id,ExpirationDate FROM scratchorginfo" --output-file ${outputFile} --wait 10 --json -o ${session.hubOrg.username} --result-format json`;

    const result = execCmd<DataExportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

    expect(result?.totalSize).to.be.greaterThan(1_000_000);
    expect(result?.filePath).to.equal(outputFile);

    await validateJson(
      path.join(session.dir, 'data-project', outputFile),
      ['Id', 'ExpirationDate'],
      ensureNumber(result?.totalSize)
    );
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

    await validateJson(
      path.join(session.dir, 'data-project', outputFile),
      soqlQueryFields,
      ensureNumber(totalAccountRecords)
    );
  });
});
