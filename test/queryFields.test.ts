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

import sinon = require('sinon');
import { retrieveColumns } from '../src/commands/data/query';
import * as TestUtil from './testUtil';
import { queryFieldsExemplars } from './test-files/queryFields.exemplars';

chai.use(chaiAsPromised);

describe('queryFields tests', () => {
  const fakeConnection = TestUtil.createFakeConnection();
  const sandbox = sinon.createSandbox();
  afterEach(() => {
    sandbox.restore();
  });

  it('should handle a query with just fields', async () => {
    sandbox
      .stub(fakeConnection, 'request')
      .resolves({ columnMetadata: queryFieldsExemplars.simpleQuery.columnMetadata });
    const results = await retrieveColumns(fakeConnection, 'SELECT id, name FROM Contact');
    expect(results).to.be.deep.equal(queryFieldsExemplars.simpleQuery.columns);
  });
  it('should handle a query with a subquery with both having just fields', async () => {
    sandbox.stub(fakeConnection, 'request').resolves({ columnMetadata: queryFieldsExemplars.subquery.columnMetadata });
    const results = await retrieveColumns(
      fakeConnection,
      'SELECT Name, ( SELECT LastName FROM Contacts ) FROM Account'
    );
    expect(results).to.be.deep.equal(queryFieldsExemplars.subquery.columns);
  });
  it('should handle a query with aggregate fields', async () => {
    sandbox
      .stub(fakeConnection, 'request')
      .resolves({ columnMetadata: queryFieldsExemplars.aggregateQuery.columnMetadata });
    const results = await retrieveColumns(
      fakeConnection,
      'SELECT CampaignId, AVG(Amount) FROM Opportunity GROUP BY CampaignId'
    );
    expect(results).to.be.deep.equal(queryFieldsExemplars.aggregateQuery.columns);
  });
  it('should handle a query with column join', async () => {
    sandbox
      .stub(fakeConnection, 'request')
      .resolves({ columnMetadata: queryFieldsExemplars.queryWithJoin.columnMetadata });
    const results = await retrieveColumns(fakeConnection, 'SELECT Name, Owner.Name FROM Account');
    expect(results).to.be.deep.equal(queryFieldsExemplars.queryWithJoin.columns);
  });
});
