/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@salesforce/command/lib/test';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { UX } from '@salesforce/command';
import { Logger } from '@salesforce/core';
import { get, getPlainObject } from '@salesforce/ts-types';
import { createSandbox } from 'sinon';
import { Field, SoqlQueryResult } from '../src/dataSoqlQueryTypes';
import { CsvReporter, HumanReporter } from '../src/reporters';
import { soqlQueryExemplars } from './test-files/soqlQuery.exemplars';

chai.use(chaiAsPromised);

describe('reporter tests', () => {
  const logger = Logger.childFromRoot('reporterTest');
  describe('human reporter tests', () => {
    let reporter: HumanReporter;
    let queryData: SoqlQueryResult;
    beforeEach(async () => {
      queryData = soqlQueryExemplars.queryWithAgregates.soqlQueryResult;
      const dataSoqlQueryResult: SoqlQueryResult = {
        columns: queryData.columns,
        query: queryData.query,
        result: queryData.result,
      };
      reporter = new HumanReporter(dataSoqlQueryResult, queryData.columns, await UX.create(), logger);
    });
    it('parses result fields', () => {
      const { attributeNames, children, aggregates } = reporter.parseFields();
      expect(attributeNames).to.be.ok;
      expect(children).to.be.ok;
      expect(aggregates).to.be.ok;
    });
    it('preps null values in result', () => {
      const { attributeNames, children, aggregates } = reporter.parseFields();
      expect(attributeNames).to.be.ok;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const massagedRows = reporter.massageRows(queryData.result.records, children, aggregates);
      expect(massagedRows).to.be.deep.equal(queryData.result.records);
      reporter.prepNullValues(massagedRows);
      expect(massagedRows).to.be.ok;
    });

    it('stringifies JSON results correctly', async () => {
      queryData = soqlQueryExemplars.queryWithNestedObject.soqlQueryResult;
      const dataSoqlQueryResult: SoqlQueryResult = {
        columns: queryData.columns,
        query: queryData.query,
        result: queryData.result,
      };
      const sb = createSandbox();
      const reflectSpy = sb.spy(Reflect, 'set');
      reporter = new HumanReporter(dataSoqlQueryResult, queryData.columns, await UX.create(), logger);
      const { attributeNames, children, aggregates } = reporter.parseFields();
      expect(attributeNames).to.be.ok;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const massagedRows = reporter.massageRows(queryData.result.records, children, aggregates);
      expect(massagedRows).to.be.deep.equal(queryData.result.records);
      reporter.prepNullValues(massagedRows);
      expect(massagedRows).to.be.ok;
      // would be called 6 times if not called on Reporter~prepNullValues L116
      expect(reflectSpy.callCount).to.equal(12);
      expect(massagedRows).to.not.include('object Object');
    });

    it('preps columns for display values in result', () => {});
  });
  describe('csv reporter tests', () => {
    let reporter: CsvReporter;
    let queryData: SoqlQueryResult;
    beforeEach(async () => {
      queryData = soqlQueryExemplars.queryWithAgregates.soqlQueryResult;
      const dataSoqlQueryResult: SoqlQueryResult = {
        columns: queryData.columns,
        query: queryData.query,
        result: queryData.result,
      };
      reporter = new CsvReporter(dataSoqlQueryResult, queryData.columns, await UX.create(), logger);
    });

    it('stringifies JSON results correctly', async () => {
      queryData = soqlQueryExemplars.queryWithNestedObject.soqlQueryResult;
      const dataSoqlQueryResult: SoqlQueryResult = {
        columns: queryData.columns,
        query: queryData.query,
        result: queryData.result,
      };
      const sb = createSandbox();
      reporter = new CsvReporter(dataSoqlQueryResult, queryData.columns, await UX.create(), logger);
      const escapeSpy = sb.spy(reporter, 'escape');
      const logStub = sb.stub(reporter, 'log');

      const massagedRows = reporter.massageRows();
      const data = getPlainObject(reporter, 'data');
      reporter.display();
      // callCount would be 5 if were printing '[object Object]' instead of the string representation
      expect(escapeSpy.callCount).to.equal(8);
      expect(logStub.called).to.be.true;
      expect(massagedRows).to.be.deep.equal(
        soqlQueryExemplars.queryWithNestedObject.soqlQueryResult.columns.map((column: Field) => column.name)
      );
      expect(get(data, 'result.records')).be.equal(
        soqlQueryExemplars.queryWithNestedObject.soqlQueryResult.result.records
      );
    });

    it('massages report results', () => {
      const massagedRows = reporter.massageRows();
      const data = getPlainObject(reporter, 'data');
      expect(massagedRows).to.be.deep.equal(
        soqlQueryExemplars.queryWithAgregates.soqlQueryResult.columns.map((column: Field) => column.name)
      );
      expect(get(data, 'result.records')).be.equal(
        soqlQueryExemplars.queryWithAgregates.soqlQueryResult.result.records
      );
    });
    it('escapes embedded separator', () => {
      let escapedString = reporter.escape('"a,b,c"');
      expect(escapedString).to.be.equal('"""a,b,c"""');
      escapedString = reporter.escape('a,b,c');
      expect(escapedString).to.be.equal('"a,b,c"');
    });
    it('noop escape with no embedded separator', () => {
      const escapedString = reporter.escape('abc');
      expect(escapedString).to.be.equal('abc');
    });
  });
  describe('handles subqueries for human result', () => {
    let reporter: HumanReporter;
    let queryData: SoqlQueryResult;
    beforeEach(async () => {
      queryData = soqlQueryExemplars.subQuery.soqlQueryResult;
      const dataSoqlQueryResult: SoqlQueryResult = {
        columns: queryData.columns,
        query: queryData.query,
        result: queryData.result,
      };
      reporter = new HumanReporter(dataSoqlQueryResult, queryData.columns, await UX.create(), logger);
    });
    it('parses result fields', () => {
      const { attributeNames, children, aggregates } = reporter.parseFields();
      expect(attributeNames).to.be.ok;
      expect(children).to.be.ok;
      expect(aggregates).to.be.ok;
    });
  });
  describe('handles subqueries for csv', () => {
    let reporter: CsvReporter;
    let queryData: SoqlQueryResult;
    beforeEach(async () => {
      queryData = soqlQueryExemplars.subQuery.soqlQueryResult;
      const dataSoqlQueryResult: SoqlQueryResult = {
        columns: queryData.columns,
        query: queryData.query,
        result: queryData.result,
      };
      reporter = new CsvReporter(dataSoqlQueryResult, queryData.columns, await UX.create(), logger);
    });
    it('massages report results', () => {
      const massagedRows = reporter.massageRows();
      const data = get(reporter, 'data');
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
      expect(get(data, 'result.records')).be.equal(soqlQueryExemplars.subQuery.soqlQueryResult.result.records);
    });
  });
});
