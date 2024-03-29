/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BatchInfo, JobInfo } from '@jsforce/jsforce-node/lib/api/bulk.js';
import { JobInfoV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';

import { Connection } from '@salesforce/core';

export type GenericEntry = [string, unknown];
export type GenericObject = Record<string, unknown>;

export type BulkProcessedRecordV2 = {
  sf__Created?: 'true' | 'false';
  sf__Id?: string;
} & GenericObject;

export type BulkRecordsV2 = {
  successfulResults: BulkProcessedRecordV2[];
  failedResults: BulkProcessedRecordV2[];
  unprocessedRecords: Array<Exclude<BulkProcessedRecordV2, 'sf__Created' | 'sf__id'>>;
  unparsed?: string;
};

export type StatusResult = BatchInfo[] | JobInfo;

export type BulkOperation = 'query' | 'upsert' | 'delete';

export type ResumeOptions = {
  options: {
    operation: BulkOperation;
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
