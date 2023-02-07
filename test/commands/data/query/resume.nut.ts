/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { expect, config } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { QueryResult, Record } from 'jsforce';
import { sleep } from '@salesforce/kit';
import { JobInfoV2 } from 'jsforce/api/bulk';
config.truncateThreshold = 0;

/** Verify that the operation completed successfully and results are available before attempting to do stuff with the results */
const isCompleted = async (cmd: string): Promise<void> => {
  let complete = false;
  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(2000);
    const result = execCmd<QueryResult<Record> | JobInfoV2>(cmd);
    if (result.jsonOutput?.status === 0) {
      if ('state' in result.jsonOutput.result && result.jsonOutput.result.state === 'JobComplete') {
        complete = true;
      } else if ('done' in result.jsonOutput.result && result.jsonOutput.result.done) {
        complete = true;
      }
    }
  }
};

describe('data:query:resume command', () => {
  let testSession: TestSession;

  before(async () => {
    testSession = await TestSession.create({
      scratchOrgs: [
        {
          executable: 'sfdx',
          config: 'config/project-scratch-def.json',
          setDefault: true,
        },
      ],
      project: { sourceDir: path.join('test', 'test-files', 'data-project') },
      devhubAuthStrategy: 'AUTO',
    });
    execCmd('force:source:push', {
      ensureExitCode: 0,
      cli: 'sfdx',
    });

    // Import data to the default org.
    execCmd(`data:import:tree --plan ${path.join('.', 'data', 'accounts-contacts-plan.json')}`, {
      ensureExitCode: 0,
    });
  });

  after(async () => {
    await testSession?.clean();
  });

  describe('data:query:resume', () => {
    it('should return Lead.owner.name (multi-level relationships)', async () => {
      execCmd('data:create:record -s Lead -v "Company=Salesforce LastName=Astro"', { ensureExitCode: 0 });
      const profileId = execCmd<QueryResult<{ Id: string }>>(
        'data:query -q "SELECT ID FROM Profile WHERE Name=\'System Administrator\'" --json'
      ).jsonOutput?.result.records[0].Id;
      const bulkQueryId = execCmd<{ id: string }>(
        'data:query -q "SELECT owner.Profile.Name, owner.Profile.Id, Title, Name FROM lead LIMIT 1" --bulk --json --wait 0',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result?.id;

      await isCompleted(`data:query:resume -i ${bulkQueryId} --json`);

      const result = execCmd(`data:query:resume -i ${bulkQueryId}`, { ensureExitCode: 0 }).shellOutput.stdout;
      expect(result).to.not.include('[object Object]');
      expect(result).to.include('System Administrator');
      expect(result).to.include('Astro');
      expect(result).to.include(profileId);

      const queryResultCSV = execCmd(`data:query:resume -i ${bulkQueryId} -r csv`, { ensureExitCode: 0 }).shellOutput
        .stdout;
      expect(queryResultCSV).to.not.include('[object Object]');
      expect(queryResultCSV).to.include('System Administrator');
      expect(queryResultCSV).to.include(profileId);
      // Title is null and represented as ,, (empty) in csv
      expect(queryResultCSV).to.include(',,');
    });

    it('should return account records', async () => {
      const bulkQueryId = execCmd<{ id: string }>(
        'data:query -q "SELECT Id, Name, Phone, Website, NumberOfEmployees, Industry FROM Account WHERE Name LIKE \'SampleAccount%\' limit 1" --bulk --json --wait 0',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result?.id;
      await isCompleted(`data:query:resume -i ${bulkQueryId} --json`);

      const result = execCmd(`data:query:resume -i ${bulkQueryId}`, { ensureExitCode: 0 }).shellOutput.stdout;
      expect(result).to.match(/ID\s+?NAME\s+?PHONE\s+?WEBSITE\s+?NUMBEROFEMPLOYEES\s+?INDUSTRY/g);
      expect(result).to.match(/Total number of records retrieved: 1\./g);
    });

    it('should display results correctly', async () => {
      const bulkQueryId = execCmd<{ id: string }>('data:query -q "SELECT id from User" --bulk --json --wait 0', {
        ensureExitCode: 0,
      }).jsonOutput?.result?.id;
      await isCompleted(`data:query:resume -i ${bulkQueryId} --json`);

      const result = execCmd(`data:query:resume -i ${bulkQueryId}`, { ensureExitCode: 0 }).shellOutput.stdout;
      expect(result).to.match(/Total number of records retrieved: \d/g);
      expect(result).to.include('ID');
    });

    it('should print JSON (-r json) output correctly', async () => {
      const bulkQueryId = execCmd<{ id: string }>('data:query -q "SELECT id, Name FROM User" --bulk --json --wait 0', {
        ensureExitCode: 0,
      }).jsonOutput?.result?.id;

      await isCompleted(`data:query:resume -i ${bulkQueryId} --json`);

      const result = execCmd(`data:query:resume -i ${bulkQueryId} -r json`, { ensureExitCode: 0 }).shellOutput.stdout;
      // the Metadata object parsed correctly
      expect(result).to.include('Id');
      expect(result).to.include('Name');
    });
  });
});
