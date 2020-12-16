/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable */
import { expect } from '@salesforce/command/lib/test';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { soqlQueryExemplars } from '@salesforce/data/test/soqlQuery.exemplars';
import sinon = require('sinon');
import { UX } from '@salesforce/command';
import { DataSoqlQueryResult } from '../lib/dataSoqlQueryTypes';
import { Logger } from '@salesforce/core';
import { HumanReporter } from '../src/reporters';
import { SoqlQueryResult } from '@salesforce/data';
import { CsvReporter } from '../lib/reporters';

chai.use(chaiAsPromised);

describe('reporter tests', () => {
  const logger = Logger.childFromRoot('reporterTest');
  let sandbox: any;
  describe('human reporter tests', () => {
    let reporter: HumanReporter;
    let queryData: SoqlQueryResult;
    beforeEach(async () => {
      sandbox = sinon.createSandbox();
      queryData = soqlQueryExemplars.queryWithAgregates.soqlQueryResult;
      const dataSoqlQueryResult: DataSoqlQueryResult = {
        columns: queryData.columns,
        json: false,
        logger: logger,
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
    afterEach(() => {
      sandbox.restore();
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
      sandbox = sinon.createSandbox();
      queryData = soqlQueryExemplars.queryWithAgregates.soqlQueryResult;
      const dataSoqlQueryResult: DataSoqlQueryResult = {
        columns: queryData.columns,
        json: false,
        logger: logger,
        query: queryData.query,
        result: queryData.result,
        resultFormat: 'csv',
      };
      reporter = new CsvReporter(dataSoqlQueryResult, queryData.columns, await UX.create(), dataSoqlQueryResult.logger);
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('massages report results', () => {
      const massagedRows = reporter.massageRows();
      const data = Reflect.get(reporter, 'data');
      expect(massagedRows).to.be.deep.equal(
        soqlQueryExemplars.queryWithAgregates.soqlQueryResult.columns.map((column) => column.name)
      );
      expect(data.result.records).be.equal(soqlQueryExemplars.queryWithAgregates.soqlQueryResult.result.records);
    });
  });
});
