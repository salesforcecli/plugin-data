/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { TestContext, MockTestOrgData, shouldThrow } from '@salesforce/core/testSetup';
import { Config } from '@oclif/core/config';
import { assert, expect } from 'chai';
import { IngestJobV2, JobInfoV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import Bulk from '../../../../src/commands/data/delete/bulk.js';

describe('data:delete:bulk', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  let config: Config;
  let pollStub: sinon.SinonStub;

  before(async () => {
    config = new Config({ root: resolve(dirname(fileURLToPath(import.meta.url)), '../../../..') });
    await config.load();
  });

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    $$.SANDBOX.stub(fs, 'existsSync').returns(true);
    $$.SANDBOX.stub(fs, 'createReadStream').resolves();
    // @ts-expect-error only stubbing a very small part
    $$.SANDBOX.stub(fs.promises, 'stat').resolves({ isFile: () => true, isDirectory: () => true });
    $$.SANDBOX.stub(IngestJobV2.prototype, 'open').resolves();
    $$.SANDBOX.stub(IngestJobV2.prototype, 'uploadData').resolves();
    $$.SANDBOX.stub(IngestJobV2.prototype, 'close').resolves();
    pollStub = $$.SANDBOX.stub(IngestJobV2.prototype, 'poll').resolves();
  });

  afterEach(async () => {
    $$.SANDBOX.restore();
  });

  it('should pass the hardDelete option to the api', async () => {
    const options: JobInfoV2 = {
      operation: 'hardDelete',
      id: '123',
      object: 'Account',
      apiActiveProcessingTime: 0,
      assignmentRuleId: '90',
      contentUrl: '389',
      errorMessage: undefined,
      externalIdFieldName: '123',
      jobType: 'V2Ingest',
      state: 'JobComplete',
      apiVersion: 44.0,
      concurrencyMode: 'Parallel',
      retries: 0,
      totalProcessingTime: 1,
      apexProcessingTime: 1,
      columnDelimiter: 'BACKQUOTE',
      numberRecordsProcessed: 10,
      contentType: 'CSV',
      numberRecordsFailed: 0,
      createdById: '234',
      createdDate: '',
      systemModstamp: '',
      lineEnding: 'LF',
    };

    // we can't spy on ESM modules... :(
    $$.SANDBOX.stub(IngestJobV2.prototype, 'check').resolves(options);

    const result = await Bulk.run([
      '--target-org',
      'test@org.com',
      '--hard-delete',
      '--file',
      '../../oss/plugin-data/test/test-files/data-project/data/bulkUpsertLarge.csv',
      '--sobject',
      'Account',
    ]);
    expect(result).to.deep.equal({
      jobInfo: options,
    });
  });

  it('should handle user without permission error', async () => {
    const e = new Error('FEATURENOTENABLED');
    e.name = 'FEATURENOTENABLED';
    $$.SANDBOX.stub(IngestJobV2.prototype, 'check').throws(e);

    const bulk = new Bulk(
      [
        '--target-org',
        'test@org.com',
        '--hard-delete',
        '--file',
        '../../oss/plugin-data/test/test-files/data-project/data/bulkUpsertLarge.csv',
        '--sobject',
        'Account',
      ],
      config
    );
    try {
      await shouldThrow(bulk.run());
    } catch (err) {
      assert(err instanceof Error);
      expect(err.message).to.equal(
        'You must have the "Bulk API Hard Delete" system permission to use the --hard-delete flag. This permission is disabled by default and can be enabled only by a system administrator.'
      );
    }
  });

  it('should throw other errors than timeouts', async () => {
    pollStub.throws(new Error('Server-side error'));

    const bulk = new Bulk(
      [
        '--target-org',
        'test@org.com',
        '--wait',
        '10',
        '--file',
        '../../oss/plugin-data/test/test-files/data-project/data/bulkUpsertLarge.csv',
        '--sobject',
        'Account',
      ],
      config
    );
    try {
      await shouldThrow(bulk.run());
    } catch (err) {
      assert(err instanceof Error);
      expect(err.message).to.equal('Server-side error');
    }
  });

  it('should not change error when not using --hard-delete', async () => {
    const e = new Error('some other server-side error, but not permissions');
    $$.SANDBOX.stub(IngestJobV2.prototype, 'check').throws(e);

    const bulk = new Bulk(
      [
        '--target-org',
        'test@org.com',
        '--file',
        '../../oss/plugin-data/test/test-files/data-project/data/bulkUpsertLarge.csv',
        '--sobject',
        'Account',
      ],
      config
    );
    try {
      await shouldThrow(bulk.run());
    } catch (err) {
      assert(err instanceof Error);
      expect(err.message).to.equal('some other server-side error, but not permissions');
    }
  });

  it('should succeed', async () => {
    const options: JobInfoV2 = {
      operation: 'delete',
      id: '123',
      object: 'Account',
      apiActiveProcessingTime: 0,
      assignmentRuleId: '90',
      contentUrl: '389',
      errorMessage: undefined,
      externalIdFieldName: '123',
      jobType: 'V2Ingest',
      state: 'JobComplete',
      apiVersion: 44.0,
      concurrencyMode: 'Parallel',
      retries: 0,
      totalProcessingTime: 1,
      apexProcessingTime: 1,
      columnDelimiter: 'BACKQUOTE',
      numberRecordsProcessed: 10,
      contentType: 'CSV',
      numberRecordsFailed: 0,
      createdById: '234',
      createdDate: '',
      systemModstamp: '',
      lineEnding: 'LF',
    };
    $$.SANDBOX.stub(IngestJobV2.prototype, 'check').resolves(options);

    const result = await Bulk.run([
      '--target-org',
      'test@org.com',
      '--file',
      '../../oss/plugin-data/test/test-files/data-project/data/bulkUpsertLarge.csv',
      '--sobject',
      'Account',
    ]);
    expect(result).to.deep.equal({
      jobInfo: options,
    });
  });
});
