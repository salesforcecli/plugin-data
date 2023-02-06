/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as fs from 'fs';
import { stubMethod } from '@salesforce/ts-sinon';
import { SfError } from '@salesforce/core';
import { TestContext, MockTestOrgData, shouldThrow } from '@salesforce/core/lib/testSetup';
import { Config } from '@oclif/core';
import { expect } from 'chai';
import Upsert from '../../../../../src/commands/force/data/bulk/upsert';

describe('force:data:bulk:upsert', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  let config: Config;

  before(async () => {
    config = new Config({ root: path.resolve(__dirname, '../../../..') });
    await config.load();
  });

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    $$.SANDBOX.stub(fs, 'existsSync').returns(true);
    $$.SANDBOX.stub(fs, 'createReadStream').throws(new SfError('Error'));
    stubMethod($$.SANDBOX, fs.promises, 'stat').resolves({ isFile: () => true });
  });

  afterEach(async () => {
    $$.SANDBOX.restore();
  });

  it('should fail correctly with error message', async () => {
    const cmd = new Upsert(
      [
        '--target-org',
        'test@org.com',
        '--sobject',
        'custom__c',
        '--file',
        'fileToUpsert.csv',
        '--externalid',
        'field__c',
        '--json',
      ],
      config
    );
    try {
      await shouldThrow(cmd.run());
    } catch (err) {
      if (!(err instanceof SfError)) {
        expect.fail('Expected SfError to be thrown');
      }
      expect(err.exitCode).to.equal(1);
      // expect(err.commandName).to.equal('Upsert');
      expect(err.message).to.equal('Error');
    }
  });
});
