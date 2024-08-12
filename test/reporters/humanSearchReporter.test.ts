/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubUx } from '@salesforce/sf-plugins-core';
import { HumanSearchReporter } from '../../src/reporters/search/humanSearchReporter.js';

describe('human search reporter', () => {
  const $$ = new TestContext();
  let commandStubs: ReturnType<typeof stubUx>;

  beforeEach(() => {
    commandStubs = stubUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.SANDBOX.restore();
  });

  it('will write two tables', () => {
    const reporter = new HumanSearchReporter({
      searchRecords: [
        {
          attributes: {
            type: 'Account',
            url: '/services/data/v61.0/sobjects/Account/0017X00001Av4xPQAR',
          },
          Name: 'Jones',
          Industry: 'Apparel',
        },
        {
          attributes: {
            type: 'Contact',
            url: '/services/data/v61.0/sobjects/Contact/0037X000012i5QzQAI',
          },
          FirstName: 'Bry',
          LastName: 'Jones',
          Department: null,
        },
        {
          attributes: {
            type: 'Contact',
            url: '/services/data/v61.0/sobjects/Contact/0037X000012i5QuQAI',
          },
          FirstName: 'Bob',
          LastName: 'Jones',
          Department: null,
        },
      ],
    });

    reporter.display();

    // two objects, two tables
    expect(commandStubs.table.callCount).to.equal(2);
    expect(Object.keys(commandStubs.table.args[0][1])).to.deep.equal(['Name', 'Industry']);
    expect(commandStubs.table.args[0][2]?.title).to.equal('Account Results');
    expect(Object.keys(commandStubs.table.args[1][1])).to.deep.equal(['FirstName', 'LastName', 'Department']);
    expect(commandStubs.table.args[1][2]?.title).to.equal('Contact Results');
  });

  it('will not print a table for no results', () => {
    const reporter = new HumanSearchReporter({
      searchRecords: [],
    });

    reporter.display();
    expect(commandStubs.log.firstCall.firstArg).to.equal('No Records Found');
  });
});
