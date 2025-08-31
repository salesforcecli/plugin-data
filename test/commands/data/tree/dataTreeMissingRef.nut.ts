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
    const failResult = execCmd<ImportResult[]>(
      `data:import:tree --plan ${path.join('.', 'data', 'missingRef', 'Account-Opportunity-plan.json')} --json`,
      {
        ensureExitCode: 'nonZero',
      }
    );
    expect(failResult.jsonOutput?.name).to.equal('UnresolvableRefsError');
    expect(failResult.jsonOutput?.message).to.include('@AccountRef2000'); // includes the missing ref
    expect(failResult.jsonOutput?.message).to.includes('Opportunity.json'); // includes the filename where the ref is
    expect(failResult.jsonOutput?.data).to.have.length(2); // data contains results that have already succeeded in import
  });

  it('import breaks recursion and fails with good error when a ref is missing', () => {
    const failResult = execCmd<ImportResult[]>(
      `data:import:tree --plan ${path.join('.', 'data', 'missingSelfRef', 'Account-plan.json')} --json`,
      {
        ensureExitCode: 'nonZero',
      }
    );
    expect(failResult.jsonOutput?.name).to.equal('UnresolvableRefsError');
    expect(failResult.jsonOutput?.message).to.include('@AccountRef2000'); // includes the missing ref
    expect(failResult.jsonOutput?.message).to.includes('Account.json'); // includes the filename where the ref is
  });
});
