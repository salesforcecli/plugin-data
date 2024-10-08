/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import type { BulkResultV2 } from '../../../types.js';
import { BulkDeleteRequestCache } from '../../../bulkDataRequestCache.js';
import { ResumeBulkCommand } from '../../../resumeBulkBaseCommand.js';
import { isBulkV2RequestDone } from '../../../bulkUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.delete.resume');

export default class DeleteResume extends ResumeBulkCommand {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly deprecateAliases = true;

  public async run(): Promise<BulkResultV2> {
    const [{ flags }, cache] = await Promise.all([this.parse(DeleteResume), BulkDeleteRequestCache.create()]);
    const resumeOptions = await cache.resolveResumeOptionsFromCache(
      flags['job-id'],
      flags['use-most-recent'],
      flags['target-org'],
      flags['api-version']
    );
    resumeOptions.options.operation = 'delete';
    const resumeResults = await this.resume(resumeOptions, flags.wait);
    if (isBulkV2RequestDone(resumeResults.jobInfo)) {
      await BulkDeleteRequestCache.unset(resumeOptions.jobInfo.id);
    }
    return resumeResults;
  }
}
