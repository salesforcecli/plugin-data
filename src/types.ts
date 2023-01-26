/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BatchInfo, JobInfo, QueryOperation } from 'jsforce/lib/api/bulk';
import { Connection } from '@salesforce/core';
import { IngestJobV2Results, JobInfoV2 } from 'jsforce/api/bulk';
import { Schema } from 'jsforce';

export type StatusResult = BatchInfo[] | JobInfo;
export type StatusResultV2 = JobInfoV2;

export type ResumeOptions = {
  options: {
    operation: QueryOperation;
    pollingOptions: { pollTimeout: number; pollInterval: number };
    query: string;
    connection: Connection;
  };
  jobInfo: { id: string };
};

export type BulkResultV2<J extends Schema = Schema> = JobInfoV2 | IngestJobV2Results<J>;

