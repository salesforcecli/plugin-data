/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '@salesforce/core';
import { BulkResultV2 } from '../../../types';
import { BulkDeleteRequestCache } from '../../../bulkDataRequestCache';
import { ResumeBulkCommand } from '../../../resumeBulkCommand';
import { isBulkV2RequestDone } from '../../../bulkUtils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.delete.resume');

export default class DeleteResume extends ResumeBulkCommand {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly deprecateAliases = true;

  public async run(): Promise<BulkResultV2> {
    const { flags } = await this.parse(DeleteResume);
    const cache = await BulkDeleteRequestCache.create();
    const resumeOptions = await cache.resolveResumeOptionsFromCache(
      flags['job-id'],
      flags['use-most-recent'],
      flags['target-org'],
      flags['api-version']
    );
    this.connection = resumeOptions.options.connection;
    this.operation = 'delete';
    resumeOptions.options.operation = 'delete';
    const resumeResults = await this.resume(resumeOptions, flags.wait);
    if (isBulkV2RequestDone(resumeResults.jobInfo)) {
      await BulkDeleteRequestCache.unset(resumeOptions.jobInfo.id);
    }
    return resumeResults;
  }
}
