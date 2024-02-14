/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';

describe('data:tree beta commands with a missing reference', () => {
  let testSession: TestSession;

  before(async () => {
    testSession = await TestSession.create({
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
    await testSession?.clean();
  });

  it('import breaks recursion and fails with good error when a ref is missing', () => {
    const failResult = execCmd(
      `data:import:beta:tree --plan ${path.join('.', 'data', 'missingRef', 'Account-Opportunity-plan.json')} --json`,
      {
        ensureExitCode: 1,
      }
    );
    expect(failResult.jsonError?.name).to.equal('UnresolvableRefsError');
  });
});
