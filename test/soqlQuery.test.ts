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
import { Logger, SfdxConfigAggregator } from '@salesforce/core';
import { QueryResult } from 'jsforce';
import sinon = require('sinon');
import { SoqlQuery } from '../src/commands/force/data/soql/query';
import * as TestUtil from './testUtil';
import { soqlQueryExemplars } from './test-files/soqlQuery.exemplars';
import { queryFieldsExemplars } from './test-files/queryFields.exemplars';

chai.use(chaiAsPromised);

describe('soqlQuery tests', () => {
  const fakeConnection = TestUtil.createFakeConnection();
  const logger = Logger.childFromRoot('soqlQuery.test');
  const sandbox = sinon.createSandbox();
  let querySpy: sinon.SinonSpy;
  let requestSpy: sinon.SinonSpy;
  afterEach(() => {
    sandbox.restore();
  });

  it.skip('should handle a simple query with all records returned in single call', async () => {
    const configAgg = await SfdxConfigAggregator.create();
    sandbox
      .stub(fakeConnection, 'request')
      .resolves({ columnMetadata: queryFieldsExemplars.simpleQuery.columnMetadata });
    querySpy = sandbox
      .stub(fakeConnection, 'query')
      .resolves(soqlQueryExemplars.simpleQuery.queryResult as unknown as QueryResult<any>);
    const soqlQuery = new SoqlQuery();
    const results = await soqlQuery.runSoqlQuery(fakeConnection, 'SELECT id, name FROM Contact', logger, configAgg);
    sinon.assert.calledOnce(querySpy);
    expect(results).to.be.deep.equal(soqlQueryExemplars.simpleQuery.soqlQueryResult);
  });
  it.skip('should handle a query with a subquery', async () => {
    const configAgg = await SfdxConfigAggregator.create();
    sandbox.stub(fakeConnection, 'request').resolves({ columnMetadata: queryFieldsExemplars.subquery.columnMetadata });
    querySpy = sandbox
      .stub(fakeConnection, 'query')
      .resolves(soqlQueryExemplars.subQuery.queryResult as unknown as QueryResult<any>);
    const soqlQuery = new SoqlQuery();
    const results = await soqlQuery.runSoqlQuery(
      fakeConnection,
      'SELECT Name, ( SELECT LastName FROM Contacts ) FROM Account',
      logger,
      configAgg
    );
    sinon.assert.calledOnce(querySpy);
    expect(results).to.be.deep.equal(soqlQueryExemplars.subQuery.soqlQueryResult);
  });
  it.skip('should handle empty query', async () => {
    const configAgg = await SfdxConfigAggregator.create();
    requestSpy = sandbox.stub(fakeConnection, 'request');
    querySpy = sandbox.stub(fakeConnection, 'query').resolves(soqlQueryExemplars.emptyQuery.queryResult);
    const soqlQuery = new SoqlQuery();
    const results = await soqlQuery.runSoqlQuery(
      fakeConnection,
      "SELECT Name FROM Contact where name = 'some nonexistent name'",
      logger,
      configAgg
    );
    sinon.assert.calledOnce(querySpy);
    sinon.assert.notCalled(requestSpy);
    expect(results).to.be.deep.equal(soqlQueryExemplars.emptyQuery.soqlQueryResult);
  });
});
