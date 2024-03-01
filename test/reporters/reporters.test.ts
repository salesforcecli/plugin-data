/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { renameAggregates } from '../../src/reporters/reporters.js';
import { Field, FieldType } from '../../src/dataSoqlQueryTypes.js';

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
    const aggregates: Field[] = [{ fieldType: FieldType.functionField, name: 'avg(AnnualRevenue)', alias: 'Avg Rev' }];
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
