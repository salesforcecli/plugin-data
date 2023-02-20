/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable  @typescript-eslint/no-var-requires */
import { join as pathJoin, resolve } from 'path';
import { strict as assert } from 'assert';
import { AnyJson, ensureJsonMap, ensureString } from '@salesforce/ts-types';
import { expect } from 'chai';
import { TestContext, MockTestOrgData, shouldThrow } from '@salesforce/core/lib/testSetup';
import { Config } from '@oclif/core';
import Import from '../../../../src/commands/data/import/tree';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const dataImportPlanSchema = require('../../../../schema/dataImportPlanSchema.json');

const expectedImportResult = [
  {
    refId: 'SampleAccountRef',
    type: 'Account',
    id: '0019A00000GkC21QAF',
  },
  {
    refId: 'SampleAcct2Ref',
    type: 'Account',
    id: '0019A00000GkC22QAF',
  },
  {
    refId: 'PresidentSmithRef',
    type: 'Contact',
    id: '0039A00000Bzy8kQAB',
  },
  {
    refId: 'VPEvansRef',
    type: 'Contact',
    id: '0039A00000Bzy8lQAB',
  },
];

describe('data:tree:import', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({ root: resolve(__dirname, '../../../package.json') });

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    await config.load();
    $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
      const requestWithUrl = ensureJsonMap(request);
      if (request && ensureString(requestWithUrl.url).includes('composite/tree/account')) {
        return Promise.resolve({
          hasErrors: false,
          results: [
            { referenceId: 'SampleAccountRef', id: '0019A00000GkC21QAF' },
            { referenceId: 'SampleAcct2Ref', id: '0019A00000GkC22QAF' },
            { referenceId: 'PresidentSmithRef', id: '0039A00000Bzy8kQAB' },
            { referenceId: 'VPEvansRef', id: '0039A00000Bzy8lQAB' },
          ],
        });
      } else {
        return Promise.resolve({});
      }
    };
  });

  afterEach(async () => {
    $$.restore();
  });

  it('returns 4 reference entries for an import file', async () => {
    const cmd = new Import(
      [
        '--target-org',
        'test@org.com',
        '--files',
        pathJoin(__dirname, '..', '..', '..', 'api', 'data', 'tree', 'test-files', 'accounts-contacts-tree.json'),
        '--json',
      ],
      config
    );

    const result = await cmd.run();
    expect(result).to.deep.equal(expectedImportResult);
  });

  it('returns 4 reference entries for an import plan', async () => {
    const cmd = new Import(
      [
        '--target-org',
        'test@org.com',
        '--plan',
        pathJoin(__dirname, '..', '..', '..', 'api', 'data', 'tree', 'test-files', 'accounts-contacts-plan.json'),
        '--json',
      ],
      config
    );

    const result = await cmd.run();
    expect(result).to.deep.equal(expectedImportResult);
  });

  it('should return the schema with --confighelp param', async () => {
    const cmd = new Import(['--target-org', 'test@org.com', '--config-help', '--json'], config);
    const result = await cmd.run();
    expect(result).to.deep.equal(dataImportPlanSchema);
  });

  it('should throw an error if data plan or file is not provided', async () => {
    const cmd = new Import(['--target-org', 'test@org.com', '--json'], config);
    try {
      await shouldThrow(cmd.run());
    } catch (e) {
      assert(e instanceof Error);
      expect(e.name).to.equal('InvalidDataImport');
      // error happened, yay.
    }
  });
});
