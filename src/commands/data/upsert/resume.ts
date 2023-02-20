/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '@salesforce/core';
import { BulkResultV2 } from '../../../types';
import { BulkUpsertRequestCache } from '../../../bulkDataRequestCache';
import { ResumeBulkCommand } from '../../../resumeBulkCommand';
import { isBulkV2RequestDone } from '../../../bulkUtils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.upsert.resume');

export default class UpsertResume extends ResumeBulkCommand {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public async run(): Promise<BulkResultV2> {
    const { flags } = await this.parse(UpsertResume);
    const cache = await BulkUpsertRequestCache.create();
    const resumeOptions = await cache.resolveResumeOptionsFromCache(
      flags['job-id'],
      flags['use-most-recent'],
      flags['target-org'],
      flags['api-version']
    );
    this.connection = resumeOptions.options.connection;
    this.operation = 'upsert';
    resumeOptions.options.operation = 'upsert';

    const resumeResults = await this.resume(resumeOptions, flags.wait);
    if (isBulkV2RequestDone(resumeResults.jobInfo)) {
      await BulkUpsertRequestCache.unset(resumeOptions.jobInfo.id);
    }
    return resumeResults;
  }
}
