/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { get, getPlainObject } from '@salesforce/ts-types';
import sinon from 'sinon';
import { ux } from '@oclif/core';
import {
  parseFields,
  prepNullValues,
  nullString,
  mapFieldsByName,
  renameAggregates,
  massageJson,
} from '../src/reporters/humanReporter.js';
import { Field, FieldType, SoqlQueryResult } from '../src/dataSoqlQueryTypes.js';
import { CsvReporter, escape } from '../src/reporters/csvReporter.js';
import { soqlQueryExemplars } from './test-files/soqlQuery.exemplars.js';

chaiUse(chaiAsPromised);

describe('reporter tests', () => {
  describe('human reporter tests', () => {
    let queryData: SoqlQueryResult;
    beforeEach(async () => {
      // jsforce has records/attributes/url as a non-optional property.  It may not be!
      queryData = structuredClone(soqlQueryExemplars.queryWithAggregates.soqlQueryResult) as unknown as SoqlQueryResult;
    });
    describe('column parsing', () => {
      it('basic query', () => {
        const { attributeNames, children, aggregates } = parseFields(
          soqlQueryExemplars.simpleQuery.soqlQueryResult.columns
        );
        expect(attributeNames).to.deep.equal(['Id', 'Name']);
        expect(children).to.deep.equal([]);
        expect(aggregates).to.deep.equal([]);
      });
      it('parses result fields', () => {
        const { attributeNames, children, aggregates } = parseFields(queryData.columns);
        expect(attributeNames).to.deep.equal(['Name', queryData.columns[1].name]);
        expect(children).to.deep.equal([]);
        expect(aggregates).to.deep.equal([queryData.columns[1]]);
      });
    });

    describe('stringifies JSON results correctly', () => {
      it('nested object', async () => {
        queryData = structuredClone(soqlQueryExemplars.queryWithNestedObject.soqlQueryResult);

        const massagedRows = queryData.result.records.map(massageJson(mapFieldsByName(queryData.columns)));

        expect(massagedRows).to.not.include('object Object');
        massagedRows.map((r, i) => {
          const original = queryData.result.records[i];
          expect(r.Metadata).to.equal(JSON.stringify(original.Metadata, null, 2));
        });
      });
    });

    describe('rename aggregates', () => {
      it('has no aggregates', () => {
        const aggregates: Field[] = [];
        const record = { a: 1, b: 2, c: 3 };
        expect(renameAggregates(aggregates)(record)).to.be.deep.equal(record);
      });
      it('has only an non-aliased aggregate', () => {
        const aggregates: Field[] = [{ fieldType: FieldType.functionField, name: 'avg(AnnualRevenue)' }];
        const record = {
          attributes: {
            type: 'AggregateResult',
          },
          Name: 'Pyramid Construction Inc.',
          expr0: 950000000,
        };
        expect(renameAggregates(aggregates)(record)).to.be.deep.equal({
          attributes: {
            type: 'AggregateResult',
          },
          Name: 'Pyramid Construction Inc.',
          'avg(AnnualRevenue)': 950000000,
        });
      });
      it('has only a aliased aggregate', () => {
        const aggregates: Field[] = [
          { fieldType: FieldType.functionField, name: 'avg(AnnualRevenue)', alias: 'Avg Rev' },
        ];
        const record = {
          attributes: {
            type: 'AggregateResult',
          },
          Name: 'Pyramid Construction Inc.',
          expr0: 950000000,
        };
        expect(renameAggregates(aggregates)(record)).to.be.deep.equal({
          attributes: {
            type: 'AggregateResult',
          },
          Name: 'Pyramid Construction Inc.',
          'Avg Rev': 950000000,
        });
      });
      it('has an aggregate of each type', () => {
        const aggregates: Field[] = [
          { fieldType: FieldType.functionField, name: 'sum(AnnualRevenue)', alias: 'Total Rev' },
          { fieldType: FieldType.functionField, name: 'avg(AnnualRevenue)' },
        ];
        const record = {
          attributes: {
            type: 'AggregateResult',
          },
          Name: 'Pyramid Construction Inc.',
          expr0: 950000000,
          expr1: 950000,
        };
        expect(renameAggregates(aggregates)(record)).to.be.deep.equal({
          attributes: {
            type: 'AggregateResult',
          },
          Name: 'Pyramid Construction Inc.',
          'Total Rev': 950000000,
          'avg(AnnualRevenue)': 950000,
        });
      });
    });
    describe('null value prep', () => {
      it('queryWithNestedObject', () => {
        soqlQueryExemplars.queryWithNestedObject.soqlQueryResult.result.records.map(prepNullValues).map((r) => {
          expect(r.Metadata.urls, JSON.stringify(r.Metadata)).to.equal(nullString);
          expect(r.Metadata.description, JSON.stringify(r.Metadata)).to.equal(nullString);
          return undefined;
        });
      });
      it('queryWithAggregates', () => {
        const result = soqlQueryExemplars.queryWithAggregates.soqlQueryResult.result.records
          .map(prepNullValues)
          .filter((r) => typeof r.expr0 !== 'number');

        expect(result.length).to.be.greaterThan(5);
        result.map((r) => {
          expect(r.expr0).to.equal(nullString);
        });
      });
      it('subQuery', () => {
        const result = soqlQueryExemplars.subQuery.soqlQueryResult.result.records
          .map(prepNullValues)
          .filter((r) => typeof r.Contacts?.totalSize !== 'number');

        result.map((r) => {
          expect(r.Contacts).to.equal(nullString);
        });
      });
    });

    it('preps columns for display values in result', () => {});
  });
  describe('csv reporter tests', () => {
    let reporter: CsvReporter;
    let queryData: SoqlQueryResult;
    beforeEach(async () => {
      //
      queryData = soqlQueryExemplars.queryWithAggregates.soqlQueryResult as unknown as SoqlQueryResult;
      const dataSoqlQueryResult: SoqlQueryResult = {
        columns: queryData.columns,
        query: queryData.query,
        result: queryData.result,
      };
      reporter = new CsvReporter(dataSoqlQueryResult, queryData.columns);
    });

    it('stringifies JSON results correctly', async () => {
      queryData = soqlQueryExemplars.queryWithNestedObject.soqlQueryResult;
      const dataSoqlQueryResult: SoqlQueryResult = {
        columns: queryData.columns,
        query: queryData.query,
        result: queryData.result,
      };
      const sb = sinon.createSandbox();
      reporter = new CsvReporter(dataSoqlQueryResult, queryData.columns);
      const logStub = sb.stub(ux, 'log');

      const massagedRows = reporter.massageRows();
      const data = getPlainObject(reporter, 'data');
      reporter.display();
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
        soqlQueryExemplars.queryWithAggregates.soqlQueryResult.columns.map((column: Field) => column.name)
      );
      expect(get(data, 'result.records')).be.equal(
        soqlQueryExemplars.queryWithAggregates.soqlQueryResult.result.records
      );
    });
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
  describe('handles subqueries for human result', () => {
    let queryData: SoqlQueryResult;
    beforeEach(async () => {
      queryData = soqlQueryExemplars.subQuery.soqlQueryResult;
    });
    it('parses result fields', () => {
      const { attributeNames, children, aggregates } = parseFields(queryData.columns);
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
      reporter = new CsvReporter(dataSoqlQueryResult, queryData.columns);
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
