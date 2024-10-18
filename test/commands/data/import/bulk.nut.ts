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
import { generateAccountsCsv } from './resume.nut.js';

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
    ).jsonOutput?.result as DataImportBulkResult;

    expect(result.jobId).not.be.undefined;
    expect(result.jobId.length).to.equal(18);
    expect(result.processedRecords).to.equal(10_000);
    expect(result.successfulRecords).to.equal(10_000);
    expect(result.failedRecords).to.equal(0);
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
