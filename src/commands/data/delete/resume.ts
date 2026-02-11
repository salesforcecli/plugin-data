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
