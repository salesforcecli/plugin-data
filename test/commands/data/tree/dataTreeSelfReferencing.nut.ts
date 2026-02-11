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
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { QueryResult } from '../query/query.nut.js';

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
