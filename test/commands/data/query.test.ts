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

import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Config } from '@oclif/core/config';
import { captureOutput } from '@oclif/test';
import { OrgConfigProperties } from '@salesforce/core';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { expect, config as chaiConfig } from 'chai';
import { soqlQueryExemplars } from '../../test-files/soqlQuery.exemplars.js';
import { DataSoqlQueryCommand } from '../../../src/commands/data/query.js';
import { SoqlQueryResult } from '../../../src/types.js';

chaiConfig.truncateThreshold = 0;
describe('Execute a SOQL statement', (): void => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({
    root: resolve(dirname(fileURLToPath(import.meta.url)), '../../../package.json'),
  });

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    await $$.stubConfig({ [OrgConfigProperties.ORG_MAX_QUERY_LIMIT]: '2000' });
    await config.load();
  });
  afterEach(async () => {
    $$.restore();
  });

  describe('handle query results', () => {
    let soqlQuerySpy: sinon.SinonSpy;

    describe('handle empty results', () => {
      beforeEach(() => {
        // @ts-expect-error stubbing for testing
        soqlQuerySpy = $$.SANDBOX.stub(DataSoqlQueryCommand.prototype, 'runSoqlQuery').resolves(
          soqlQueryExemplars.emptyQuery.soqlQueryResult
        );
      });
      afterEach(() => {
        $$.SANDBOX.restore();
      });

      it('should have empty results', async () => {
        const { stdout, result } = await captureOutput<SoqlQueryResult['result']>(async () =>
          DataSoqlQueryCommand.run(['--target-org', 'test@org.com', '--query', 'select '], config)
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        expect(result).to.have.property('totalSize', 0);
        expect(result).to.have.property('records');
        expect(result?.records).to.have.length(0);
        expect(stdout).to.include('Total number of records retrieved: 0');
      });
    });

    describe('handle results with value 0', () => {
      beforeEach(() => {
        // @ts-expect-error stubbing for testing
        soqlQuerySpy = $$.SANDBOX.stub(DataSoqlQueryCommand.prototype, 'runSoqlQuery').resolves(
          soqlQueryExemplars.queryWithZeroFields.soqlQueryResult
        );
      });

      afterEach(() => {
        $$.SANDBOX.restore();
      });

      it('should have csv results', async () => {
        const { stdout } = await captureOutput<SoqlQueryResult['result']>(async () =>
          DataSoqlQueryCommand.run(
            ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'csv'],
            config
          )
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        expect(stdout).to.include('Dickenson Mobile Generators,0,1,0');
      });

      it('should have human results', async () => {
        const { stdout } = await captureOutput<SoqlQueryResult['result']>(async () =>
          DataSoqlQueryCommand.run(
            ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'human'],
            config
          )
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        expect(/.*?Dickenson Mobile Generators.*?0.*?0.*?/.test(stdout)).to.be.true;
      });
    });

    describe('reporters produce the correct results for subquery', () => {
      beforeEach(() => {
        // @ts-expect-error stubbing for testing
        soqlQuerySpy = $$.SANDBOX.stub(DataSoqlQueryCommand.prototype, 'runSoqlQuery').callsFake(() =>
          Promise.resolve(soqlQueryExemplars.subqueryAccountsAndContacts.soqlQueryResult)
        );
      });
      afterEach(() => {
        $$.SANDBOX.restore();
      });

      it('should have csv results', async () => {
        const { stdout } = await captureOutput<SoqlQueryResult['result']>(async () =>
          DataSoqlQueryCommand.run(
            ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'csv'],
            config
          )
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        expect(stdout).to.include(
          'Contacts.totalSize,Contacts.records.3.LastName\n"Cisco Systems, Inc.",,,,,,,,\nASSMANN Electronic GmbH,,,,,,,,\n'
        );
      });

      it('should have json results', async () => {
        const { result } = await captureOutput<SoqlQueryResult['result']>(async () =>
          DataSoqlQueryCommand.run(
            ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'json'],
            config
          )
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        expect(result).to.have.property('totalSize', 50);
        expect(result?.records.length).to.be.equal(result?.totalSize);
      });

      it('should have human results', async () => {
        const { stdout } = await captureOutput<SoqlQueryResult['result']>(async () =>
          DataSoqlQueryCommand.run(
            ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'human'],
            config
          )
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        expect(/.*?United Oil & Gas, UK.*?James.*?/.test(stdout)).to.be.true;
        expect(stdout).to.include('records retrieved: 50');
      });
    });

    describe('human readable output for complex subqueries', () => {
      beforeEach(() => {
        // @ts-expect-error stubbing for testing
        soqlQuerySpy = $$.SANDBOX.stub(DataSoqlQueryCommand.prototype, 'runSoqlQuery').resolves(
          soqlQueryExemplars.complexSubQuery.soqlQueryResult
        );
      });

      afterEach(() => {
        $$.SANDBOX.restore();
      });

      it('should have human results for a complex subquery.  [If this test fails, zoom out on your terminal to avoid truncation]', async () => {
        const { stdout } = await captureOutput<SoqlQueryResult['result']>(async () =>
          DataSoqlQueryCommand.run(
            [
              '--target-org',
              'test@org.com',
              '--query',
              'SELECT Amount, Id, Name,StageName, CloseDate, (SELECT Id,  ListPrice, PriceBookEntry.UnitPrice, PricebookEntry.Name, PricebookEntry.Id, PricebookEntry.product2.Family FROM OpportunityLineItems) FROM Opportunity',
            ],
            config
          )
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        // properly expanded columns from query
        expect(stdout).to.match(
          /.*?AMOUNT.*?ID.*?OPPORTUNITYLINEITEMS.ID.*?OPPORTUNITYLINEITEMS.PRICEBOOKENTRY.PRODUCT2.FAMILY.*?/
        );
        // was able to parse the data for each column
        expect(stdout).to.match(
          /.*?1300.*?0063F00000RdvMKQAZ.*?My Opportunity.*?00k3F000007kBoDQAU.*?MyProduct.*?01u3F00000AwCfuQAF.*?/
        );
        expect(stdout).to.include('records retrieved: 1');
      });
    });

    describe('reporters produce the correct aggregate query', () => {
      beforeEach(() => {
        // @ts-expect-error stubbing for testing
        soqlQuerySpy = $$.SANDBOX.stub(DataSoqlQueryCommand.prototype, 'runSoqlQuery')
          // aggregate query types are wrong in jsforce
          .resolves(soqlQueryExemplars.queryWithAggregates.soqlQueryResult as unknown as SoqlQueryResult);
      });
      afterEach(() => {
        $$.SANDBOX.restore();
      });
      //
      it('should have json results', async () => {
        const { result } = await captureOutput<SoqlQueryResult['result']>(async () =>
          DataSoqlQueryCommand.run(
            ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'json'],
            config
          )
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        expect(result).to.have.property('totalSize', 17);
        expect(result?.records.length).to.be.equal(result?.totalSize);
      });

      it('should have csv results', async () => {
        const { stdout } = await captureOutput<SoqlQueryResult['result']>(async () =>
          DataSoqlQueryCommand.run(
            ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'csv'],
            config
          )
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        expect(/.*?United Oil & Gas Corp\.,5600000000.*/.test(stdout)).to.be.true;
        expect(/.*?bar,?0.*/.test(stdout)).to.be.true;
      });

      it('should have human results', async () => {
        const { stdout } = await captureOutput<SoqlQueryResult['result']>(async () =>
          DataSoqlQueryCommand.run(
            ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'human'],
            config
          )
        );
        expect(/.*?United Oil & Gas Corp\..*?5600000000.*/.test(stdout)).to.be.true;
        expect(/.*?bar.*?0.*/.test(stdout)).to.be.true;
        expect(stdout).to.include('records retrieved: 17');
      });
    });
  });
});
