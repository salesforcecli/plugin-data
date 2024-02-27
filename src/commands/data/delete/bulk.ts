/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { baseFlags, runBulkOperation } from '../../../bulkOperationCommand.js';
import { BulkResultV2 } from '../../../types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulkv2.delete');

export default class Delete extends SfCommand<BulkResultV2> {
  public static readonly examples = messages.getMessages('examples');
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public static readonly flags = baseFlags;

  public async run(): Promise<BulkResultV2> {
    const { flags } = await this.parse(Delete);
    return runBulkOperation({
      cmd: this,
      sobject: flags.sobject,
      csvFileName: flags.file,
      connection: flags['target-org'].getConnection(flags['api-version']),
      wait: flags.async ? Duration.minutes(0) : flags.wait,
      verbose: flags.verbose,
      operation: 'delete',
    });
  }
}
