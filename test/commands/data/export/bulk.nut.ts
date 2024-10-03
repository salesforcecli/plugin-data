/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import * as fs from 'node:fs';
import { PassThrough, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { exec as execSync } from 'node:child_process';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Parser as csvParse } from 'csv-parse';
import { DataExportBulkResult } from '../../../../src/commands/data/export/bulk.js';

const exec = promisify(execSync);

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

    // TODO: make this use the new `data import bulk` command when its available
    execCmd(
      `data:upsert:bulk --sobject Account --file ${path.join(
        'data',
        'bulkUpsertLarge.csv'
      )} --external-id Id --json --wait 10`,
      {
        ensureExitCode: 0,
        cli: 'sf',
      }
    );

    totalAccountRecords = execCmd<{ totalSize: number }>("data query -q 'select count() from account' --json", {
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
    const command = `data export bulk -q '${soqlQuery}' --output-file ${outputFile} --wait 10 --json`;

    // about the type assertion at the end:
    // I'm passing `--json` in and `ensureExitCode: 0` so I should always have a JSON result.
    const result = execCmd<DataExportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput
      ?.result as DataExportBulkResult;

    expect(result.totalSize).to.equal(totalAccountRecords);
    expect(result.filePath).to.equal(outputFile);

    await validateCsv(result.filePath, result.totalSize);
  });

  it('should export records in json format', async () => {
    const outputFile = 'export-accounts.json';
    const command = `data export bulk -q '${soqlQuery}' --output-file ${outputFile} --wait 10 --result-format json --json`;

    // about the type assertion at the end:
    // I'm passing `--json` in and `ensureExitCode: 0` so I should always have a JSON result.
    const result = execCmd<DataExportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput
      ?.result as DataExportBulkResult;

    expect(result.totalSize).to.equal(totalAccountRecords);
    expect(result.filePath).to.equal(outputFile);

    const res = await exec(
      `jq 'map(has("Id") and has("Name") and has("Phone") and has("AnnualRevenue")) | all' ${path.join(
        session.dir,
        'data-project',
        outputFile
      )}`
    );
    expect(res.stdout.trim()).equal('true');
  });
});

/**
 * Validate that a CSV file has X records
 */
async function validateCsv(filePath: string, totalQty: number): Promise<void> {
  const csvReadStream = fs.createReadStream(filePath);
  let recordCount = 0;

  await pipeline(
    csvReadStream,
    new csvParse({ columns: true }),
    new PassThrough({
      objectMode: true,
      transform(_chunk, _encoding, callback) {
        recordCount++;
        callback(null, null);
      },
    }),
    // dummy writable
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    })
  );

  expect(totalQty).to.equal(recordCount);
}
