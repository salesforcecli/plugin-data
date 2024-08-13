/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubUx } from '@salesforce/sf-plugins-core';
import { CsvSearchReporter } from '../../src/reporters/search/csvSearchReporter.js';

describe('CSV search reporter', () => {
  const $$ = new TestContext();
  let commandStubs: ReturnType<typeof stubUx>;

  beforeEach(() => {
    commandStubs = stubUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.SANDBOX.restore();
  });

  it('will write two csv files', () => {
    const writeFileStub = $$.SANDBOX.stub(fs, 'writeFileSync');
    const reporter = new CsvSearchReporter({
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

    expect(writeFileStub.callCount).to.equal(2);
    expect(writeFileStub.firstCall.args[0]).to.equal('Account.csv');
    expect(writeFileStub.firstCall.args[1]).to.include('Name,Industry');
    expect(writeFileStub.firstCall.args[1]).to.include('Jones,Apparel');
    expect(writeFileStub.secondCall.args[0]).to.include('Contact.csv');
    expect(commandStubs.log.callCount).to.equal(2);
  });
  it('will not write', () => {
    const reporter = new CsvSearchReporter({
      searchRecords: [],
    });

    reporter.display();

    // two objects, two tables
    expect(commandStubs.log.firstCall.firstArg).to.equal('No Records Found');
  });
});
