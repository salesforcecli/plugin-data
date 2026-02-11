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
import { Org } from '@salesforce/core';
import { ensureString } from '@salesforce/ts-types';
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
    ).jsonOutput?.result;

    const conn = (
      await Org.create({
        aliasOrUsername: session.orgs.get('default')?.username,
      })
    ).getConnection();

    const importJob = conn.bulk2.job('ingest', {
      id: ensureString(result?.jobId),
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
    ).jsonOutput?.result;

    expect(dataUpdateResult?.processedRecords).to.equal(10_000);
    expect(dataUpdateResult?.successfulRecords).to.equal(10_000);
    expect(dataUpdateResult?.failedRecords).to.equal(0);
  });
});
