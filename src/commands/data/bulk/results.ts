/*
 * Copyright 2025, Salesforce, Inc.
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

import { EOL } from 'node:os';
import { writeFile } from 'node:fs/promises';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import ansis from 'ansis';
import { JobInfoV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'data.bulk.results');

export type DataBulkResultsResult = {
  status: JobInfoV2['state'];
  operation: JobInfoV2['operation'];
  object: JobInfoV2['object'];
  processedRecords: number;
  successfulRecords?: number;
  failedRecords?: number;
  successFilePath: string;
  failedFilePath?: string;
  unprocessedFilePath?: string;
};

export default class DataBulkResults extends SfCommand<DataBulkResultsResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'job-id': Flags.salesforceId({
      summary: messages.getMessage('flags.job-id.summary'),
      char: 'i',
      required: true,
      startsWith: '750',
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<DataBulkResultsResult> {
    const { flags } = await this.parse(DataBulkResults);

    const conn = flags['target-org'].getConnection(flags['api-version']);

    const job = conn.bulk2.job('ingest', {
      id: flags['job-id'],
    });

    const jobInfo = await job.check().catch((error: Error) => {
      if (error.message === 'The requested resource does not exist') {
        throw messages.createError('error.invalidId', [job.id], [conn.getUsername()]);
      }
      throw error;
    });

    this.log(`Status: ${ansis.bold(jobInfo.state)}`);
    this.log(`Operation: ${ansis.bold(jobInfo.operation)}`);
    this.log(`Object: ${ansis.bold(jobInfo.object)}${EOL}`);

    // `errorMessage` is only available for job with state = `Failed`
    if (jobInfo.errorMessage) {
      this.warn(`Job failed due to:${EOL}${jobInfo.errorMessage}${EOL}`);
    }

    if (jobInfo.numberRecordsProcessed === 0) {
      throw messages.createError('error.noRecords');
    }

    this.log(`Processed records: ${ansis.bold(jobInfo.numberRecordsProcessed.toString())}`);

    if (jobInfo.numberRecordsFailed > 0) {
      this.log(`Failed records: ${ansis.bold(jobInfo.numberRecordsFailed.toString())}${EOL}`);

      if (jobInfo.state === 'JobComplete') {
        // we can only calculate successful records if the job was completed.
        //
        // aborted/failed jobs could have:
        //   numberRecordsProcessed = 100
        //   numberRecordsFailed = 10
        //
        // those 90 can be either successful or unprocessed records.
        this.log(`Successful records: ${jobInfo.numberRecordsProcessed - jobInfo.numberRecordsFailed}${EOL}`);
      }
    } else if (jobInfo.numberRecordsFailed === 0 && jobInfo.state === 'JobComplete') {
      // Job was completed so there's no unprocessed records and with 0 record failures we can assume all proccesed records were successful
      this.log(`Successful records: ${ansis.bold(jobInfo.numberRecordsProcessed.toString())}${EOL}`);
    }

    // `--job-id` can be an 15-18 length ID but the API always returns the 18-length one,
    // prefer flag value for file paths so they match what the user passes.
    const successFilePath = `${flags['job-id']}-success-records.csv`;
    const failedFilePath = `${flags['job-id']}-failed-records.csv`;
    const unprocessedFilePath = `${flags['job-id']}-unprocessed-records.csv`;

    switch (jobInfo.state) {
      case 'Open':
      case 'UploadComplete':
      case 'InProgress':
        throw messages.createError('error.jobInProgress');
      case 'JobComplete':
        await writeFile(successFilePath, await job.getSuccessfulResults(true));
        this.log(`Saved successful results to ${ansis.bold(successFilePath)}`);

        if (jobInfo.numberRecordsFailed > 0) {
          await writeFile(failedFilePath, await job.getFailedResults(true));
          this.log(`Saved failed results to ${ansis.bold(failedFilePath)}`);
        }

        return {
          processedRecords: jobInfo.numberRecordsProcessed,
          successfulRecords:
            jobInfo.numberRecordsFailed === 0
              ? jobInfo.numberRecordsProcessed
              : jobInfo.numberRecordsProcessed - jobInfo.numberRecordsFailed,
          failedRecords: jobInfo.numberRecordsFailed,
          status: jobInfo.state,
          operation: jobInfo.operation,
          object: jobInfo.object,
          successFilePath,
          failedFilePath: jobInfo.numberRecordsFailed > 0 ? failedFilePath : undefined,
        };
      case 'Aborted':
      case 'Failed':
        await writeFile(successFilePath, await job.getSuccessfulResults(true));
        this.log(`Saved successful results to ${ansis.bold(successFilePath)}`);

        if (jobInfo.numberRecordsFailed > 0) {
          await writeFile(failedFilePath, await job.getFailedResults(true));
          this.log(`Saved failed results to ${ansis.bold(failedFilePath)}`);
        }

        await writeFile(unprocessedFilePath, await job.getUnprocessedRecords(true));
        this.log(`Saved unprocessed results to ${ansis.bold(unprocessedFilePath)}`);

        return {
          processedRecords: jobInfo.numberRecordsProcessed,
          failedRecords: jobInfo.numberRecordsFailed,
          status: jobInfo.state,
          operation: jobInfo.operation,
          object: jobInfo.object,
          successFilePath,
          failedFilePath: jobInfo.numberRecordsFailed > 0 ? failedFilePath : undefined,
          unprocessedFilePath,
        };
    }
  }
}
