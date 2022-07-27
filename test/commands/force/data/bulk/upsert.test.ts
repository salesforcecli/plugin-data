/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { $$, expect, test } from '@salesforce/command/lib/test';
import { stubMethod } from '@salesforce/ts-sinon';
import { SfError } from '@salesforce/core';

interface UpsertResult {
  commandName: string;
  exitCode: number;
  message: string;
}

describe('force:data:bulk:upsert', () => {
  test
    .do(() => {
      stubMethod($$.SANDBOX, fs.promises, 'access').resolves(undefined);
      stubMethod($$.SANDBOX, fs, 'createReadStream').throws(new SfError('Error'));
    })
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .command([
      'force:data:bulk:upsert',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'custom__c',
      '--csvfile',
      'fileToUpsert.csv',
      '--externalid',
      'field__c',
      '--json',
    ])
    .it('should fail correctly with error message', (ctx) => {
      const result = JSON.parse(ctx.stdout) as UpsertResult;
      expect(result.commandName).to.equal('Upsert');
      expect(result.exitCode).to.equal(1);
      expect(result.message).to.equal('Error');
    });
});
