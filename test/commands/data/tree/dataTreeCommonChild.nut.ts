/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { ImportResult } from '../../../../src/api/data/tree/importTypes.js';
import { QueryResult } from '../dataSoqlQuery.nut.js';

describe('data:tree commands with a polymorphic whatId (on tasks) shared between multiple parents', () => {
  let testSession: TestSession;
  const importAlias = 'commonChild';
  const prefix = 'CC';

  before(async () => {
    testSession = await TestSession.create({
      scratchOrgs: [
        {
          config: 'config/project-scratch-def.json',
          setDefault: true,
        },
        {
          config: 'config/project-scratch-def.json',
          setDefault: false,
          alias: importAlias,
        },
      ],
      project: { sourceDir: path.join('test', 'test-files', 'data-project') },
      devhubAuthStrategy: 'AUTO',
    });
  });

  after(async () => {
    await testSession?.clean();
  });

  it('import -> export -> import round trip should succeed', () => {
    const query =
      "SELECT Id, Name, (SELECT Id, Name, StageName, CloseDate, (SELECT Id, Subject FROM Tasks) FROM Opportunities), (SELECT Id, Subject, Status, (SELECT Id, Subject FROM Tasks) FROM Cases) FROM Account where name != 'Sample Account for Entitlements'";

    // Import data to the default org.
    execCmd<ImportResult[]>(
      `data:import:tree --plan ${path.join(
        '.',
        'data',
        'commonChild',
        'Account-Opportunity-Task-Case-plan.json'
      )} --json`,
      {
        ensureExitCode: 0,
      }
    );

    execCmd(
      `data:export:tree --query "${query}" --prefix ${prefix} --outputdir ${path.join(
        '.',
        'export_data'
      )} --plan --json`,
      { ensureExitCode: 0 }
    );

    // Import data to the 2nd org org.
    execCmd(
      `data:import:tree --target-org ${importAlias} --plan ${path.join(
        '.',
        'export_data',
        `${prefix}-Account-Opportunity-Task-Case-plan.json`
      )} --json`,
      {
        ensureExitCode: 0,
      }
    );

    // query the new org for import verification
    const queryResults = execCmd<QueryResult>(`data:query --target-org ${importAlias} --query "${query}" --json`, {
      ensureExitCode: 0,
    }).jsonOutput;

    expect(queryResults?.result.totalSize).to.equal(
      2,
      `Expected 2 Account objects returned by the query to org: ${importAlias}`
    );
  });
});
