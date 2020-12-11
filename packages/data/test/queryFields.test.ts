/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { expect } from 'chai';

// import { AuthInfo, AuthInfoConfig, Logger, Org } from '@salesforce/core';
import sinon = require('sinon');
import { retrieveColumns } from '../lib/queryFields';
import * as TestUtil from './testUtil';
chai.use(chaiAsPromised);

// SELECT id, name FROM Contact
const simpleQueryCMD = [
  {
    aggregate: false,
    apexType: 'Id',
    booleanType: false,
    columnName: 'Id',
    custom: false,
    displayName: 'Id',
    foreignKeyName: null,
    insertable: false,
    joinColumns: [],
    numberType: false,
    textType: false,
    updatable: false,
  },
  {
    aggregate: false,
    apexType: 'String',
    booleanType: false,
    columnName: 'Name',
    custom: false,
    displayName: 'Name',
    foreignKeyName: null,
    insertable: false,
    joinColumns: [],
    numberType: false,
    textType: true,
    updatable: false,
  },
];

const simpleQueryFields = [
  {
    name: 'Id',
  },
  {
    name: 'Name',
  },
];

// SELECT Name, ( SELECT LastName FROM Contacts ) FROM Account
const subqueryQueryCMD = [
  {
    aggregate: false,
    apexType: 'String',
    booleanType: false,
    columnName: 'Name',
    custom: false,
    displayName: 'Name',
    foreignKeyName: null,
    insertable: false,
    joinColumns: [],
    numberType: false,
    textType: true,
    updatable: false,
  },
  {
    aggregate: true,
    apexType: null,
    booleanType: false,
    columnName: 'Contacts',
    custom: false,
    displayName: 'Contacts',
    foreignKeyName: null,
    insertable: false,
    joinColumns: [
      {
        aggregate: false,
        apexType: 'String',
        booleanType: false,
        columnName: 'LastName',
        custom: false,
        displayName: 'LastName',
        foreignKeyName: null,
        insertable: true,
        joinColumns: [],
        numberType: false,
        textType: true,
        updatable: true,
      },
    ],
    numberType: false,
    textType: false,
    updatable: false,
  },
];

const subqueryQueryFields = [
  {
    name: 'Name',
  },
  {
    name: 'Contacts',
    fields: [
      {
        name: 'LastName',
      },
    ],
  },
];

// SELECT CampaignId, AVG(Amount) FROM Opportunity GROUP BY CampaignId
const simpleQueryWithAggregateCMD = [
  {
    aggregate: false,
    apexType: 'Id',
    booleanType: false,
    columnName: 'CampaignId',
    custom: false,
    displayName: 'CampaignId',
    foreignKeyName: null,
    insertable: true,
    joinColumns: [],
    numberType: false,
    textType: false,
    updatable: true,
  },
  {
    aggregate: true,
    apexType: null,
    booleanType: false,
    columnName: 'expr0',
    custom: false,
    displayName: 'avg(Amount)',
    foreignKeyName: null,
    insertable: false,
    joinColumns: [],
    numberType: true,
    textType: false,
    updatable: false,
  },
];

const simpleQueryWithAggregateFields = [
  {
    name: 'CampaignId',
  },
  {
    name: 'avg(Amount)',
  },
];

describe('queryFields test', () => {
  // let toolingSpy: sinon.SinonSpy;
  // let querySpy: sinon.SinonSpy;
  const fakeConnection = TestUtil.createBaseFakeConnection();
  let sandbox: any;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('should handle a query with just fields', async () => {
    sandbox.stub(fakeConnection, 'request').callsFake(() => Promise.resolve({ columnMetadata: simpleQueryCMD }));
    const results = await retrieveColumns(fakeConnection, 'select foo from baz');
    expect(results).to.be.deep.equal(simpleQueryFields);
  });
  it('should handle a query with a subquery with both having just fields', async () => {
    sandbox.stub(fakeConnection, 'request').callsFake(() => Promise.resolve({ columnMetadata: subqueryQueryCMD }));
    const results = await retrieveColumns(fakeConnection, 'select foo from baz');
    expect(results).to.be.deep.equal(subqueryQueryFields);
  });
  it('should handle a query with aggregate fields', async () => {
    sandbox
      .stub(fakeConnection, 'request')
      .callsFake(() => Promise.resolve({ columnMetadata: simpleQueryWithAggregateCMD }));
    const results = await retrieveColumns(fakeConnection, 'select foo from baz');
    expect(results).to.be.deep.equal(simpleQueryWithAggregateFields);
  });
});
