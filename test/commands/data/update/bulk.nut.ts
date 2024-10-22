/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Org } from '@salesforce/core';
import { generateUpdatedCsv, generateAccountsCsv } from '../../../testUtil.js';
import { DataUpdateBulkResult } from '../../../../src/commands/data/update/bulk.js';
import { DataImportBulkResult } from '../../../../src/commands/data/import/bulk.js';

describe('data update bulk NUTs', () => {
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

  it('should bulk update account records', async () => {
    const csvFile = await generateAccountsCsv(session.dir);

    const result = execCmd<DataImportBulkResult>(
      `data import bulk --file ${csvFile} --sobject Account --wait 10 --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result as DataImportBulkResult;

    // TODO: set org username above like here:
    // https://github.com/salesforcecli/cli-plugins-testkit/blob/main/SAMPLES.md#testing-with-multiple-scratch-orgs
    const username = [...session.orgs.keys()][0];

    const conn = (
      await Org.create({
        aliasOrUsername: username,
      })
    ).getConnection();

    const importJob = conn.bulk2.job('ingest', {
      id: result.jobId,
    });

    const successfulIds = (await importJob.getSuccessfulResults()).map((r) => r.sf__Id);

    const updatedCsv = await generateUpdatedCsv(
      csvFile,
      successfulIds,
      path.join(session.dir, 'data-project', 'updated.csv')
    );

    const dataUpdateResult = execCmd<DataUpdateBulkResult>(
      `data update bulk --file ${updatedCsv} --sobject account --wait 10 --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result as DataUpdateBulkResult;

    expect(dataUpdateResult.processedRecords).to.equal(10_000);
    expect(dataUpdateResult.successfulRecords).to.equal(10_000);
    expect(dataUpdateResult.failedRecords).to.equal(0);
  });
});
