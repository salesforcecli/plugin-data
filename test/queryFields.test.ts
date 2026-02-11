/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect } from 'chai';

import sinon from 'sinon';
import { retrieveColumns } from '../src/commands/data/query.js';
import { queryFieldsExemplars } from './test-files/queryFields.exemplars.js';
import { createFakeConnection } from './testUtil.js';

describe('queryFields tests', () => {
  const fakeConnection = createFakeConnection();
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
