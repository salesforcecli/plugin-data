/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import path from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import type { SaveResult } from '@jsforce/jsforce-node';
import { SoqlQueryResult } from '../../../../src/types.js';
import { ContentVersion } from '../../../../src/api/file/fileToContentVersion.js';

describe('data create file NUTs', () => {
  const filename = 'hi.txt';
  let session: TestSession;
  let acctId: string | undefined;
  before(async () => {
    session = await TestSession.create({
      project: { name: 'dataCreateFile' },
      scratchOrgs: [{ setDefault: true, edition: 'developer' }],
      devhubAuthStrategy: 'AUTO',
    });
    // create one record in the org that we'll use to attach stuff to
    acctId = execCmd<SaveResult>('data:create:record -s Account -v "Name=TestAccount" --json', {
      ensureExitCode: 0,
      cli: 'sf'
    }).jsonOutput?.result.id;
    expect(acctId).to.be.a('string');
    // make a file we can upload
    await fs.promises.writeFile(path.join(session.project.dir, filename), 'hi');
  });

  after(async () => {
    await session?.clean();
  });

  it('basic file upload', () => {
    const command = `data:create:file --file ${filename} --json`;
    const output = execCmd<ContentVersion>(command, { ensureExitCode: 0 }).jsonOutput?.result;
    expect(output?.ContentDocumentId)
      .to.be.a('string')
      .match(/069\w{15}/);
    expect(output?.Id)
      .to.be.a('string')
      .match(/068\w{15}/);
    expect(output?.FileExtension).to.equal('txt');
  });

  it('file upload + attach with filename', () => {
    const newName = 'newName.txt';
    const command = `data:create:file --file ${filename} --parent-id ${acctId} --title ${newName} --json`;
    const output = execCmd<ContentVersion>(command, { ensureExitCode: 0 }).jsonOutput?.result;
    expect(output?.ContentDocumentId)
      .to.be.a('string')
      .match(/069\w{15}/);
    expect(output?.Id)
      .to.be.a('string')
      .match(/068\w{15}/);
    expect(output?.Title).to.equal(newName);

    // make sure the file is attached to the record
    const query = `SELECT Id FROM ContentDocumentLink WHERE LinkedEntityId='${acctId}' AND ContentDocumentId='${output?.ContentDocumentId}'`;
    const result = execCmd<SoqlQueryResult['result']>(`data:query -q "${query}" --json`, { ensureExitCode: 0 })
      .jsonOutput?.result;
    expect(result?.totalSize).to.equal(1);
  });
});
