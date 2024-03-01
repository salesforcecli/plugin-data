/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import {
  parseFields,
  prepNullValues,
  nullString,
  mapFieldsByName,
  massageJson,
  maybeMassageSubqueries,
} from '../../src/reporters/humanReporter.js';
import { soqlQueryExemplars } from '../test-files/soqlQuery.exemplars.js';

describe('human reporter tests', () => {
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
      const queryData = soqlQueryExemplars.queryWithAggregates.soqlQueryResult;
      const { attributeNames, children, aggregates } = parseFields(queryData.columns);
      expect(attributeNames).to.deep.equal(['Name', queryData.columns[1].name]);
      expect(children).to.deep.equal([]);
      expect(aggregates).to.deep.equal([queryData.columns[1]]);
    });
    it('complex', () => {
      const { attributeNames, children, aggregates } = parseFields(
        soqlQueryExemplars.complexSubQuery.soqlQueryResult.columns
      );
      expect(attributeNames).to.deep.equal([
        'Amount',
        'Id',
        'Name',
        'StageName',
        'CloseDate',
        'OpportunityLineItems.Id',
        'OpportunityLineItems.ListPrice',
        'OpportunityLineItems.PricebookEntry.UnitPrice',
        'OpportunityLineItems.PricebookEntry.Name',
        'OpportunityLineItems.PricebookEntry.Id',
        'OpportunityLineItems.PricebookEntry.Product2.Family',
      ]);
      expect(children).to.deep.equal(['OpportunityLineItems']);
      expect(aggregates).to.deep.equal([]);
    });
  });

  describe('stringifies JSON results correctly', () => {
    it('no changes to basic record', () => {
      const queryData = soqlQueryExemplars.simpleQuery.soqlQueryResult;
      const massagedRows = queryData.result.records.map(massageJson(mapFieldsByName(queryData.columns)));
      expect(massagedRows).to.deep.equal(queryData.result.records);
    });
    it('nested object', () => {
      const queryData = structuredClone(soqlQueryExemplars.queryWithNestedObject.soqlQueryResult);
      const massagedRows = queryData.result.records.map(massageJson(mapFieldsByName(queryData.columns)));
      expect(massagedRows).to.not.include('object Object');
      massagedRows.map((r, i) => {
        const original = queryData.result.records[i];
        expect(r.Metadata).to.equal(JSON.stringify(original.Metadata, null, 2));
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
  describe('subqueries', () => {
    it('parses result fields', () => {
      const queryData = soqlQueryExemplars.subQuery.soqlQueryResult;
      const { attributeNames, children, aggregates } = parseFields(queryData.columns);
      expect(attributeNames).to.be.ok;
      expect(children).to.deep.equal(['Contacts']);
      expect(aggregates).to.be.ok;
    });
    it('has no subqueries => no change', () => {
      const queryData = soqlQueryExemplars.simpleQuery.soqlQueryResult;
      const { children } = parseFields(queryData.columns);
      expect(children).to.deep.equal([]);
      const result = queryData.result.records.flatMap(maybeMassageSubqueries(children));
      expect(result).to.deep.equal(queryData.result.records);
    });
    it('creates correct parent and child rows for parent', () => {
      const queryData = soqlQueryExemplars.subQuery.soqlQueryResult;
      const { children } = parseFields(queryData.columns);
      const result = queryData.result.records.flatMap(maybeMassageSubqueries(children));
      // parent with 1 child
      const index = result.findIndex((r) => r.Name === 'United Oil & Gas, Singapore');
      expect(result[index]).to.have.property('Contacts.LastName', 'Ripley');
      // child
      expect(result[index + 1]).to.have.property('Contacts.LastName', "D'Cruz");

      // parent with 4 children
      const index2 = result.findIndex((r) => r.Name === 'United Oil & Gas Corp.');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      expect(result.slice(index2, index2 + 4).map((r) => r['Contacts.LastName'])).to.deep.equal([
        'Pavlova',
        'Boyle',
        'Green',
        'Song',
      ]);
    });
    it('complex', () => {
      const queryData = soqlQueryExemplars.complexSubQuery.soqlQueryResult;
      const { children } = parseFields(queryData.columns);
      const result = queryData.result.records.flatMap(maybeMassageSubqueries(children));
      expect(result.length).to.equal(1);
      // it fully expands the fields and gets the correct value
      expect(result[0]).to.have.property('OpportunityLineItems.PricebookEntry.Product2.Family', 'None');
      expect(result[0]).to.have.property('OpportunityLineItems.PricebookEntry.UnitPrice', 1300);
    });
  });
});
