/*
 * Copyright 2026, Salesforce, Inc.
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

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { Connection } from '@salesforce/core';
import type { Record, SaveResult } from '@jsforce/jsforce-node';
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

export async function file2CV(conn: Connection, filepath: string, title?: string): Promise<ContentVersion> {
  const req: ContentVersionCreateRequest = {
    PathOnClient: filepath,
    Title: title,
  };

  const form = new FormData();
  form.append('VersionData', await readFile(filepath), { filename: title ?? basename(filepath) });
  form.append('entity_content', JSON.stringify(req), { contentType: 'application/json' });

  // POST the multipart form to Salesforce's API, can't use the normal "create" action because it doesn't support multipart
  const CV = await conn.request<SaveResult>({
    url: '/sobjects/ContentVersion',
    headers: { ...form.getHeaders() },
    body: form.getBuffer(),
    method: 'POST',
  });

  if (!CV.success) {
    throw new Error(`Failed to create ContentVersion: ${CV.errors.map((e) => JSON.stringify(e, null, 2)).join('\n')}`);
  }

  return conn.singleRecordQuery<ContentVersion>(
    `Select Id, ContentDocumentId, Title, FileExtension from ContentVersion where Id='${CV.id}'`
  );
}
