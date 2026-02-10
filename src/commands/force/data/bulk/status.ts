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

import { BatchInfo } from '@jsforce/jsforce-node/lib/api/bulk.js';
import { Messages, SfError } from '@salesforce/core';
import { Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { orgFlags } from '../../../../flags.js';
import { Batcher } from '../../../../batcher.js';
import type { StatusResult } from '../../../../types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'bulk.status');

export default class Status extends SfCommand<StatusResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...orgFlags,
    'batch-id': Flags.salesforceId({
      length: 18,
      char: 'b',
      startsWith: '751',
      summary: messages.getMessage('flags.batch-id.summary'),
      aliases: ['batchid'],
      deprecateAliases: true,
    }),
    'job-id': Flags.salesforceId({
      length: 18,
      char: 'i',
      startsWith: '750',
      summary: messages.getMessage('flags.job-id.summary'),
      required: true,
      aliases: ['jobid'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<StatusResult> {
    const { flags } = await this.parse(Status);
    this.spinner.start('Getting Status');
    const conn = flags['target-org'].getConnection(flags['api-version']);
    const batcher = new Batcher(conn, new Ux({ jsonEnabled: this.jsonEnabled() }));
    if (flags['job-id'] && flags['batch-id']) {
      // view batch status
      const job = conn.bulk.job(flags['job-id']);
      let found = false;

      const batches: BatchInfo[] = await job.list();
      batches.forEach((batch: BatchInfo) => {
        if (batch.id === flags['batch-id']) {
          batcher.bulkStatus(batch);
          found = true;
        }
      });
      if (!found) {
        throw new SfError(messages.getMessage('NoBatchFound', [flags['batch-id'], flags['job-id']]), 'NoBatchFound');
      }

      this.spinner.stop();
      return batches;
    } else {
      // view job status
      const jobStatus = await batcher.fetchAndDisplayJobStatus(flags['job-id']);
      this.spinner.stop();
      return jobStatus;
    }
  }
}
