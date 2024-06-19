/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { get, getPlainObject } from '@salesforce/ts-types';
import sinon from 'sinon';
import { Ux } from '@salesforce/sf-plugins-core';

import { SoqlQueryResult } from '../../src/types.js';
import { CsvReporter, escape, getColumns, getMaxRecord } from '../../src/reporters/csvReporter.js';
import { soqlQueryExemplars } from '../test-files/soqlQuery.exemplars.js';

describe('reporter tests', () => {
  describe('csv reporter tests', () => {
    describe('getMaxRecord for subqueries', () => {
      it('complexSubQuery', () => {
        const records = soqlQueryExemplars.complexSubQuery.soqlQueryResult.result.records;
        expect(getMaxRecord(records)('OpportunityLineItems')).to.equal(1);
      });
      it('subQuery', () => {
        const records = soqlQueryExemplars.subQuery.soqlQueryResult.result.records;
        expect(getMaxRecord(records)('Contacts')).to.equal(4);
      });
    });
    describe('getColumns', () => {
      it('nestedObject', () => {
        expect(
          getColumns(soqlQueryExemplars.queryWithNestedObject.soqlQueryResult.result.records)(
            soqlQueryExemplars.queryWithNestedObject.soqlQueryResult.columns
          )
        ).to.deep.equal(['Id', 'Metadata']);
      });
      it('queryWithAggregates', () => {
        const queryResult = soqlQueryExemplars.queryWithAggregates.soqlQueryResult as unknown as SoqlQueryResult;
        expect(getColumns(queryResult.result.records)(queryResult.columns)).to.be.deep.equal([
          'Name',
          'avg(AnnualRevenue)',
        ]);
      });
      it('subQueries', () => {
        const massagedRows = getColumns(soqlQueryExemplars.subQuery.soqlQueryResult.result.records)(
          soqlQueryExemplars.subQuery.soqlQueryResult.columns
        );
        expect(massagedRows).to.be.deep.equal([
          'Name',
          'Contacts.totalSize',
          'Contacts.records.0.LastName',
          'Contacts.totalSize',
          'Contacts.records.1.LastName',
          'Contacts.totalSize',
          'Contacts.records.2.LastName',
          'Contacts.totalSize',
          'Contacts.records.3.LastName',
        ]);
      });
    });

    it('stringifies JSON results correctly', async () => {
      const queryData = structuredClone(soqlQueryExemplars.queryWithNestedObject.soqlQueryResult);
      const dataSoqlQueryResult: SoqlQueryResult = {
        columns: queryData.columns,
        query: queryData.query,
        result: queryData.result,
      };
      const sb = sinon.createSandbox();
      const reporter = new CsvReporter(dataSoqlQueryResult, queryData.columns);
      const logStub = sb.stub(Ux.prototype, 'log');

      reporter.display();

      // writes header row + 1 per record
      expect(logStub.callCount).to.equal(1 + queryData.result.records.length);
      // escapes the Metadata field which is an object
      expect(logStub.getCall(1).args[0]).to.include(escape(JSON.stringify(queryData.result.records[0].Metadata)));

      // no mutation of original results
      const data = getPlainObject(reporter, 'data');
      expect(get(data, 'result.records')).deep.equal(
        soqlQueryExemplars.queryWithNestedObject.soqlQueryResult.result.records
      );
    });

    describe('escaping', () => {
      it('escapes embedded separator', () => {
        let escapedString = escape('"a,b,c"');
        expect(escapedString).to.be.equal('"""a,b,c"""');
        escapedString = escape('a,b,c');
        expect(escapedString).to.be.equal('"a,b,c"');
      });
      it('noop escape with no embedded separator', () => {
        const escapedString = escape('abc');
        expect(escapedString).to.be.equal('abc');
      });
    });
  });
});
