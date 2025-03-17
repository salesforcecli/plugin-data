/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { SfCommand } from '@salesforce/sf-plugins-core';
import type { BulkResultV2 } from '../../../types.js';
import { BulkDeleteRequestCache } from '../../../bulkDataRequestCache.js';
import { transformResults } from '../../../bulkUtils.js';
import { bulkIngestResume, baseUpsertDeleteResumeFlags } from '../../../bulkIngest.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.delete.resume');

export default class DeleteResume extends SfCommand<BulkResultV2> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly deprecateAliases = true;

  public static readonly flags = baseUpsertDeleteResumeFlags;

  public async run(): Promise<BulkResultV2> {
    const [{ flags }, cache] = await Promise.all([this.parse(DeleteResume), BulkDeleteRequestCache.create()]);

    const res = await bulkIngestResume({
      cmdId: 'data delete resume',
      stageTitle: 'Deleting data',
      cache,
      jobIdOrMostRecent: flags['job-id'] ?? flags['use-most-recent'],
      jsonEnabled: this.jsonEnabled(),
      wait: flags.wait,
      warnFn: (arg: SfCommand.Warning) => {
        this.warn(arg);
      },
    });

    const {
      options: { connection: conn },
    } = await cache.resolveResumeOptionsFromCache(flags['job-id'] ?? flags['use-most-recent']);

    const job = conn.bulk2.job('ingest', {
      id: res.jobId,
    });

    return {
      jobInfo: await job.check(),
      records: transformResults(await job.getAllResults()),
    };
  }
}
