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
import { Logger } from '@salesforce/core';
import { QueryResult } from 'jsforce';
import sinon = require('sinon');
import { Ux } from '@salesforce/sf-plugins-core';
import { runSoqlQuery } from '../src/commands/force/data/soql/query';
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

  it('should handle a simple query with all records returned in single call', async () => {
    sandbox
      .stub(fakeConnection, 'request')
      .resolves({ columnMetadata: queryFieldsExemplars.simpleQuery.columnMetadata });
    querySpy = sandbox
      .stub(fakeConnection, 'query')
      .resolves(soqlQueryExemplars.simpleQuery.queryResult as unknown as QueryResult<any>);
    const results = await runSoqlQuery(fakeConnection, 'SELECT id, name FROM Contact', logger, new Ux());
    sinon.assert.calledOnce(querySpy);
    expect(results).to.be.deep.equal(soqlQueryExemplars.simpleQuery.soqlQueryResult);
  });
  it('should handle a query with a subquery', async () => {
    sandbox.stub(fakeConnection, 'request').resolves({ columnMetadata: queryFieldsExemplars.subquery.columnMetadata });
    querySpy = sandbox
      .stub(fakeConnection, 'query')
      .resolves(soqlQueryExemplars.subQuery.queryResult as unknown as QueryResult<any>);
    const results = await runSoqlQuery(
      fakeConnection,
      'SELECT Name, ( SELECT LastName FROM Contacts ) FROM Account',
      logger,
      new Ux()
    );
    sinon.assert.calledOnce(querySpy);
    expect(results).to.be.deep.equal(soqlQueryExemplars.subQuery.soqlQueryResult);
  });
  it('should handle empty query', async () => {
    requestSpy = sandbox.stub(fakeConnection, 'request');
    querySpy = sandbox.stub(fakeConnection, 'query').resolves(soqlQueryExemplars.emptyQuery.queryResult);
    const results = await runSoqlQuery(
      fakeConnection,
      "SELECT Name FROM Contact where name = 'some nonexistent name'",
      logger,
      new Ux()
    );
    sinon.assert.calledOnce(querySpy);
    sinon.assert.notCalled(requestSpy);
    expect(results).to.be.deep.equal(soqlQueryExemplars.emptyQuery.soqlQueryResult);
  });
});
