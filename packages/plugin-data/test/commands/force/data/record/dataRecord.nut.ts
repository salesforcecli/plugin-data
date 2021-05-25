/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { expect } from 'chai';
import { execCmd, genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { Dictionary } from '@salesforce/ts-types';

interface RecordCrudResult {
  id: string;
  success: boolean;
  errors: [];
}

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

interface ShellString {
  code: number;
  stdout: string;
  stderr: string;
}

const validateAccount = (
  accountRecord: string,
  recordId: string,
  accountName: string,
  phoneNumber: string
): boolean => {
  const id = new RegExp(`Id:.*?${recordId}`, 'g');
  const name = new RegExp(`Name:.*?${accountName}`, 'g');
  const phone = new RegExp(`Phone:.*?${phoneNumber}`, 'g');
  return id.test(accountRecord) && name.test(accountRecord) && phone.test(accountRecord);
};

describe('data:record commands', () => {
  let testSession: TestSession;

  before(async () => {
    testSession = await TestSession.create({
      setupCommands: [
        'sfdx force:org:create -f config/project-scratch-def.json --setdefaultusername --wait 10 --durationdays 1',
        'sfdx force:source:push',
        'sfdx force:user:permset:assign -n TestPerm',
      ],
      project: { sourceDir: path.join('test', 'test-files', 'data-project') },
    });
  });

  after(async () => {
    await testSession?.clean();
  });

  describe('verify json results', () => {
    it('should create, get, update, and delete a data record', () => {
      const uniqueString = genUniqueString();
      const accountNameBefore = `MyIntTest${uniqueString}`;
      const accountNameAfter = `MyIntTestUpdated${uniqueString}`;
      const phoneNumber = '1231231234';
      const updatedPhoneNumber = '0987654321';

      // Create a record
      let createRecordResponse = execCmd<RecordCrudResult>(
        `force:data:record:create --sobjecttype Account --values "name=${accountNameBefore} phone=${phoneNumber}" --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      expect(createRecordResponse?.result).to.have.property('success', true);
      expect(createRecordResponse?.result).to.have.property('id');

      // Get a record
      let getRecordResponse = execCmd<AccountRecord>(
        `force:data:record:get --sobjecttype Account --sobjectid ${createRecordResponse?.result.id} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      expect(getRecordResponse?.result).to.have.property('Id', createRecordResponse?.result.id);
      expect(getRecordResponse?.result).to.have.property('Name', accountNameBefore);
      expect(getRecordResponse?.result).to.have.property('Phone', phoneNumber);

      // Get a record using where
      getRecordResponse = execCmd<AccountRecord>(
        `force:data:record:get --sobjecttype Account --where "Name='${accountNameBefore}' Phone='${phoneNumber}'" --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      expect(getRecordResponse?.result).to.have.property('Id', createRecordResponse?.result.id);
      expect(getRecordResponse?.result).to.have.property('Name', accountNameBefore);
      expect(getRecordResponse?.result).to.have.property('Phone', phoneNumber);

      // Update a record
      execCmd<RecordCrudResult>(
        `force:data:record:update --sobjectid ${createRecordResponse?.result.id} --sobjecttype Account --values "name=${accountNameAfter} phone=${updatedPhoneNumber}" --json`,
        { ensureExitCode: 0 }
      );

      // Get a record
      getRecordResponse = execCmd<AccountRecord>(
        `force:data:record:get --sobjecttype Account --sobjectid ${createRecordResponse?.result.id} --json --perflog`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      expect(getRecordResponse?.result).to.have.property('Id', createRecordResponse?.result.id);
      expect(getRecordResponse?.result).to.have.property('Name', accountNameAfter);
      expect(getRecordResponse?.result).to.have.property('Phone', updatedPhoneNumber);

      // Update a record
      execCmd<RecordCrudResult>(
        `force:data:record:update --where "Name='${accountNameAfter}'" --sobjecttype Account --values "name='${accountNameBefore}'" --json`,
        { ensureExitCode: 0 }
      );

      // Get a record
      getRecordResponse = execCmd<AccountRecord>(
        `force:data:record:get --sobjecttype Account --sobjectid ${createRecordResponse?.result.id} --json `,
        { ensureExitCode: 0 }
      ).jsonOutput;
      expect(getRecordResponse?.result).to.have.property('Id', createRecordResponse?.result.id);
      expect(getRecordResponse?.result).to.have.property('Name', accountNameBefore);
      expect(getRecordResponse?.result).to.have.property('Phone', updatedPhoneNumber);

      // Delete a record
      let deleteRecordResponse = execCmd<RecordCrudResult>(
        `force:data:record:delete --sobjecttype Account --sobjectid ${createRecordResponse?.result.id} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      expect(deleteRecordResponse?.result).to.have.property('id', createRecordResponse?.result.id);
      expect(deleteRecordResponse?.result).to.have.property('success', true);

      // Create a record
      createRecordResponse = execCmd<RecordCrudResult>(
        `force:data:record:create --sobjecttype Account --values "name=${accountNameBefore} phone=${phoneNumber}" --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      expect(createRecordResponse?.result).to.have.property('success', true);
      expect(createRecordResponse?.result).to.have.property('id');

      // Delete a record
      deleteRecordResponse = execCmd<RecordCrudResult>(
        `force:data:record:delete --sobjecttype Account --where "name='${accountNameBefore}' phone='${phoneNumber}'" --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;
      expect(deleteRecordResponse?.result).to.have.property('id', createRecordResponse?.result.id);
      expect(deleteRecordResponse?.result).to.have.property('success', true);
    });
  });
  describe('verify human results', () => {
    it('should create, update, and delete a data record', () => {
      const uniqueString = genUniqueString();
      const accountNameBefore = `MyIntTest${uniqueString}`;
      const accountNameAfter = `MyIntTestUpdated${uniqueString}`;
      const phoneNumber = '1231231234';
      const updatedPhoneNumber = '0987654321';

      // Create a record
      const createRecordResponse = (execCmd(
        `force:data:record:create --sobjecttype Account --values "name=${accountNameBefore} phone=${phoneNumber}"`,
        { ensureExitCode: 0 }
      ).shellOutput as ShellString).stdout;
      const m = new RegExp('Successfully created record: (001.{15})\\.');
      const match = m.exec(createRecordResponse);
      expect(match).to.have.lengthOf(2, `could not locate success message in results: "${createRecordResponse}`);
      const recordId = match ? match[1] : 'shouldnoteverybethisvalue';

      // Get a record
      let getRecordResponse = (execCmd(`force:data:record:get --sobjecttype Account --sobjectid ${recordId}`, {
        ensureExitCode: 0,
      }).shellOutput as ShellString).stdout;
      expect(validateAccount(getRecordResponse, recordId, accountNameBefore, phoneNumber)).to.be.true;

      // Update a record
      const updateRecordResponse = (execCmd(
        `force:data:record:update --sobjectid ${recordId} --sobjecttype Account --values "name=${accountNameAfter} phone=${updatedPhoneNumber}"`,
        { ensureExitCode: 0 }
      ).shellOutput as ShellString).stdout;
      expect(updateRecordResponse).to.include('Successfully updated record: 001');

      // Get a record
      getRecordResponse = (execCmd(`force:data:record:get --sobjecttype Account --sobjectid ${recordId}`, {
        ensureExitCode: 0,
      }).shellOutput as ShellString).stdout;
      expect(validateAccount(getRecordResponse, recordId, accountNameAfter, updatedPhoneNumber)).to.be.true;

      // Delete a record
      const deleteRecordResponse = (execCmd(`force:data:record:delete --sobjecttype Account --sobjectid ${recordId}`, {
        ensureExitCode: 0,
      }).shellOutput as ShellString).stdout;
      expect(deleteRecordResponse).to.include('Successfully deleted record: 001');
    });
  });
  describe('verify tooling api record commands', () => {
    it('should get, update, and delete a data record', () => {
      // Get ApexClass
      let getRecordResponse = execCmd<ApexClassRecord>(
        'force:data:record:get --sobjecttype ApexClass --where Name=MyClass --json',
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      expect(getRecordResponse).to.have.property('Id');
      expect(getRecordResponse).to.have.property('Name', 'MyClass');
      expect(getRecordResponse).to.not.have.property('SymbolTable');

      // Get ApexClass via tooling API
      getRecordResponse = execCmd<ApexClassRecord>(
        'force:data:record:get --sobjecttype ApexClass --where Name=MyClass --usetoolingapi --json',
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
      execCmd(`force:data:record:create --sobjecttype ${objectType} --values "Name=${recordName}"`, {
        ensureExitCode: 0,
      });
    });

    it('get the record using a boolean field', () => {
      const result = execCmd(
        `force:data:record:get --sobjecttype ${objectType} --where "Name='${recordName}' Bool__c=false" --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;
      expect(result).to.have.property('Name', recordName);
      expect(result).to.have.property('Bool__c', false);
    });
  });
});
