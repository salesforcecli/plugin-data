/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { QueryResult } from 'jsforce';

describe('data:soql:bulk:report command', () => {
  let testSession: TestSession;

  before(async () => {
    testSession = await TestSession.create({
      setupCommands: [
        'sfdx force:org:create -f config/project-scratch-def.json --setdefaultusername --wait 10 --durationdays 1',
        'sfdx force:source:push',
      ],
      project: { sourceDir: path.join('test', 'test-files', 'data-project') },
    });
    // Import data to the default org.
    execCmd(`force:data:tree:import --plan ${path.join('.', 'data', 'accounts-contacts-plan.json')}`, {
      ensureExitCode: 0,
    });
  });

  after(async () => {
    await testSession?.clean();
  });

  describe('data:soql:bulk:report', () => {
    it('should return Lead.owner.name (multi-level relationships)', () => {
      execCmd('force:data:record:create -s Lead -v "Company=Salesforce LastName=Astro"', { ensureExitCode: 0 });
      const profileId = execCmd<QueryResult<{ Id: string }>>(
        'force:data:soql:query -q "SELECT ID FROM Profile WHERE Name=\'System Administrator\'" --json'
      ).jsonOutput?.result.records[0].Id;
      const bulkQueryId = execCmd<{ id: string }>(
        'force:data:soql:query -q "SELECT owner.Profile.Name, owner.Profile.Id, Title, Name FROM lead LIMIT 1" --bulk --json --wait 0',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result?.id;
      const result = execCmd(`force:data:soql:bulk:report -i ${bulkQueryId}`, { ensureExitCode: 0 }).shellOutput.stdout;
      expect(result).to.not.include('[object Object]');
      expect(result).to.include('System Administrator');
      expect(result).to.include('Astro');
      expect(result).to.include(profileId);

      const queryResultCSV = execCmd(`force:data:soql:bulk:report -i ${bulkQueryId} -r csv`, { ensureExitCode: 0 })
        .shellOutput.stdout;
      expect(queryResultCSV).to.not.include('[object Object]');
      expect(queryResultCSV).to.include('System Administrator');
      expect(queryResultCSV).to.include(profileId);
      // Title is null and represented as ,, (empty) in csv
      expect(queryResultCSV).to.include(',,');
    });

    it('should return account records', () => {
      const bulkQueryId = execCmd<{ id: string }>(
        'force:data:soql:query -q "SELECT Id, Name, Phone, Website, NumberOfEmployees, Industry FROM Account WHERE Name LIKE \'SampleAccount%\' limit 1" --bulk --json --wait 0',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result?.id;

      const result = execCmd(`force:data:soql:bulk:report -i ${bulkQueryId}`, { ensureExitCode: 0 }).shellOutput.stdout;
      expect(result).to.match(/ID\s+?NAME\s+?PHONE\s+?WEBSITE\s+?NUMBEROFEMPLOYEES\s+?INDUSTRY/g);
      expect(result).to.match(/Total number of records retrieved: 1\./g);
    });

    it('should display results correctly', () => {
      const bulkQueryId = execCmd<{ id: string }>(
        'force:data:soql:query -q "SELECT id from User" --bulk --json --wait 0',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result?.id;

      const result = execCmd(`force:data:soql:bulk:report -i ${bulkQueryId}`, { ensureExitCode: 0 }).shellOutput.stdout;
      expect(result).to.match(/Total number of records retrieved: \d/g);
      expect(result).to.include('ID');
    });

    it('should print JSON (-r json) output correctly', () => {
      const bulkQueryId = execCmd<{ id: string }>(
        'force:data:soql:query -q "SELECT id, Name FROM User" --bulk --json --wait 0',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result?.id;
      const result = execCmd(`force:data:soql:bulk:report -i ${bulkQueryId} -r json`, { ensureExitCode: 0 }).shellOutput
        .stdout;
      // the Metadata object parsed correctly
      expect(result).to.include('Id');
      expect(result).to.include('Name');
    });
  });
});