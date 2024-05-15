/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { Connection } from '@salesforce/core';
import { Record, SaveResult } from '@jsforce/jsforce-node';
import FormData from 'form-data';

export type ContentVersion = {
  Title: string;
  FileExtension: string;
  VersionData: string;
  /** this could be undefined outside of our narrow use case (created files) */
  ContentDocumentId: string;
} & Record;

type ContentVersionCreateRequest = {
  PathOnClient: string;
  Title?: string;
};

export async function file2CV(conn: Connection, filepath: string, name?: string): Promise<ContentVersion> {
  const cvcr: ContentVersionCreateRequest = {
    PathOnClient: filepath,
    Title: name,
  };

  const form = new FormData();
  form.append('VersionData', await readFile(filepath), { filename: name ?? basename(filepath) });
  form.append('entity_content', JSON.stringify(cvcr), { contentType: 'application/json' });

  // POST the multipart form to Salesforce's API, can't use the normal "create" action because it doesn't support multipart
  const CV = await conn.request<SaveResult>({
    url: '/sobjects/ContentVersion',
    headers: { ...form.getHeaders() },
    body: form.getBuffer(),
    method: 'POST',
  });

  const result = await conn.query<ContentVersion>(
    `Select Id, ContentDocumentId from ContentVersion where Id='${CV.id}'`
  );
  return result.records[0];
}
