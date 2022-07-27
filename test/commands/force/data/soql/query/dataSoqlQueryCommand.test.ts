/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@salesforce/command/lib/test';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { SinonSandbox } from 'sinon';
import { describe } from 'mocha';
import sinon = require('sinon');
import { SoqlQuery } from '../../../../../../src/commands/force/data/soql/query';
import { soqlQueryExemplars } from '../../../../../test-files/soqlQuery.exemplars';

chai.use(chaiAsPromised);

const QUERY_COMMAND = 'force:data:soql:query';

interface QueryResult {
  status: string;
  result: { totalSize: number; records: [] };
}

describe('Execute a SOQL statement', function (): void {
  let sandbox: SinonSandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });
  describe('handle query results', () => {
    let soqlQuerySpy: sinon.SinonSpy;
    describe('handle empty results', () => {
      beforeEach(() => {
        soqlQuerySpy = sandbox
          .stub(SoqlQuery.prototype, 'runSoqlQuery')
          .resolves(soqlQueryExemplars.emptyQuery.soqlQueryResult);
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
          const jsonResults = JSON.parse(ctx.stdout) as QueryResult;
          expect(jsonResults).to.have.property('status', 0);
          expect(jsonResults.result).to.have.property('totalSize', 0);
          expect(jsonResults.result.records.length).to.be.equal(jsonResults.result.totalSize);
        });
    });
    describe('reporters produce the correct results for subquery', () => {
      beforeEach(() => {
        soqlQuerySpy = sandbox
          .stub(SoqlQuery.prototype, 'runSoqlQuery')
          .callsFake(() => Promise.resolve(soqlQueryExemplars.subqueryAccountsAndContacts.soqlQueryResult));
      });
      afterEach(() => {
        sandbox.restore();
      });
      test
        .withOrg({ username: 'test@org.com' }, true)
        .stdout()
        .command([QUERY_COMMAND, '--targetusername', 'test@org.com', '--query', 'select ', '--resultformat', 'csv'])
        .it('should have csv results', (ctx) => {
          sinon.assert.calledOnce(soqlQuerySpy);
          // test for expected snippet in output
          expect(ctx.stdout).to.include(
            'Contacts.totalSize,Contacts.records.3.LastName\n"Cisco Systems, Inc.",,,,,,,,\nASSMANN Electronic GmbH,,,,,,,,\n'
          );
        });
      test
        .withOrg({ username: 'test@org.com' }, true)
        .stdout()
        .stderr()
        .command([QUERY_COMMAND, '--targetusername', 'test@org.com', '--query', 'select ', '--resultformat', 'json'])
        .it('should have json results', (ctx) => {
          sinon.assert.calledOnce(soqlQuerySpy);
          const jsonResults = JSON.parse(ctx.stdout) as QueryResult;
          expect(jsonResults).to.have.property('status', 0);
          expect(jsonResults.result).to.have.property('totalSize', 50);
          expect(jsonResults.result.records.length).to.be.equal(jsonResults.result.totalSize);
        });
      test
        .withOrg({ username: 'test@org.com' }, true)
        .stdout()
        .stderr()
        .command([QUERY_COMMAND, '--targetusername', 'test@org.com', '--query', 'select ', '--resultformat', 'human'])
        .it('should have human results', (ctx) => {
          sinon.assert.calledOnce(soqlQuerySpy);
          // test for expected snippet in output
          const stdout = ctx.stdout;
          expect(/.*?United Oil & Gas, UK.*?James.*?/.test(stdout)).to.be.true;
          expect(ctx.stdout).to.include('records retrieved: 50');
        });
    });

    describe('human readable output for complex subqueries', () => {
      beforeEach(() => {
        soqlQuerySpy = sandbox
          .stub(SoqlQuery.prototype, 'runSoqlQuery')
          .resolves(soqlQueryExemplars.complexSubQuery.soqlQueryResult);
      });

      afterEach(() => {
        sandbox.restore();
      });

      test
        .withOrg({ username: 'test@org.com' }, true)
        .stdout()
        .stderr()
        .command([
          QUERY_COMMAND,
          '--targetusername',
          'test@org.com',
          '--query',
          'SELECT Amount, Id, Name,StageName, CloseDate, (SELECT Id,  ListPrice, PriceBookEntry.UnitPrice, PricebookEntry.Name, PricebookEntry.Id, PricebookEntry.product2.Family FROM OpportunityLineItems) FROM Opportunity',
        ])
        .it('should have human results for a complex subquery', (ctx) => {
          sinon.assert.calledOnce(soqlQuerySpy);
          // test for expected snippet in output
          const stdout = ctx.stdout;
          // properly expanded columns from query
          expect(
            /.*?AMOUNT.*?ID.*?OPPORTUNITYLINEITEMS.ID.*?OPPORTUNITYLINEITEMS.PRICEBOOKENTRY.PRODUCT2.FAMILY.*?/.test(
              stdout
            )
          ).to.be.true;
          // was able to parse the data for each column
          expect(
            /.*?1300.*?0063F00000RdvMKQAZ.*?My Opportunity.*?00k3F000007kBoDQAU.*?MyProduct.*?01u3F00000AwCfuQAF.*?/.test(
              stdout
            )
          ).to.be.true;
          expect(ctx.stdout).to.include('records retrieved: 1');
        });
    });
    describe('flag validation between --query and --soqlqueryfile', () => {
      test
        .withOrg({ username: 'test@org.com' }, true)
        .stderr()
        .command([
          QUERY_COMMAND,
          '--targetusername',
          'test@org.com',
          '--query',
          'SELECT Amount, Id, Name,StageName, CloseDate, (SELECT Id,  ListPrice, PriceBookEntry.UnitPrice, PricebookEntry.Name, PricebookEntry.Id, PricebookEntry.product2.Family FROM OpportunityLineItems) FROM Opportunity',
          '--soqlqueryfile',
          'soql.txt',
        ])
        .it('should throw an error when both query (inline/file query) flags are specified', (ctx) => {
          expect(ctx.stderr).to.include('--soqlqueryfile= cannot also be provided when using --query=');
        });
    });
    describe('reporters produce the correct aggregate query', () => {
      beforeEach(() => {
        soqlQuerySpy = sandbox
          .stub(SoqlQuery.prototype, 'runSoqlQuery')
          .resolves(soqlQueryExemplars.queryWithAgregates.soqlQueryResult);
      });
      afterEach(() => {
        sandbox.restore();
      });
      test
        .withOrg({ username: 'test@org.com' }, true)
        .stdout()
        .stderr()
        .command([QUERY_COMMAND, '--targetusername', 'test@org.com', '--query', 'select ', '--resultformat', 'json'])
        .it('should have json results', (ctx) => {
          sinon.assert.calledOnce(soqlQuerySpy);
          const jsonResults = JSON.parse(ctx.stdout) as QueryResult;
          expect(jsonResults).to.have.property('status', 0);
          expect(jsonResults.result).to.have.property('totalSize', 16);
          expect(jsonResults.result.records.length).to.be.equal(jsonResults.result.totalSize);
        });
      test
        .withOrg({ username: 'test@org.com' }, true)
        .stdout()
        .stderr()
        .command([QUERY_COMMAND, '--targetusername', 'test@org.com', '--query', 'select ', '--resultformat', 'human'])
        .it('should have human results', (ctx) => {
          sinon.assert.calledOnce(soqlQuerySpy);
          expect(/.*?United Oil & Gas Corp..*?5600000000.*/.test(ctx.stdout)).to.be.true;
          expect(ctx.stdout).to.include('records retrieved: 16');
        });
    });
  });
});
