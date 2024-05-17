/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { ContentVersion, file2CV } from '../../../api/file/fileToContentVersion.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.create.file');

type CDLCreateRequest = {
  ContentDocumentId: string;
  LinkedEntityId: string;
  ShareType: string;
};

export default class DataCreateFile extends SfCommand<ContentVersion> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    title: Flags.string({
      summary: messages.getMessage('flags.title.summary'),
      char: 't',
      required: false,
    }),
    file: Flags.file({
      summary: messages.getMessage('flags.file.summary'),
      char: 'f',
      required: true,
      exists: true,
    }),
    // it really could be most any valid ID
    // eslint-disable-next-line sf-plugin/id-flag-suggestions
    'parent-id': Flags.salesforceId({
      summary: messages.getMessage('flags.parent-id.summary'),
      char: 'i',
      length: 'both',
    }),
  };

  public async run(): Promise<ContentVersion> {
    const { flags } = await this.parse(DataCreateFile);
    const conn = flags['target-org'].getConnection(flags['api-version']);
    const cv = await file2CV(conn, flags.file, flags.title);
    this.logSuccess(messages.getMessage('createSuccess', [cv.ContentDocumentId]));

    if (!flags['parent-id']) {
      return cv;
    }

    const CDLReq = {
      ContentDocumentId: cv.ContentDocumentId,
      LinkedEntityId: flags['parent-id'],
      ShareType: 'V',
    } satisfies CDLCreateRequest;
    try {
      const CDLCreateResult = await conn.sobject('ContentDocumentLink').create(CDLReq);

      if (CDLCreateResult.success) {
        this.logSuccess(messages.getMessage('attachSuccess', [flags['parent-id']]));
        return cv;
      } else {
        throw SfError.create({
          message: messages.getMessage('attachFailure'),
          data: CDLCreateResult.errors,
        });
      }
    } catch (e) {
      const error = SfError.wrap(e);
      if (error.name === 'INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY') {
        error.actions = messages.getMessages('insufficientAccessActions');
      }
      throw error;
    }
  }
}
