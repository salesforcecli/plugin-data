/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import * as fs from 'fs';
import * as sinon from 'sinon';
import { Connection, Messages, Org } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { Ux } from '@salesforce/sf-plugins-core';
import { assert, expect } from 'chai';
import { ExportApi } from '../../../../src/api/data/tree/exportApi';

//
//  TEST DATA
//

const status = 'New';
const origin = 'Phone';
const subject = 'Where are you from Hobbs?';
const firstName = 'Roy';
const lastName = 'Hobbs';
const email = 'roy.hobbs@bigdogs.org';
const phone = '512-757-6000';

// Sample response from a query; used by the query stub
const testRecordList = {
  totalSize: 1,
  done: true,
  records: [
    {
      attributes: {
        type: 'Account',
        url: '/services/data/v39.0/sobjects/Account/001xx000003DHzvAAG',
      },
      Id: '001xx000003DHzvAAG',
      Name: 'BigDogs',
      Industry: 'Construction',
      Cases: {
        totalSize: 1,
        done: true,
        records: [
          {
            attributes: {
              type: 'Case',
              url: '/services/data/v39.0/sobjects/Case/500xx000000Yn2uAAC',
            },
            Status: status,
            Origin: origin,
            Subject: subject,
            AccountId: '001xx000003DHzvAAG',
          },
        ],
      },
      Contacts: {
        totalSize: 1,
        done: true,
        records: [
          {
            attributes: {
              type: 'Contact',
              url: '/services/data/v39.0/sobjects/Contact/003xx000004TpUeAAK',
            },
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            Phone: phone,
          },
        ],
      },
    },
    {
      attributes: {
        type: 'Account',
        url: '/services/data/v39.0/sobjects/Account/001xx000003DHzvBAG',
      },
      Id: '001xx000003DHzvBAG',
      Name: 'HotDogs',
      Industry: 'Fine Dining',
      Cases: null,
      Contacts: null,
    },
  ],
};

// Abbreviated response of Case SObject metadata used by the describe stub.
const CASE_META = {
  name: 'Case',
  childRelationships: [],
  fields: [
    { name: 'AccountId', referenceTo: ['Account'], type: 'reference' },
    { name: 'Status', referenceTo: [], type: 'picklist' },
    { name: 'Origin', referenceTo: [], type: 'picklist' },
    { name: 'Subject', referenceTo: [], type: 'string' },
  ],
};

// Abbreviated response of Contact SObject metadata used by the describe stub.
const CONTACT_META = {
  name: 'Contact',
  childRelationships: [],
  fields: [
    { name: 'AccountId', referenceTo: ['Account'], type: 'reference' },
    { name: 'LastName', referenceTo: [], type: 'string' },
    { name: 'FirstName', referenceTo: [], type: 'string' },
    { name: 'Phone', referenceTo: [], type: 'phone' },
    { name: 'Email', referenceTo: [], type: 'email' },
  ],
};

// Abbreviated response of Account SObject metadata used by the describe stub.
const ACCOUNT_META = {
  name: 'Account',
  childRelationships: [
    { childSObject: 'Case', field: 'AccountId', relationshipName: 'Cases' },
    {
      childSObject: 'Contact',
      field: 'AccountId',
      relationshipName: 'Contacts',
    },
  ],
  fields: [
    { name: 'Name', referenceTo: [], type: 'string' },
    { name: 'Type', referenceTo: [], type: 'picklist' },
    { name: 'Industry', referenceTo: [], type: 'picklist' },
  ],
};

// Expected file contents to be written by the export command based on the data returned by the stubs.
const expectedFileContents = {
  records: [
    {
      attributes: { type: 'Account', referenceId: 'AccountRef1' },
      Name: testRecordList.records[0].Name,
      Industry: testRecordList.records[0].Industry,
      Cases: {
        records: [
          {
            attributes: { type: 'Case', referenceId: 'CaseRef1' },
            Status: status,
            Origin: origin,
            Subject: subject,
          },
        ],
      },
      Contacts: {
        records: [
          {
            attributes: { type: 'Contact', referenceId: 'ContactRef1' },
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            Phone: phone,
          },
        ],
      },
    },
    {
      attributes: { type: 'Account', referenceId: 'AccountRef2' },
      Name: testRecordList.records[1].Name,
      Industry: testRecordList.records[1].Industry,
      Cases: { records: [] },
      Contacts: { records: [] },
    },
  ],
};

