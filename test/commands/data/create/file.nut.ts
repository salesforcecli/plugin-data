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
      cli: 'sf',
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
