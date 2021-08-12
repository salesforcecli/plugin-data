/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable  @typescript-eslint/no-var-requires */

import { join as pathJoin } from 'path';
import { expect, test } from '@salesforce/command/lib/test';
import { ensureJsonMap, ensureString, AnyJson } from '@salesforce/ts-types';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const dataImportPlanSchema = require('../../../../../schema/dataImportPlanSchema.json');

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

interface ImportResult {
  status: string;
  message?: string;
  result: AnyJson;
}

describe('force:data:tree:import', () => {
  test
    .withOrg({ username: 'test@org.com' }, true)
    .withConnectionRequest((request) => {
      const requestMap = ensureJsonMap(request);
      if (ensureString(requestMap.url).includes('composite/tree/account')) {
        return Promise.resolve({
          hasErrors: false,
          results: [
            { referenceId: 'SampleAccountRef', id: '0019A00000GkC21QAF' },
            { referenceId: 'SampleAcct2Ref', id: '0019A00000GkC22QAF' },
            { referenceId: 'PresidentSmithRef', id: '0039A00000Bzy8kQAB' },
            { referenceId: 'VPEvansRef', id: '0039A00000Bzy8lQAB' },
          ],
        });
      }
      return Promise.resolve({});
    })
    .stdout()
    .command([
      'force:data:tree:import',
      '--targetusername',
      'test@org.com',
      '--sobjecttreefiles',
      pathJoin(__dirname, '..', '..', '..', '..', 'api', 'data', 'tree', 'test-files', 'accounts-contacts-tree.json'),
      '--json',
    ])
    .it('returns 4 reference entries for an import file', (ctx) => {
      const result = JSON.parse(ctx.stdout) as ImportResult;
      expect(result.status).to.equal(0);
      expect(result.result).to.deep.equal(expectedImportResult);
    });

  test
    .withOrg({ username: 'test@org.com' }, true)
    .withConnectionRequest((request) => {
      const requestMap = ensureJsonMap(request);
      if (ensureString(requestMap.url).includes('composite/tree/account')) {
        return Promise.resolve({
          hasErrors: false,
          results: [
            { referenceId: 'SampleAccountRef', id: '0019A00000GkC21QAF' },
            { referenceId: 'SampleAcct2Ref', id: '0019A00000GkC22QAF' },
            { referenceId: 'PresidentSmithRef', id: '0039A00000Bzy8kQAB' },
            { referenceId: 'VPEvansRef', id: '0039A00000Bzy8lQAB' },
          ],
        });
      }
      return Promise.resolve({});
    })
    .stdout()
    .command([
      'force:data:tree:import',
      '--targetusername',
      'test@org.com',
      '--plan',
      pathJoin(__dirname, '..', '..', '..', '..', 'api', 'data', 'tree', 'test-files', 'accounts-contacts-plan.json'),
      '--json',
    ])
    .it('returns 4 reference entries for an import plan', (ctx) => {
      const result = JSON.parse(ctx.stdout) as ImportResult;
      expect(result.status).to.equal(0);
      expect(result.result).to.deep.equal(expectedImportResult);
    });

  test
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .command(['force:data:tree:import', '--targetusername', 'test@org.com', '--confighelp', '--json'])
    .it('should return the schema with --confighelp param', (ctx) => {
      const result = JSON.parse(ctx.stdout) as ImportResult;
      expect(result.status).to.equal(0);
      expect(result.result).to.deep.equal(dataImportPlanSchema);
    });

  test
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .command(['force:data:tree:import', '--targetusername', 'test@org.com', '--json'])
    .it('should throw an error if data plan or file is not provided', (ctx) => {
      const result = JSON.parse(ctx.stdout) as ImportResult;
      expect(result.status).to.equal(1);
      expect(result.message).to.include('Provide a data plan or file(s).');
    });
});
