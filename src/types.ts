/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BatchInfo, JobInfo, QueryOperation } from 'jsforce/lib/api/bulk';
import { Connection } from '@salesforce/core';
import { JobInfoV2 } from 'jsforce/api/bulk';

export type BulkProcessedRecordV2 = {
  sf__Created: 'true' | 'false';
  sf__Id: string;
} & Record<string, unknown>;

export type BulkRecordsV2 = {
  successfulResults: BulkProcessedRecordV2[];
  failedResults: BulkProcessedRecordV2[];
  unprocessedRecords: Array<Exclude<BulkProcessedRecordV2, 'sf__Created' | 'sf__id'>>;
};

export type StatusResult = BatchInfo[] | JobInfo;

export type ResumeOptions = {
  options: {
    operation: QueryOperation;
    pollingOptions: { pollTimeout: number; pollInterval: number };
    query: string;
    connection: Connection;
  };
  jobInfo: { id: string };
};

export type BulkResultV2 = {
  jobInfo: JobInfoV2;
  records?: BulkRecordsV2;
};
