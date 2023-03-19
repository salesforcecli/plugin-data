/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '@salesforce/core';
import { BulkDeleteRequestCache } from '../../../bulkDataRequestCache';
import { BulkOperationCommand } from '../../../bulkOperationCommand';
import { BulkResultV2 } from '../../../types';
import { validateSobjectType } from '../../../bulkUtils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulkv2.delete');

export default class Delete extends BulkOperationCommand {
  public static readonly examples = messages.getMessages('examples');
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public async run(): Promise<BulkResultV2> {
    const { flags } = await this.parse(Delete);

    const conn = flags['target-org'].getConnection(flags['api-version']);

    await validateSobjectType(flags.sobject, conn);

    return this.runBulkOperation(flags.sobject, flags.file, conn, flags.async ? 0 : flags.wait?.minutes, 'delete');
  }

  // eslint-disable-next-line class-methods-use-this
  protected async getCache(): Promise<BulkDeleteRequestCache> {
    return BulkDeleteRequestCache.create();
  }
}
