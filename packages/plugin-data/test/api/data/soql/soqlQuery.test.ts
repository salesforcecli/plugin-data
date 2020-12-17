/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import sinon = require('sinon');
import { Logger } from '@salesforce/core';
import * as TestUtil from '../../../testUtil';
import { SoqlQuery } from '../../../../src/api/data/soql/soqlQuery';
import { soqlQueryExemplars } from './test-files/soqlQuery.exemplars';
import { queryFieldsExemplars } from './test-files/queryFields.exemplars';

chai.use(chaiAsPromised);

describe('soqlQuery tests', () => {
  // let toolingSpy: sinon.SinonSpy;
  // let querySpy: sinon.SinonSpy;
  const fakeConnection = TestUtil.createFakeConnection();
  const logger = Logger.childFromRoot('soqlQuery.test');
  let sandbox: any;
  let querySpy: any;
  let requestSpy: any;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('should handle a simple query with all records returned in single call', async () => {
    sandbox
      .stub(fakeConnection, 'request')
      .callsFake(() => Promise.resolve({ columnMetadata: queryFieldsExemplars.simpleQuery.columnMetadata }));
    querySpy = sandbox
      .stub(fakeConnection, 'autoFetchQuery')
      .callsFake(() => Promise.resolve(soqlQueryExemplars.simpleQuery.queryResult));
    // queryMoreSpy = sandbox.stub(fakeConnection, 'queryMore');
    const soqlQuery = new SoqlQuery(fakeConnection, 'SELECT id, name FROM Contact', logger);
    const results = await soqlQuery.runSoqlQuery();
    sinon.assert.calledOnce(querySpy);
    expect(results).to.be.deep.equal(soqlQueryExemplars.simpleQuery.soqlQueryResult);
  });
  it('should handle a query with a subquery', async () => {
    sandbox
      .stub(fakeConnection, 'request')
      .callsFake(() => Promise.resolve({ columnMetadata: queryFieldsExemplars.subquery.columnMetadata }));
    querySpy = sandbox
      .stub(fakeConnection, 'autoFetchQuery')
      .callsFake(() => Promise.resolve(soqlQueryExemplars.subQuery.queryResult));
    const soqlQuery = new SoqlQuery(
      fakeConnection,
      'SELECT Name, ( SELECT LastName FROM Contacts ) FROM Account',
      logger
    );
    const results = await soqlQuery.runSoqlQuery();
    sinon.assert.calledOnce(querySpy);
    // sinon.assert.notCalled(queryMoreSpy);
    expect(results).to.be.deep.equal(soqlQueryExemplars.subQuery.soqlQueryResult);
  });
  it('should handle empty query', async () => {
    requestSpy = sandbox.stub(fakeConnection, 'request');
    querySpy = sandbox
      .stub(fakeConnection, 'autoFetchQuery')
      .callsFake(() => Promise.resolve(soqlQueryExemplars.emptyQuery.queryResult));
    // queryMoreSpy = sandbox.stub(fakeConnection, 'queryMore');
    const soqlQuery = new SoqlQuery(
      fakeConnection,
      "SELECT Name FROM Contact where name = 'some nonexistent name'",
      logger
    );
    const results = await soqlQuery.runSoqlQuery();
    sinon.assert.calledOnce(querySpy);
    sinon.assert.notCalled(requestSpy);
    expect(results).to.be.deep.equal(soqlQueryExemplars.emptyQuery.soqlQueryResult);
  });
});