// Expected plan file contents to be written by the export command based on the data returned by the stubs.
const expectedPlanOutput = {
  planFile: [
    {
      sobject: 'Account',
      saveRefs: true,
      resolveRefs: false,
      files: ['Accounts.json'],
    },
    {
      sobject: 'Case',
      saveRefs: false,
      resolveRefs: true,
      files: ['Cases.json'],
    },
    {
      sobject: 'Contact',
      saveRefs: false,
      resolveRefs: true,
      files: ['Contacts.json'],
    },
  ],
  Accounts: {
    records: [
      {
        attributes: expectedFileContents.records[0].attributes,
        Name: expectedFileContents.records[0].Name,
        Industry: expectedFileContents.records[0].Industry,
      },
      {
        attributes: expectedFileContents.records[1].attributes,
        Name: expectedFileContents.records[1].Name,
        Industry: expectedFileContents.records[1].Industry,
      },
    ],
  },
  Cases: expectedFileContents.records[0].Cases,
  Contacts: expectedFileContents.records[0].Contacts,
};

function deepClone(obj: AnyJson) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return JSON.parse(JSON.stringify(obj));
}

describe('Export API', () => {
  const sandbox = sinon.createSandbox();
  Messages.importMessagesDirectory(__dirname);
  const messages = Messages.loadMessages('@salesforce/plugin-data', 'exportApi');
  const testUsername = 'user@my.test';

  let exportApi: ExportApi;
  let writeStub: any;
  let queryStub: any;
  let sobjectStub: any;

  beforeEach(async () => {
    writeStub = sandbox.stub(fs, 'writeFileSync');
    sandbox.stub(fs, 'existsSync').returns(false);

    const testOrg = new Org({ aliasOrUsername: testUsername });
    queryStub = sandbox.stub(Connection.prototype, 'query');
    queryStub.resolves(deepClone(testRecordList));
    sobjectStub = sandbox.stub(Connection.prototype, 'sobject');
    sobjectStub.withArgs('Case').returns({
      // @ts-ignore
      describe: () => Promise.resolve(CASE_META),
    });
    sobjectStub.withArgs('Contact').returns({
      // @ts-ignore
      describe: () => Promise.resolve(CONTACT_META),
    });
    sobjectStub.withArgs('Account').returns({
      // @ts-ignore
      describe: () => Promise.resolve(ACCOUNT_META),
    });
    // @ts-ignore
    sandbox.stub(Org.prototype, 'getConnection').returns({
      query: queryStub,
      // @ts-ignore
      sobject: sobjectStub,
    });
    const ux = new Ux({ jsonEnabled: true });
    sandbox.stub(ux, 'log');

    exportApi = new ExportApi(testOrg, ux);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should throw an error when the soql param is unset', async () => {
    try {
      // @ts-ignore  This won't compile for TS but it's possible to use the ExportApi
      //             from a JS plugin so ignoring the error.
      await exportApi.export({ query: null });
      assert.fail();
    } catch (err) {
      const error = err as Error;
      // solves flappy test - on linux, the writeStub is called to write the log file
      if (writeStub.called) {
        expect(writeStub.args.filter((arg: string) => !arg[0].includes('sf.log'))).to.be.empty;
      } else {
        expect(writeStub.called).to.be.false;
      }
      expect(error.name).to.equal('queryNotProvided');
      expect(error.message).to.equal(messages.getMessage('queryNotProvided'));
    }
  });

  it('should throw an error when the soql query does not begin with "select"', async () => {
    const query = 'update all the things!';

    try {
      await exportApi.export({ query });
      assert.fail();
    } catch (err) {
      const error = err as Error;
      expect(writeStub.called).to.be.false;
      expect(error.name).to.equal('SoqlInvalidError');
      expect(error.message).to.equal(messages.getMessage('soqlInvalid', [query]));
    }
  });

  it('should export query results to a file', async () => {
    await exportApi.export({ query: 'select' });
    const writeFileArgs = writeStub.args;
    const filenameArg = writeFileArgs[0][0];
    const fileContentsJsonArg = JSON.parse(writeFileArgs[0][1] as string);

    expect(writeStub.callCount).to.equal(1);
    expect(filenameArg).to.equal('Account-Case-Contact.json');
    expect(fileContentsJsonArg).to.eql(expectedFileContents);
  });

  it('should export query results to a plan', async () => {
    // clone the expected plan output so modifications don't affect other tests
    const expectedPlan = deepClone(expectedPlanOutput);

    // Add the refs to the expected output
    expectedPlan.Cases.records[0].AccountId = '@AccountRef1';
    expectedPlan.Contacts.records[0].AccountId = '@AccountRef1';

    await exportApi.export({ query: 'select', plan: true });
    expect(writeStub.callCount).to.equal(4);

    const fsWriteCall1 = writeStub.args[0];
    const fsWriteCall2 = writeStub.args[1];
    const fsWriteCall3 = writeStub.args[2];
    const fsWriteCall4 = writeStub.args[3];

    // Verify files were written with expected filenames
    expect(writeStub.calledWith('Accounts.json')).to.be.true;
    expect(writeStub.calledWith('Cases.json')).to.be.true;
    expect(writeStub.calledWith('Contacts.json')).to.be.true;
    expect(writeStub.calledWith('Account-Case-Contact-plan.json')).to.be.true;

    // Verify file contents
    expect(JSON.parse(fsWriteCall1[1] as string)).to.eql(expectedPlan.Accounts);
    expect(JSON.parse(fsWriteCall2[1] as string)).to.eql(expectedPlan.Cases);
    expect(JSON.parse(fsWriteCall3[1] as string)).to.eql(expectedPlan.Contacts);
    expect(JSON.parse(fsWriteCall4[1] as string)).to.eql(expectedPlan.planFile);
  });

  it('should export query results to a plan using a prefix', async () => {
    const PREFIX = 'test';

    // clone the expected plan output so modifications don't affect other tests
    const expectedPlan = deepClone(expectedPlanOutput);

    // Add the refs to the expected output
    expectedPlan.Cases.records[0].AccountId = '@AccountRef1';
    expectedPlan.Contacts.records[0].AccountId = '@AccountRef1';

    // Modify plan file contents for the prefix
    expectedPlan.planFile[0].files = [`${PREFIX}-Accounts.json`];
    expectedPlan.planFile[1].files = [`${PREFIX}-Cases.json`];
    expectedPlan.planFile[2].files = [`${PREFIX}-Contacts.json`];

    await exportApi.export({
      query: 'select',
      plan: true,
      prefix: PREFIX,
    });
    expect(writeStub.callCount).to.equal(4);

    const fsWriteCall1 = writeStub.args[0];
    const fsWriteCall2 = writeStub.args[1];
    const fsWriteCall3 = writeStub.args[2];
    const fsWriteCall4 = writeStub.args[3];

    // Verify files were written with expected filenames
    expect(writeStub.calledWith(`${PREFIX}-Accounts.json`)).to.be.true;
    expect(writeStub.calledWith(`${PREFIX}-Cases.json`)).to.be.true;
    expect(writeStub.calledWith(`${PREFIX}-Contacts.json`)).to.be.true;
    expect(writeStub.calledWith(`${PREFIX}-Account-Case-Contact-plan.json`)).to.be.true;

    // Verify file contents
    expect(JSON.parse(fsWriteCall1[1] as string)).to.eql(expectedPlan.Accounts);
    expect(JSON.parse(fsWriteCall2[1] as string)).to.eql(expectedPlan.Cases);
    expect(JSON.parse(fsWriteCall3[1] as string)).to.eql(expectedPlan.Contacts);
    expect(JSON.parse(fsWriteCall4[1] as string)).to.eql(expectedPlan.planFile);
  });

  it('should export query results to a file when query param is a file that contains a soql query', async () => {
    sandbox.stub(fs, 'readFileSync').callsFake(() => 'select stuff');
    // @ts-ignore
    fs.existsSync['returns'](true);
    await exportApi.export({ query: 'queryInaFile.txt' });
    const writeFileArgs = writeStub.args;
    const filenameArg = writeFileArgs[0][0];
    const fileContentsJsonArg = JSON.parse(writeFileArgs[0][1] as string);

    expect(writeStub.callCount).to.equal(1);
    expect(filenameArg).to.equal('Account-Case-Contact.json');
    expect(fileContentsJsonArg).to.eql(expectedFileContents);
  });

  it('should export invalid emails', async () => {
    const expectedFile = deepClone(expectedFileContents);
    expectedFile.records[0].Contacts.records[0].Email = '<invalid_email>';

    queryStub.restore();
    const testRecordList2 = deepClone(testRecordList);
    testRecordList2.records[0].Contacts.records[0].Email = '<invalid_email>';
    queryStub = sandbox.stub(Connection.prototype, 'query');
    queryStub.resolves(testRecordList2);

    // @ts-ignore
    Org.prototype.getConnection.restore();
    // @ts-ignore
    sandbox.stub(Org.prototype, 'getConnection').returns({
      query: queryStub,
      // @ts-ignore
      sobject: sobjectStub,
    });

    await exportApi.export({ query: 'select' });
    const writeFileArgs = writeStub.args;
    const filenameArg = writeFileArgs[0][0];
    const fileContentsJsonArg = JSON.parse(writeFileArgs[0][1] as string);

    expect(writeStub.callCount).to.equal(1);
    expect(filenameArg).to.equal('Account-Case-Contact.json');
    expect(fileContentsJsonArg).to.eql(expectedFile);
  });
});
