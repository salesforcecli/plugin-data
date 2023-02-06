/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { strict as assert } from 'node:assert/strict';
import { expect } from 'chai';
import { execCmd, genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { Dictionary } from '@salesforce/ts-types';
import { SaveResult } from 'jsforce';

interface AccountRecord {
  Id: string;
  Name: string;
  Phone: string;
}

interface ApexClassRecord {
  Id: string;
  Name: string;
  Body: string;
  SymbolTable: Dictionary;
}

const validateAccount = (output: string, recordId: string, accountName: string, phoneNumber: string): void => {
  assert.match(output, new RegExp(`Id:.*?${recordId}`, 'g'), 'Id should be present in output');
  assert.match(output, new RegExp(`Name:.*?${accountName}`, 'g'), 'Name should be present in output');
  assert.match(output, new RegExp(`Phone:.*?${phoneNumber}`, 'g'), 'Phone should be present in output');
};

describe('data:record commands', () => {
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
    execCmd('force:user:permset:assign -n TestPerm', {
      ensureExitCode: 0,
      cli: 'sfdx',
    });
  });

  after(async () => {
    await testSession?.clean();
  });

  describe('verify json results', () => {
    describe('should create, get, update, and delete a data record', () => {
      const uniqueString = genUniqueString();
      const accountNameBefore = `MyIntTest${uniqueString}`;
      const accountNameAfter = `MyIntTestUpdated${uniqueString}`;
      const phoneNumber = '1231231234';
      const updatedPhoneNumber = '0987654321';
      let createdRecordId: string;

      it('creates a record', () => {
        const createRecordResponse = execCmd<SaveResult>(
          `data:create:record --sobject Account --values "name=${accountNameBefore} phone=${phoneNumber}" --json`,
          { ensureExitCode: 0 }
        ).jsonOutput;
        assert(createRecordResponse?.result?.id);
        expect(createRecordResponse?.result).to.have.property('success', true);
        createdRecordId = createRecordResponse?.result?.id;
      });
      it('get the created record by ID', () => {
        const getRecordResponse = execCmd<AccountRecord>(
          `data:get:record --sobject Account --record-id ${createdRecordId} --json`,
          { ensureExitCode: 0 }
        ).jsonOutput;
        expect(getRecordResponse?.result).to.have.property('Id', createdRecordId);
        expect(getRecordResponse?.result).to.have.property('Name', accountNameBefore);
        expect(getRecordResponse?.result).to.have.property('Phone', phoneNumber);
      });

      it('get the created record by where', () => {
        const getRecordResponse = execCmd<AccountRecord>(
          `data:get:record --sobject Account --where "Name='${accountNameBefore}' Phone='${phoneNumber}'" --json`,
          { ensureExitCode: 0 }
        ).jsonOutput;
        expect(getRecordResponse?.result).to.have.property('Id', createdRecordId);
        expect(getRecordResponse?.result).to.have.property('Name', accountNameBefore);
        expect(getRecordResponse?.result).to.have.property('Phone', phoneNumber);
      });

      it('updates the record by Id', () => {
        execCmd<SaveResult>(
          `data:update:record --record-id ${createdRecordId} --sobject Account --values "name=${accountNameAfter} phone=${updatedPhoneNumber}" --json`,
          { ensureExitCode: 0 }
        );
      });

      it('gets the updated record by ID', () => {
        const getRecordResponse = execCmd<AccountRecord>(
          `data:get:record --sobject Account --record-id ${createdRecordId} --json --perflog`,
          { ensureExitCode: 0 }
        ).jsonOutput;
        expect(getRecordResponse?.result).to.have.property('Id', createdRecordId);
        expect(getRecordResponse?.result).to.have.property('Name', accountNameAfter);
        expect(getRecordResponse?.result).to.have.property('Phone', updatedPhoneNumber);
      });

      it('gets the updated record by where', () => {
        execCmd<SaveResult>(
          `data:update:record --where "Name='${accountNameAfter}'" --sobject Account --values "name='${accountNameBefore}'" --json`,
          { ensureExitCode: 0 }
        );
      });

      it('gets the updated record ', () => {
        const getRecordResponse = execCmd<AccountRecord>(
          `data:get:record --sobject Account --record-id ${createdRecordId} --json `,
          { ensureExitCode: 0 }
        ).jsonOutput;
        expect(getRecordResponse?.result).to.have.property('Id', createdRecordId);
        expect(getRecordResponse?.result).to.have.property('Name', accountNameBefore);
        expect(getRecordResponse?.result).to.have.property('Phone', updatedPhoneNumber);
      });

      it('deletes the record ', () => {
        const deleteRecordResponse = execCmd<SaveResult>(
          `data:delete:record --sobject Account --record-id ${createdRecordId} --json`,
          { ensureExitCode: 0 }
        ).jsonOutput;
        expect(deleteRecordResponse?.result).to.have.property('id', createdRecordId);
        expect(deleteRecordResponse?.result).to.have.property('success', true);
      });

      it('creates a new record with the original name', () => {
        const createRecordResponse = execCmd<SaveResult>(
          `data:create:record --sobject Account --values "name=${accountNameBefore} phone=${phoneNumber}" --json`,
          { ensureExitCode: 0 }
        ).jsonOutput;
        assert(createRecordResponse?.result?.id);
        expect(createRecordResponse?.result).to.have.property('success', true);
        expect(createRecordResponse?.result).to.have.property('id');
        createdRecordId = createRecordResponse?.result?.id;
      });

      it('deletes the record via "where"', () => {
        const deleteRecordResponse = execCmd<SaveResult>(
          `data:delete:record --sobject Account --where "name='${accountNameBefore}' phone='${phoneNumber}'" --json`,
          { ensureExitCode: 0 }
        ).jsonOutput;
        expect(deleteRecordResponse?.result).to.have.property('id', createdRecordId);
        expect(deleteRecordResponse?.result).to.have.property('success', true);
      });
    });
  });

  describe('verify human results', () => {
    describe('should create, update, and delete a data record', () => {
      const uniqueString = genUniqueString();
      const accountNameBefore = `MyIntTest${uniqueString}`;
      const accountNameAfter = `MyIntTestUpdated${uniqueString}`;
      const phoneNumber = '1231231234';
      const updatedPhoneNumber = '0987654321';
      let recordId: string;

      it('create a record', () => {
        const createRecordResponse = execCmd(
          `data:create:record --sobject Account --values "name=${accountNameBefore} phone=${phoneNumber}"`,
          { ensureExitCode: 0 }
        ).shellOutput.stdout;
        const m = new RegExp('Successfully created record: (001.{15})\\.');
        const match = m.exec(createRecordResponse);
        expect(match).to.have.lengthOf(2, `could not locate success message in results: "${createRecordResponse}`);
        recordId = match ? match[1] : 'shouldnoteverybethisvalue';
      });

      it('get the created record', () => {
        const getRecordResponse = execCmd(`data:get:record --sobject Account --record-id ${recordId}`, {
          ensureExitCode: 0,
        }).shellOutput.stdout;
        validateAccount(getRecordResponse, recordId, accountNameBefore, phoneNumber);
        validateAccount(getRecordResponse, recordId, accountNameBefore, phoneNumber);
      });

      it('update the created record', () => {
        const updateRecordResponse = execCmd(
          `data:update:record --record-id ${recordId} --sobject Account --values "name=${accountNameAfter} phone=${updatedPhoneNumber}"`,
          { ensureExitCode: 0 }
        ).shellOutput.stdout;
        expect(updateRecordResponse).to.include('Successfully updated record: 001');
      });

      it('get the updated record', () => {
        const getRecordResponse = execCmd(`data:get:record --sobject Account --record-id ${recordId}`, {
          ensureExitCode: 0,
        }).shellOutput.stdout;
        validateAccount(getRecordResponse, recordId, accountNameAfter, updatedPhoneNumber);
      });

      it('delete the record', () => {
        const deleteRecordResponse = execCmd(`data:delete:record --sobject Account --record-id ${recordId}`, {
          ensureExitCode: 0,
        }).shellOutput.stdout;
        expect(deleteRecordResponse).to.include('Successfully deleted record: 001');
      });
    });
  });
  describe('verify tooling api record commands', () => {
    it('should get, update, and delete a data record', () => {
      // Get ApexClass
      let getRecordResponse = execCmd<ApexClassRecord>(
        'data:get:record --sobject ApexClass --where Name=MyClass --json',
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      expect(getRecordResponse).to.have.property('Id');
      expect(getRecordResponse).to.have.property('Name', 'MyClass');
      expect(getRecordResponse).to.not.have.property('SymbolTable');

      // Get ApexClass via tooling API
      getRecordResponse = execCmd<ApexClassRecord>(
        'data:get:record --sobject ApexClass --where Name=MyClass --usetoolingapi --json',
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      expect(getRecordResponse).to.have.property('Id', getRecordResponse?.Id);
      expect(getRecordResponse).to.have.property('Name', 'MyClass');
      expect(getRecordResponse).to.have.property('SymbolTable');
    });
  });

  describe('test get with where clause using boolean', () => {
    const objectType = 'Test_Object__c';
    const recordName = 'TestRecord';
    it('create a record in a custom object that we can query', () => {
      execCmd(`data:create:record --sobject ${objectType} --values "Name=${recordName}"`, {
        ensureExitCode: 0,
      });
    });

    it('get the record using a boolean field', () => {
      const result = execCmd(
        `data:get:record --sobject ${objectType} --where "Name='${recordName}' Bool__c=false" --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      expect(result).to.have.property('Name', recordName);
      expect(result).to.have.property('Bool__c', false);
    });
  });

  describe('json parsing', () => {
    it('will parse JSON correctly for update', () => {
      const result = execCmd<{ records: Array<{ Id: string }> }>(
        'data:query -q "SELECT Id FROM RemoteProxy LIMIT 1" -t --json',
        {
          ensureExitCode: 0,
        }
      ).jsonOutput?.result;
      assert(result?.records.length);

      const update = execCmd(
        'data:update:record ' +
          '--sobject RemoteProxy ' +
          `--record-id ${result.records[0].Id} ` +
          '--usetoolingapi ' +
          '--values "Metadata=\'{\\"disableProtocolSecurity\\": false,\\"isActive\\": true,\\"url\\": \\"https://www.example.com\\",\\"urls\\": null,\\"description\\": null}\'"',
        { ensureExitCode: 0 }
      );
      expect(update).to.be.ok;
    });

    it('will parse invalid JSON data, but that contains {}', () => {
      const result = execCmd<{ id: string }>('data:create:record -s Account -v "Name=Test" --json', {
        ensureExitCode: 0,
      }).jsonOutput?.result;

      assert(result?.id);
      const update = execCmd(
        'data:update:record ' +
          '--sobject Account ' +
          `--record-id ${result.id} ` +
          '--values "Description=\'my new description { with invalid } JSON\'"',
        { ensureExitCode: 0 }
      );

      expect(update).to.be.ok;
    });
  });
});
