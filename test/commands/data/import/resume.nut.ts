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
import { ensureString } from '@salesforce/ts-types';
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

    const importAsyncRes = execCmd<DataImportBulkResult>(
      `data import bulk --file ${csvFile} --sobject account --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(importAsyncRes?.jobId).not.to.be.undefined;
    expect(importAsyncRes?.jobId).to.be.length(18);

    await validateCacheFile(
      path.join(session.homeDir, '.sf', 'bulk-data-import-cache.json'),
      ensureString(importAsyncRes?.jobId)
    );

    const importResumeResult = execCmd<DataImportBulkResult>(`data import resume -i ${importAsyncRes?.jobId} --json`, {
      ensureExitCode: 0,
    }).jsonOutput?.result;

    expect(importResumeResult?.processedRecords).to.equal(10_000);
    expect(importResumeResult?.successfulRecords).to.equal(10_000);
    expect(importResumeResult?.failedRecords).to.equal(0);
  });

  it('should resume bulk import via--use-most-recent', async () => {
    const csvFile = await generateAccountsCsv(session.dir);

    const command = `data import bulk --file ${csvFile} --sobject account --json`;

    const exportAsyncResult = execCmd<DataImportBulkResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

    expect(exportAsyncResult?.jobId).not.to.be.undefined;
    expect(exportAsyncResult?.jobId).to.be.length(18);

    const importResumeResult = execCmd<DataImportBulkResult>('data import resume --use-most-recent --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result;

    expect(importResumeResult?.jobId).not.to.be.undefined;
    expect(importResumeResult?.jobId).to.be.length(18);

    // validate the cache is returning the job ID from the last async import
    expect(importResumeResult?.jobId).to.equal(exportAsyncResult?.jobId);

    expect(importResumeResult?.processedRecords).to.equal(10_000);
    expect(importResumeResult?.successfulRecords).to.equal(10_000);
    expect(importResumeResult?.failedRecords).to.equal(0);
  });
});
