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
import { Dictionary, get, getString } from '@salesforce/ts-types';
import { QueryResult } from '../query/query.nut.js';

describe('data:tree beta commands with more than 2 levels', () => {
  const prefix = 'DEEP';
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

  it('should error with invalid soql', () => {
    const result = execCmd(
      `data:export:tree --query 'SELECT' --prefix ${prefix} --output-dir ${path.join('.', 'export_data')}`
    );
    const stdError = getString(result, 'shellOutput.stderr', '').toLowerCase();
    const errorKeywords = ['malformed', 'check the soql', 'invalid soql query'];
    expect(errorKeywords.some((keyWord) => stdError.includes(keyWord))).to.be.true;
  });

  it('import -> export -> import round trip should succeed', () => {
    const query =
      "SELECT Id, Name, Phone, Website, NumberOfEmployees, Industry, (SELECT Lastname, Title, Email FROM Contacts) FROM Account  WHERE Name LIKE 'SampleAccount%'";

    // Import data to the default org.
    execCmd(`data:import:tree --plan ${path.join('.', 'data', 'deep', 'accounts-contacts-plan.json')} --json`, {
      ensureExitCode: 0,
    });

    execCmd(
      `data:export:tree --query "${query}" --prefix ${prefix} --output-dir ${path.join(
        '.',
        'export_data'
      )} --plan --json`,
      { ensureExitCode: 0 }
    );

    // Import data to the default org.
    execCmd(
      `data:import:tree --target-org importOrg --plan ${path.join(
        '.',
        'export_data',
        `${prefix}-Account-Contact-plan.json`
      )} --json`,
      {
        ensureExitCode: 0,
      }
    );

    // query the new org for import verification
    const queryResults = execCmd<QueryResult>(`data:query --target-org importOrg --query "${query}" --json`, {
      ensureExitCode: 0,
    }).jsonOutput;

    expect(queryResults?.result.totalSize).to.equal(
      2,
      'Expected 2 Account objects returned by the query to org: importOrg'
    );

    const records = queryResults?.result.records ?? [];
    const sampleAccountRecord = records.find((account) => account.Name === 'SampleAccount');
    const sampleAccount2Record = records.find((account) => account.Name === 'SampleAccount2');

    // verify data is imported
    expect(sampleAccountRecord).to.have.property('Phone', '1234567890');
    expect(sampleAccountRecord).to.have.property('Website', 'www.salesforce.com');
    expect(sampleAccountRecord).to.have.property('NumberOfEmployees', 100);
    expect(sampleAccountRecord).to.have.property('Industry', 'Banking');
    expect(sampleAccountRecord?.Contacts).to.have.property('totalSize', 3);

    expect(sampleAccount2Record).to.have.property('Phone', '1234567890');
    expect(sampleAccount2Record).to.have.property('Website', 'www.salesforce2.com');
    expect(sampleAccount2Record).to.have.property('NumberOfEmployees', 100);
    expect(sampleAccount2Record).to.have.property('Industry', 'Banking');
    const contactRecords = get(sampleAccount2Record, 'Contacts.records') as Dictionary[];
    expect(contactRecords[0]).to.have.property('LastName', 'Woods');
  });
});
