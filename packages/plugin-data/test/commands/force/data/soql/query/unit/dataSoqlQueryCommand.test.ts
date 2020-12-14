/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-shadow-restricted-names */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { expect, test } from '@salesforce/command/lib/test';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { SoqlQuery } from '@salesforce/data';
import { soqlQueryExemplars } from '@salesforce/data/test/soqlQuery.exemplars';
// import { Connection, QueryResult } from 'jsforce';
//
// import { AuthInfo, AuthInfoConfig, Logger, Org } from '@salesforce/core';
import sinon = require('sinon');
// import * as TestUtil from '@salesforce/data';
// import { CsvReporter, HumanReporter } from '../../../../../../../lib/reporters';

chai.use(chaiAsPromised);

const QUERY_COMMAND = 'force:data:soql:query';

describe('Execute a SOQL statement', function (): void {
  let sandbox: any;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });
  describe('handle query results', () => {
    let soqlQuerySpy: any;
    describe('handle empty results', () => {
      beforeEach(() => {
        soqlQuerySpy = sandbox
          .stub(SoqlQuery.prototype, 'runSoqlQuery')
          .callsFake(() => Promise.resolve(soqlQueryExemplars.emptyQuery.soqlQueryResult));
      });
      afterEach(() => {
        sandbox.restore();
      });
      test
        .withOrg({ username: 'test@org.com' }, true)
        .stdout()
        .stderr()
        .command([QUERY_COMMAND, '--targetusername', 'test@org.com', '--query', 'select '])
        .it('should have empty results', (ctx) => {
          sinon.assert.calledOnce(soqlQuerySpy);
          expect(ctx.stdout).to.include('records retrieved: 0');
        });
      test
        .withOrg({ username: 'test@org.com' }, true)
        .stdout()
        .stderr()
        .command([QUERY_COMMAND, '--targetusername', 'test@org.com', '--query', 'select ', '--resultformat', 'json'])
        .it('should have 0 totalSize and 0 records for empty result with json reporter', (ctx) => {
          sinon.assert.calledOnce(soqlQuerySpy);
          const jsonResults = JSON.parse(ctx.stdout);
          expect(jsonResults).to.have.property('status', 0);
          expect(jsonResults.result.data).to.have.property('totalSize', 0);
          expect(jsonResults.result.data.records.length).to.be.equal(jsonResults.result.data.totalSize);
        });
    });
    describe('reporters produce the correct results', () => {
      beforeEach(() => {
        soqlQuerySpy = sandbox
          .stub(SoqlQuery.prototype, 'runSoqlQuery')
          .callsFake(() => Promise.resolve(soqlQueryExemplars.simpleQuery.soqlQueryResult));
      });
      afterEach(() => {
        sandbox.restore();
      });
      test
        .withOrg({ username: 'test@org.com' }, true)
        .stdout()
        .stderr()
        .command([QUERY_COMMAND, '--targetusername', 'test@org.com', '--query', 'select ', '--resultformat', 'csv'])
        .it('should have csv results', (ctx) => {
          sinon.assert.calledOnce(soqlQuerySpy);
          expect(ctx.stdout).to.include('Id,Name\n003B000000DkDswIAF,Matteo Crippa\n');
        });
      test
        .withOrg({ username: 'test@org.com' }, true)
        .stdout()
        .stderr()
        .command([QUERY_COMMAND, '--targetusername', 'test@org.com', '--query', 'select ', '--resultformat', 'json'])
        .it('should have json results', (ctx) => {
          sinon.assert.calledOnce(soqlQuerySpy);
          const jsonResults = JSON.parse(ctx.stdout);
          expect(jsonResults).to.have.property('status', 0);
          expect(jsonResults.result.data).to.have.property('totalSize', 1);
          expect(jsonResults.result.data.records.length).to.be.equal(jsonResults.result.data.totalSize);
        });
    });
  });
});
