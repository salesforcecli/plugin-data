/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { QueryResult } from '../dataSoqlQuery.nut.js';

describe('data:tree commands with records that refer to other records of the same type in the same file', () => {
  let testSession: TestSession;

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
          alias: 'importOrg',
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
    // exclude an account that occurs in many scratch orgs
    const query = "SELECT Id, Name, ParentId FROM Account where name != 'Sample Account for Entitlements'";

    // Import data to the default org.
    execCmd(`data:import:tree --plan ${path.join('.', 'data', 'self-referencing', 'Account-plan.json')} --json`, {
      ensureExitCode: 0,
    });

    execCmd(
      `data:export:tree --query "${query}" --prefix INT --output-dir ${path.join('.', 'export_data')} --plan --json`,
      { ensureExitCode: 0 }
    );

    // Import data to the 2nd org org.
    execCmd(
      `data:import:tree --target-org importOrg --plan ${path.join('.', 'export_data', 'INT-Account-plan.json')} --json`,
      {
        ensureExitCode: 0,
      }
    );

    // query the new org for import verification
    const queryResults = execCmd<QueryResult>(`data:query --target-org importOrg --query "${query}" --json`, {
      ensureExitCode: 0,
    }).jsonOutput;

    expect(queryResults?.result.totalSize).to.equal(
      12,
      'Expected 12 Account objects returned by the query to org: importOrg'
    );
  });
});
