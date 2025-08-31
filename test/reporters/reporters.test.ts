/*
 * Copyright 2025, Salesforce, Inc.
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
import { renameAggregates } from '../../src/reporters/query/reporters.js';
import { Field, FieldType } from '../../src/types.js';

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
      expr0: 950_000_000,
    };
    expect(renameAggregates(aggregates)(record)).to.be.deep.equal({
      attributes: {
        type: 'AggregateResult',
      },
      Name: 'Pyramid Construction Inc.',
      'avg(AnnualRevenue)': 950_000_000,
    });
  });
  it('has only a aliased aggregate', () => {
    const aggregates: Field[] = [{ fieldType: FieldType.functionField, name: 'avg(AnnualRevenue)', alias: 'Avg Rev' }];
    const record = {
      attributes: {
        type: 'AggregateResult',
      },
      Name: 'Pyramid Construction Inc.',
      expr0: 950_000_000,
    };
    expect(renameAggregates(aggregates)(record)).to.be.deep.equal({
      attributes: {
        type: 'AggregateResult',
      },
      Name: 'Pyramid Construction Inc.',
      'Avg Rev': 950_000_000,
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
      expr0: 950_000_000,
      expr1: 950_000,
    };
    expect(renameAggregates(aggregates)(record)).to.be.deep.equal({
      attributes: {
        type: 'AggregateResult',
      },
      Name: 'Pyramid Construction Inc.',
      'Total Rev': 950_000_000,
      'avg(AnnualRevenue)': 950_000,
    });
  });
});
