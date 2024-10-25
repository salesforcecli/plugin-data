/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { DataImportBulkResult } from '../../../../src/commands/data/import/bulk.js';
import { generateAccountsCsv, validateCacheFile } from '../../../testUtil.js';

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

  it('should resume bulk import via --job-id', async () => {
    const csvFile = await generateAccountsCsv(session.dir);

    // about the type assertion at the end:
    // I'm passing `--json` in and `ensureExitCode: 0` so I should always have a JSON result.
    const importAsyncRes = execCmd<DataImportBulkResult>(
      `data import bulk --file ${csvFile} --sobject account --async --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result as DataImportBulkResult;

    expect(importAsyncRes.jobId).not.to.be.undefined;
    expect(importAsyncRes.jobId).to.be.length(18);

    await validateCacheFile(path.join(session.homeDir, '.sf', 'bulk-data-import-cache.json'), importAsyncRes.jobId);

    const importResumeResult = execCmd<DataImportBulkResult>(`data import resume -i ${importAsyncRes.jobId} --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result as DataImportBulkResult;

    expect(importResumeResult.processedRecords).to.equal(10_000);
    expect(importResumeResult.successfulRecords).to.equal(10_000);
    expect(importResumeResult.failedRecords).to.equal(0);
  });

  it('should resume bulk import via--use-most-recent', async () => {
    const csvFile = await generateAccountsCsv(session.dir);

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
