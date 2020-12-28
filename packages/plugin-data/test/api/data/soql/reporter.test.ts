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
import { soqlQueryExemplars } from '../../../api/data/soql/test-files/soqlQuery.exemplars';
import { DataSoqlQueryResult } from '../../../../src/api/data/soql/dataSoqlQueryTypes';
import { HumanReporter } from '../../../../src/api/data/soql/reporters';
import { CsvReporter } from '../../../../src/api/data/soql/reporters';
import { SoqlQueryResult } from '../../../../src/api/data/soql/soqlQuery';
import { Field } from '../../../../src/api/data/soql/queryFields';

chai.use(chaiAsPromised);

describe('reporter tests', () => {
  const logger = Logger.childFromRoot('reporterTest');
  describe('human reporter tests', () => {
    let reporter: HumanReporter;
    let queryData: SoqlQueryResult;
    beforeEach(async () => {
      queryData = soqlQueryExemplars.queryWithAgregates.soqlQueryResult;
      const dataSoqlQueryResult: DataSoqlQueryResult = {
        columns: queryData.columns,
        json: false,
        logger,
        query: queryData.query,
        result: queryData.result,
        resultFormat: 'human',
      };
      reporter = new HumanReporter(
        dataSoqlQueryResult,
        queryData.columns,
        await UX.create(),
        dataSoqlQueryResult.logger
      );
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
      const massagedRows = reporter.massageRows(queryData.result.records, children, aggregates);
      expect(massagedRows).to.be.deep.equal(queryData.result.records);
      reporter.prepNullValues(massagedRows);
      expect(massagedRows).to.be.ok;
    });
    it('preps columns for display values in result', () => {});
  });
  describe('csv reporter tests', () => {
    let reporter: CsvReporter;
    let queryData: SoqlQueryResult;
    beforeEach(async () => {
      queryData = soqlQueryExemplars.queryWithAgregates.soqlQueryResult;
      const dataSoqlQueryResult: DataSoqlQueryResult = {
        columns: queryData.columns,
        json: false,
        logger,
        query: queryData.query,
        result: queryData.result,
        resultFormat: 'csv',
      };
      reporter = new CsvReporter(dataSoqlQueryResult, queryData.columns, await UX.create(), dataSoqlQueryResult.logger);
    });
    it('massages report results', () => {
      const massagedRows = reporter.massageRows();
      const data = Reflect.get(reporter, 'data');
      expect(massagedRows).to.be.deep.equal(
        soqlQueryExemplars.queryWithAgregates.soqlQueryResult.columns.map((column: Field) => column.name)
      );
      expect(data.result.records).be.equal(soqlQueryExemplars.queryWithAgregates.soqlQueryResult.result.records);
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
      const dataSoqlQueryResult: DataSoqlQueryResult = {
        columns: queryData.columns,
        json: false,
        logger,
        query: queryData.query,
        result: queryData.result,
        resultFormat: 'human',
      };
      reporter = new HumanReporter(
        dataSoqlQueryResult,
        queryData.columns,
        await UX.create(),
        dataSoqlQueryResult.logger
      );
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
      const dataSoqlQueryResult: DataSoqlQueryResult = {
        columns: queryData.columns,
        json: false,
        logger,
        query: queryData.query,
        result: queryData.result,
        resultFormat: 'csv',
      };
      reporter = new CsvReporter(dataSoqlQueryResult, queryData.columns, await UX.create(), dataSoqlQueryResult.logger);
    });
    it('massages report results', () => {
      const massagedRows = reporter.massageRows();
      const data = Reflect.get(reporter, 'data');
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
      expect(data.result.records).be.equal(soqlQueryExemplars.subQuery.soqlQueryResult.result.records);
    });
  });
});
