/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { SfCommand } from '@salesforce/sf-plugins-core';
import type { BulkResultV2 } from '../../../types.js';
import { BulkUpsertRequestCache } from '../../../bulkDataRequestCache.js';
import { ResumeBulkCommand } from '../../../resumeBulkBaseCommand.js';
import { transformResults } from '../../../bulkUtils.js';
import { bulkIngestResume } from '../../../bulkIngest.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.upsert.resume');

export default class UpsertResume extends ResumeBulkCommand {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public async run(): Promise<BulkResultV2> {
    const [{ flags }, cache] = await Promise.all([this.parse(UpsertResume), BulkUpsertRequestCache.create()]);

    const res = await bulkIngestResume({
      cmdId: 'data upsert resume',
      stageTitle: 'Upserting data',
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
