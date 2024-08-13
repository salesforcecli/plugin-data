/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import fs from 'node:fs';
import { strict as assert } from 'node:assert';
import { config, expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { SearchResult } from '@jsforce/jsforce-node';

config.truncateThreshold = 0;

describe('data:search command', () => {
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
    execCmd('project:deploy:start');

    // Import data to the default org.
    execCmd(`data:import:tree --plan ${path.join('.', 'data', 'accounts-contacts-plan.json')}`);
  });

  after(async () => {
    await testSession?.clean();
  });

  describe('data:search verify query errors', () => {
    it('should error with invalid sosl', () => {
      const result = execCmd('data:search -q "FIND \'Jones\' IN ALL FIELDS"', { ensureExitCode: 1 }).shellOutput.stderr;
      expect(result).to.include('No search term found. The search term must be enclosed in braces.');
    });

    it('should produce correct error when invalid sosl provided', () => {
      const filepath = path.join(testSession.dir, 'sosl.txt');
      fs.writeFileSync(filepath, '"FIND \'Jones\' IN ALL FIELDS"');

      const result = execCmd(`data:search --file ${filepath}`, { ensureExitCode: 1 }).shellOutput.stderr;
      expect(result).to.include('No search term found. The search term must be enclosed in braces.');
    });
  });
  describe('data:search verify human results', () => {
    it('should return account records', () => {
      const result = execCmd(
        'data:search -q "FIND {Sample} IN ALL FIELDS RETURNING Account(Name,Phone), Contact(FirstName,LastName)"'
      ).shellOutput.stdout;
      // two objects with references
      expect(result).to.include('Contact');
      expect(result).to.include('Account');
      // specific account result
      expect(result).to.include('SampleAccount2');
      expect(result).to.include('1234567890');
      expect(result).to.include('Name');
      expect(result).to.include('Phone');
      expect(result).to.include('Sample ');
      expect(result).to.include('Woods');
    });
    it('should not find results correctly', () => {
      const result = execCmd(
        'data:search -q "FIND {Jones} IN ALL FIELDS RETURNING Account(Name,Industry), Contact(FirstName,LastName,Department)"'
      ).shellOutput.stdout;
      expect(result).to.include('No Records Found');
    });
  });
  describe('data:search verify csv results', () => {
    it('should return account records', () => {
      const result = execCmd(
        'data:search -r csv -q "FIND {Sample} IN ALL FIELDS RETURNING Account(Name,Phone), Contact(FirstName,LastName)"'
      ).shellOutput.stdout;
      // two objects with references
      expect(result).to.include('Written to Account.csv');
      expect(result).to.include('Written to Contact.csv');

      const account = fs.readFileSync(path.join(testSession.project.dir, 'Account.csv'), 'utf8');
      expect(account).to.include('Name,Phone');
      expect(account).to.include('SampleAccount2,1234567890');
      expect(account).to.include('SampleAccount,1234567890');

      const contact = fs.readFileSync(path.join(testSession.project.dir, 'Contact.csv'), 'utf8');
      expect(contact).to.include('FirstName,LastName');
      expect(contact).to.include('Sample,Woods');
    });
    it('should not find results correctly', () => {
      const result = execCmd(
        'data:search -r csv -q "FIND {Jones} IN ALL FIELDS RETURNING Account(Name,Industry), Contact(FirstName,LastName,Department)"'
      ).shellOutput.stdout;
      expect(result).to.include('No Records Found');
    });
  });
  describe('data:search verify json results', () => {
    it('should return account/contact records -r json', () => {
      const result = JSON.parse(
        execCmd(
          'data:search -r json -q "FIND {Sample} IN ALL FIELDS RETURNING Account(Name,Phone), Contact(FirstName,LastName)"'
        ).shellOutput.stdout
      ) as SearchResult;
      const account = result.searchRecords.find((f) => f.attributes?.type === 'Account');
      expect(account).to.have.keys('attributes', 'Name', 'Phone');
      const contact = result.searchRecords.find((f) => f.attributes?.type === 'Contact');
      expect(contact).to.have.keys('attributes', 'FirstName', 'LastName');
    });
    it('should not find results correctly -r json', () => {
      const result = execCmd(
        'data:search -r json -q "FIND {Jones} IN ALL FIELDS RETURNING Account(Name,Industry), Contact(FirstName,LastName,Department)"'
      ).shellOutput.stdout;
      expect(JSON.parse(result)).to.deep.equal({
        searchRecords: [],
      });
    });
    it('should return account records --json', () => {
      const result = execCmd<SearchResult>(
        'data:search --json -q "FIND {Sample} IN ALL FIELDS RETURNING Account(Name,Phone), Contact(FirstName,LastName)"'
      ).jsonOutput?.result;
      assert(result);

      const account = result.searchRecords.find((f) => f.attributes?.type === 'Account');
      expect(account).to.have.keys('attributes', 'Name', 'Phone');
      const contact = result.searchRecords.find((f) => f.attributes?.type === 'Contact');
      expect(contact).to.have.keys('attributes', 'FirstName', 'LastName');
    });
    it('should not find results correctly --json', () => {
      const result = execCmd<SearchResult>(
        'data:search --json -q "FIND {Jones} IN ALL FIELDS RETURNING Account(Name,Phone), Contact(FirstName,LastName)"'
      ).jsonOutput?.result;
      assert(result);
      expect(result).to.deep.equal({
        searchRecords: [],
      });
    });
  });
});
