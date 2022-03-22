/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, test } from '@salesforce/command/lib/test';

interface DeleteResult {
  status: number;
  name: string;
  message: string;
}

describe('force:data:bulk:delete', () => {
  test
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .command([
      'force:data:bulk:delete',
      '--csvfile',
      'nonexistant.csv',
      '--targetusername',
      'test@org.com',
      '--sobjecttype',
      'Account',
      '--json',
    ])
    .it("should throw an error if the file doesn't exist", (ctx) => {
      const result = JSON.parse(ctx.stdout) as DeleteResult;
      expect(result.status).to.equal(1);
      expect(result.name).to.equal('PathDoesNotExist');
      expect(result.message).to.equal('The specified path [nonexistant.csv] does not exist');
    });
});
