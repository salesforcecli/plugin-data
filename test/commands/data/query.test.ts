/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { resolve } from 'path';
import * as chai from 'chai';
import { Config } from '@oclif/core';
import { OrgConfigProperties } from '@salesforce/core';
import {
  TestContext,
  MockTestOrgData,
  // shouldThrow
} from '@salesforce/core/lib/testSetup';

import * as chaiAsPromised from 'chai-as-promised';
import { describe } from 'mocha';
import sinon = require('sinon');
import { expect } from 'chai';
import { soqlQueryExemplars } from '../../test-files/soqlQuery.exemplars';
import { DataSoqlQueryCommand } from '../../../src/commands/data/query';
import { SoqlQueryResult } from '../../../src/dataSoqlQueryTypes';

chai.use(chaiAsPromised);

describe('Execute a SOQL statement', (): void => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({ root: resolve(__dirname, '../../../package.json') });

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
    let stdoutSpy: sinon.SinonSpy;
    describe('handle empty results', () => {
      beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        soqlQuerySpy = $$.SANDBOX.stub(DataSoqlQueryCommand.prototype, 'runSoqlQuery').resolves(
          soqlQueryExemplars.emptyQuery.soqlQueryResult
        );
        stdoutSpy = $$.SANDBOX.stub(process.stdout, 'write');
      });
      afterEach(() => {
        $$.SANDBOX.restore();
      });

      it('should have empty results', async () => {
        const cmd = new DataSoqlQueryCommand(['--target-org', 'test@org.com', '--query', 'select '], config);
        // without cmd._run(), ConfigAggregator, project, etc are not set on the class
        // eslint-disable-next-line no-underscore-dangle
        const result = await cmd._run();
        sinon.assert.calledOnce(soqlQuerySpy);
        expect((result as SoqlQueryResult['result']).totalSize).to.equal(0);
        expect((result as SoqlQueryResult['result']).records.length).to.equal(0);
        expect(stdoutSpy.args.flat().join('')).to.include('Total number of records retrieved: 0');
      });
    });

    describe('handle results with value 0', () => {
      beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        soqlQuerySpy = $$.SANDBOX.stub(DataSoqlQueryCommand.prototype, 'runSoqlQuery').resolves(
          soqlQueryExemplars.queryWithZeroFields.soqlQueryResult
        );
        stdoutSpy = $$.SANDBOX.stub(process.stdout, 'write');
      });

      afterEach(() => {
        $$.SANDBOX.restore();
      });

      it('should have csv results', async () => {
        await DataSoqlQueryCommand.run(
          ['--targetusername', 'test@org.com', '--query', 'select ', '--resultformat', 'csv'],
          config
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        // test for expected snippet in output
        expect(stdoutSpy.args.flat().join('')).to.include('Dickenson Mobile Generators,0,1,0');
      });

      it('should have human results', async () => {
        await DataSoqlQueryCommand.run(
          ['--targetusername', 'test@org.com', '--query', 'select ', '--resultformat', 'human'],
          config
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        // test for expected snippet in output
        const stdout = stdoutSpy.args.flat().join('');
        expect(/.*?Dickenson Mobile Generators.*?0.*?0.*?/.test(stdout)).to.be.true;
      });
    });

    describe('reporters produce the correct results for subquery', () => {
      beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        soqlQuerySpy = $$.SANDBOX.stub(DataSoqlQueryCommand.prototype, 'runSoqlQuery').callsFake(() =>
          Promise.resolve(soqlQueryExemplars.subqueryAccountsAndContacts.soqlQueryResult)
        );
        stdoutSpy = $$.SANDBOX.stub(process.stdout, 'write');
      });
      afterEach(() => {
        $$.SANDBOX.restore();
      });

      it('should have csv results', async () => {
        await DataSoqlQueryCommand.run(
          ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'csv'],
          config
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        // test for expected snippet in output
        expect(stdoutSpy.args.flat().join('')).to.include(
          'Contacts.totalSize,Contacts.records.3.LastName\n"Cisco Systems, Inc.",,,,,,,,\nASSMANN Electronic GmbH,,,,,,,,\n'
        );
      });
      it('should have json results', async () => {
        const cmd = new DataSoqlQueryCommand(
          ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'json'],
          config
        );
        // eslint-disable-next-line no-underscore-dangle
        const result = await cmd._run();
        sinon.assert.calledOnce(soqlQuerySpy);
        expect(result as SoqlQueryResult['result']).to.have.property('totalSize', 50);
        expect((result as SoqlQueryResult['result']).records.length).to.be.equal(
          (result as SoqlQueryResult['result']).totalSize
        );
      });

      it('should have human results', async () => {
        await DataSoqlQueryCommand.run(
          ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'human'],
          config
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        // test for expected snippet in output
        const stdout = stdoutSpy.args.flat().join('');
        expect(/.*?United Oil & Gas, UK.*?James.*?/.test(stdout)).to.be.true;
        expect(stdout).to.include('records retrieved: 50');
      });
    });

    describe('human readable output for complex subqueries', () => {
      beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        soqlQuerySpy = $$.SANDBOX.stub(DataSoqlQueryCommand.prototype, 'runSoqlQuery').resolves(
          soqlQueryExemplars.complexSubQuery.soqlQueryResult
        );
        stdoutSpy = $$.SANDBOX.stub(process.stdout, 'write');
      });

      afterEach(() => {
        $$.SANDBOX.restore();
      });

      it('should have human results for a complex subquery', async () => {
        await DataSoqlQueryCommand.run(
          [
            '--target-org',
            'test@org.com',
            '--query',
            'SELECT Amount, Id, Name,StageName, CloseDate, (SELECT Id,  ListPrice, PriceBookEntry.UnitPrice, PricebookEntry.Name, PricebookEntry.Id, PricebookEntry.product2.Family FROM OpportunityLineItems) FROM Opportunity',
          ],
          config
        );
        sinon.assert.calledOnce(soqlQuerySpy);
        const stdout = stdoutSpy.args.flat().join('');

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
          ),
          stdout
        ).to.be.true;
        expect(stdout).to.include('records retrieved: 1');
      });
    });

    describe('reporters produce the correct aggregate query', () => {
      beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        soqlQuerySpy = $$.SANDBOX.stub(DataSoqlQueryCommand.prototype, 'runSoqlQuery')
          // aggregate query types are wrong in jsforce
          .resolves(soqlQueryExemplars.queryWithAggregates.soqlQueryResult as unknown as SoqlQueryResult);
        stdoutSpy = $$.SANDBOX.stub(process.stdout, 'write');
      });
      afterEach(() => {
        $$.SANDBOX.restore();
      });
      //
      it('should have json results', async () => {
        const cmd = new DataSoqlQueryCommand(
          ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'json'],
          config
        );
        // eslint-disable-next-line no-underscore-dangle
        const result = await cmd._run();
        sinon.assert.calledOnce(soqlQuerySpy);
        expect(result as SoqlQueryResult['result']).to.have.property('totalSize', 17);
        expect((result as SoqlQueryResult['result']).records.length).to.be.equal(
          (result as SoqlQueryResult['result']).totalSize
        );
      });

      it('should have csv results', async () => {
        await DataSoqlQueryCommand.run(
          ['--targetusername', 'test@org.com', '--query', 'select ', '--resultformat', 'csv'],
          config
        );

        sinon.assert.calledOnce(soqlQuerySpy);
        const stdout = stdoutSpy.args.flat().join('');

        expect(/.*?United Oil & Gas Corp\.,5600000000.*/.test(stdout)).to.be.true;
        expect(/.*?bar,?0.*/.test(stdout)).to.be.true;
      });

      it('should have human results', async () => {
        await DataSoqlQueryCommand.run(
          ['--target-org', 'test@org.com', '--query', 'select ', '--result-format', 'human'],
          config
        );

        sinon.assert.calledOnce(soqlQuerySpy);
        const stdout = stdoutSpy.args.flat().join('');

        expect(/.*?United Oil & Gas Corp\..*?5600000000.*/.test(stdout)).to.be.true;
        expect(/.*?bar.*?0.*/.test(stdout)).to.be.true;
        expect(stdout).to.include('records retrieved: 17');
      });
    });
  });
});
