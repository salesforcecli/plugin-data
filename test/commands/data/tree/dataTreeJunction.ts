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
      `data:import:beta:tree --plan ${path.join(
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

    execCmd(`data:export:beta:tree --query "${query}" --outputdir ${path.join('.', 'export_data')} --plan --json`, {
      ensureExitCode: 0,
    });

    // Import data to the default org.
    const importResult = execCmd<ImportResult[]>(
      `data:import:beta:tree --target-org importOrg --plan ${path.join(
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
});
