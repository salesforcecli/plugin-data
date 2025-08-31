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
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { ImportResult } from '../../../../src/api/data/tree/importTypes.js';
import { ExportTreeResult } from '../../../../src/commands/data/export/tree.js';

describe('data:tree commands', () => {
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

  it('new tree can import junction objects', () => {
    const importResult = execCmd<ImportResult[]>(
      `data:import:tree --plan ${path.join(
        'data',
        'junction',
        'Account-AccountContactRelation-Contact-plan.json'
      )} --json`,
      { ensureExitCode: 0 }
    );
    expect(importResult.jsonOutput?.result.length).to.equal(12);
  });

  it('import -> export -> import round trip should succeed', () => {
    const query =
      "select Id, Name, (Select Id, FirstName, LastName, (select AccountId, ContactId from AccountContactRoles) from Contacts), (select Id, ContactId, AccountId from AccountContactRelations where Account.Name != 'We Know Everybody') from Account where Name != 'Sample Account for Entitlements'";

    execCmd(`data:export:tree --query "${query}" --output-dir ${path.join('.', 'export_data')} --plan --json`, {
      ensureExitCode: 0,
    });

    // Import data to the default org.
    const importResult = execCmd<ImportResult[]>(
      `data:import:tree --target-org importOrg --plan ${path.join(
        '.',
        'export_data',
        'Account-AccountContactRelation-Contact-plan.json'
      )} --json`,
      {
        ensureExitCode: 0,
      }
    );
    expect(importResult.jsonOutput?.result.length).to.equal(12);
  });

  it('can export -> import junction with multiple queries', async () => {
    const exportResult = execCmd<ExportTreeResult>(
      `data:export:tree --plan --output-dir ${path.join(
        '.',
        'junction'
      )} --query "select AccountId, ContactId from AccountContactRole" --query "Select Id, AccountId, FirstName, LastName from Contact" --query "select Id, ContactId, AccountId from AccountContactRelation where Account.Name != 'We Know Everybody'" --query "select ID, Name from Account where Name != 'Sample Account for Entitlements'"`
    );

    expect(exportResult.shellOutput.stdout).to.include(
      `records to ${path.join('.', 'junction', 'AccountContactRelation.json')}`
    );
    expect(exportResult.shellOutput.stdout).to.include(`records to ${path.join('junction', 'Account.json')}`);
    expect(exportResult.shellOutput.stdout).to.include(`records to ${path.join('junction', 'Contact.json')}`);

    execCmd<ImportResult[]>(
      `data:import:tree --target-org importOrg --plan ${path.join('.', 'junction', 'plan.json')}`,
      { ensureExitCode: 0 }
    );
  });
});
