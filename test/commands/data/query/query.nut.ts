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
import fs from 'node:fs';
import { strict as assert } from 'node:assert';
import { Dictionary, getString } from '@salesforce/ts-types';
import { config, expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { validateCsv } from '../../../testUtil.js';
import { DataQueryResult } from '../../../../src/commands/data/query.js';

config.truncateThreshold = 0;

export type QueryResult = {
  totalSize: number;
  done: boolean;
  records: Dictionary[];
};

type QueryOptions = {
  json?: boolean;
  ensureExitCode?: number;
  toolingApi?: boolean;
};

function verifyRecordFields(accountRecord: Dictionary, fields: string[]) {
  expect(accountRecord).to.have.all.keys(...fields);
}

function runQuery(
  query: string,
  options: QueryOptions = {
    json: true,
    ensureExitCode: 0,
    toolingApi: false,
  }
) {
  const queryCmd = `data:query --query "${query}" ${options.toolingApi ? '-t' : ''} ${
    options.json ? '--json' : ''
  }`.trim();

  const results = execCmd<QueryResult>(queryCmd, {
    ensureExitCode: options.ensureExitCode,
  });

  if (options.json) {
    assert(results.jsonOutput?.result, 'missing query data');
    const queryResult: QueryResult = results.jsonOutput.result;
    expect(queryResult).to.have.property('totalSize').to.be.greaterThan(0);
    expect(queryResult).to.have.property('done', true);
    expect(queryResult).to.have.property('records').to.not.have.lengthOf(0);
    return queryResult;
  } else {
    return options.ensureExitCode === 0
      ? getString(results, 'shellOutput.stdout')
      : getString(results, 'shellOutput.stderr');
  }
}

describe('data:query command', () => {
  let testSession: TestSession;
  let hubOrgUsername: string | undefined;

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
    // get default devhub username
    hubOrgUsername = testSession.hubOrg.username;
    if (!hubOrgUsername) {
      throw new Error('No default devhub username found');
    }
    execCmd('project:deploy:start', {
      ensureExitCode: 0,
      cli: 'sf',
    });

    // Import data to the default org.
    execCmd(`data:import:tree --plan ${path.join('.', 'data', 'accounts-contacts-plan.json')}`, {
      ensureExitCode: 0,
    });
  });

  after(async () => {
    await testSession?.clean();
  });

  describe('data:query respects maxQueryLimit config', () => {
    it('should return 1 account record', () => {
      // set maxQueryLimit to 1 globally
      execCmd('config:set maxQueryLimit=1 --global', { ensureExitCode: 0, cli: 'sf' });

      const result = runQuery('SELECT Id, Name, Phone FROM Account', { json: true }) as QueryResult;

      expect(result.records.length).to.equal(1);
      verifyRecordFields(result?.records[0], ['Id', 'Name', 'Phone', 'attributes']);
    });

    it('should return 3756 ScratchOrgInfo records', () => {
      // set maxQueryLimit to 3756 globally
      execCmd('config:set maxQueryLimit=3756 --global', { ensureExitCode: 0, cli: 'sf' });

      const soqlQuery = 'SELECT Id FROM ScratchOrgInfo';
      const queryCmd = `data:query --query "${soqlQuery}" --json --target-org ${hubOrgUsername}`;
      const results = execCmd<QueryResult>(queryCmd, { ensureExitCode: 0 });

      const queryResult: QueryResult = results.jsonOutput?.result ?? { done: false, records: [], totalSize: 0 };
      expect(queryResult).to.have.property('totalSize').to.be.greaterThan(0);
      expect(queryResult).to.have.property('done', false);
      expect(queryResult.records.length).to.equal(3756);
      verifyRecordFields(queryResult?.records[0], ['Id', 'attributes']);
    });
  });

  describe('data:query verify query errors', () => {
    it('should error with invalid soql', () => {
      const result = runQuery('SELECT', { ensureExitCode: 1, json: false }) as string;
      const stdError = result?.toLowerCase();
      expect(stdError).to.include('unexpected token');
    });

    it('should produce correct error when invalid soql provided', () => {
      const filepath = path.join(testSession.dir, 'soql.txt');
      fs.writeFileSync(filepath, 'SELECT');

      const result = execCmd(`data:query --file ${filepath}`, { ensureExitCode: 1 }).shellOutput.stderr;
      const stdError = result?.toLowerCase();
      expect(stdError).to.include('unexpected token');
    });

    it('should error with no such column', () => {
      // querying ApexClass including SymbolTable column w/o using tooling api will cause "no such column" error
      const result = runQuery('SELECT Id, Name, SymbolTable from ApexClass', {
        ensureExitCode: 1,
        json: false,
      }) as string;
      expect(result?.toLowerCase()).to.include("No such column 'SymbolTable' on entity 'ApexClass'".toLowerCase());
    });
  });
  describe('data:query verify json results', () => {
    it('should return account records', () => {
      const query =
        "SELECT Id, Name, Phone, Website, NumberOfEmployees, Industry FROM Account WHERE Name LIKE 'SampleAccount%'";

      const queryResult = runQuery(query, { ensureExitCode: 0, json: true }) as QueryResult;

      verifyRecordFields(queryResult?.records[0], [
        'Id',
        'Name',
        'Phone',
        'Website',
        'NumberOfEmployees',
        'Industry',
        'attributes',
      ]);
    });
    it('should return account records with nested contacts', () => {
      const query =
        "SELECT Id, Name, Phone, Website, NumberOfEmployees, Industry, (SELECT Lastname, Title, Email FROM Contacts) FROM Account  WHERE Name LIKE 'SampleAccount%'";

      const queryResult = runQuery(query, { ensureExitCode: 0, json: true }) as QueryResult;

      verifyRecordFields(queryResult?.records[0], [
        'Id',
        'Name',
        'Phone',
        'Website',
        'NumberOfEmployees',
        'Industry',
        'Contacts',
        'attributes',
      ]);

      const contacts = (queryResult?.records[0].Contacts ?? { done: false, records: [], totalSize: 0 }) as QueryResult;
      verifyRecordFields(contacts.records[0], ['LastName', 'Title', 'Email', 'attributes']);
    });
  });

  describe('data:query verify human results', () => {
    it('should return Lead.owner.name (multi-level relationships)', () => {
      execCmd('data:create:record -s Lead -v "Company=Salesforce LastName=Astro"', { ensureExitCode: 0 });

      const profileId = (runQuery("SELECT ID FROM Profile WHERE Name='System Administrator'") as QueryResult).records[0]
        .Id;
      const query = 'SELECT owner.Profile.Name, owner.Profile.Id, Title, Name FROM lead LIMIT 1';

      const queryResult = runQuery(query, { ensureExitCode: 0 });
      expect(queryResult).to.not.include('[object Object]');
      expect(queryResult).to.include('System Administrator');
      expect(queryResult).to.include(profileId);

      const queryResultCSV = runQuery(query + '" --result-format "csv', { ensureExitCode: 0 });
      expect(queryResultCSV).to.not.include('[object Object]');
      expect(queryResultCSV).to.include('System Administrator');
      expect(queryResultCSV).to.include(profileId);
      // Title is null and represented as ,, (empty) in csv
      expect(queryResultCSV).to.include(',,');
    });

    it('should return account records', () => {
      const query =
        "SELECT Id, Name, Phone, Website, NumberOfEmployees, Industry FROM Account WHERE Name LIKE 'SampleAccount%' limit 1";

      const queryResult = runQuery(query, { ensureExitCode: 0, json: false }) as string;

      expect(queryResult).to.match(/ID.*?NAME.*?PHONE.*?WEBSITE.*?NUMBEROFEMPLOYEES.*?INDUSTRY/g);
      expect(queryResult).to.match(/Total number of records retrieved: 1\./g);
    });

    it('should return account records, from --file', () => {
      const query =
        "SELECT Id, Name, Phone, Website, NumberOfEmployees, Industry FROM Account WHERE Name LIKE 'SampleAccount%' limit 1";
      const filepath = path.join(testSession.dir, 'soql.txt');
      fs.writeFileSync(filepath, query);

      const queryResult = execCmd(`data:query --file ${filepath}`, { ensureExitCode: 0 }).shellOutput.stdout;

      expect(queryResult).to.match(/ID.*?NAME.*?PHONE.*?WEBSITE.*?NUMBEROFEMPLOYEES.*?INDUSTRY/g);
      expect(queryResult).to.match(/Total number of records retrieved: 1\./g);
    });

    it('should return account records with nested contacts', () => {
      const query =
        "SELECT Id, Name, Phone, Website, NumberOfEmployees, Industry, (SELECT Lastname, Title, Email FROM Contacts) FROM Account  WHERE Name LIKE 'SampleAccount%'";

      const queryResult = runQuery(query, { ensureExitCode: 0, json: false }) as string;

      expect(queryResult).to.match(
        /ID.*?NAME.*?PHONE.*?WEBSITE.*?NUMBEROFEMPLOYEES.*?INDUSTRY.*?CONTACTS.LASTNAME.*?CONTACTS.TITLE.*?CONTACTS.EMAIL/g
      );
      expect(queryResult).to.match(/\sSmith/g);
      expect(queryResult).to.match(/Total number of records retrieved: 2\./g);
    });
    it('should handle count()', () => {
      const queryResult = execCmd('data:query -q "SELECT Count() from User"', {
        ensureExitCode: 0,
      }).shellOutput as string;
      expect(queryResult).to.match(/Total number of records retrieved: [1-9]\d*\./g);
    });

    it('should return successfully when querying ApexClass column SymbolTable using tooling API', () => {
      runQuery('SELECT Id, Name, SymbolTable from ApexClass', {
        ensureExitCode: 0,
        json: false,
        toolingApi: true,
      });
    });

    it('should print JSON output correctly', () => {
      const result = runQuery('select id, isActive, Metadata from RemoteProxy', {
        ensureExitCode: 0,
        json: true,
        toolingApi: true,
      });

      expect(result).to.be.ok;
      expect(result).to.be.an('object');

      // the Metadata object parsed correctly
      // @ts-expect-error typescript doesn't know the shape of the Metadata object
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const metadataObject = result?.records[0].Metadata;
      expect(metadataObject).to.have.property('disableProtocolSecurity');
      expect(metadataObject).to.have.property('isActive');
      expect(metadataObject).to.have.property('url');
      expect(metadataObject).to.have.property('urls');
      expect(metadataObject).to.have.property('description');
    });
  });
  describe('data:query --output-file', () => {
    it('should output JSON to file', async () => {
      const queryResult = execCmd<DataQueryResult>(
        'data:query -q "SELECT Id,Name from Account LIMIT 3" --output-file accounts.json --result-format json --json',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput;

      expect(queryResult?.result.outputFile).equals('accounts.json');
      const file = JSON.parse(
        await fs.promises.readFile(path.join(testSession.project.dir, 'accounts.json'), 'utf8')
      ) as DataQueryResult;

      const { outputFile, ...result } = queryResult?.result as DataQueryResult;

      expect(file).to.deep.equal(result);
    });

    it('should output CSV to file', async () => {
      const queryResult = execCmd(
        'data:query -q "SELECT Id,Name from Account LIMIT 3" --output-file accounts.csv --result-format csv',
        {
          ensureExitCode: 0,
        }
      );

      expect(queryResult.shellOutput.stdout).includes('3 records written to accounts.csv');
      await validateCsv(path.join(testSession.project.dir, 'accounts.csv'), 'COMMA', 3);
    });
  });
});
