/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type {
  JobInfoV2,
  IngestJobV2Results,
  IngestJobV2SuccessfulResults,
  IngestJobV2FailedResults,
  IngestJobV2UnprocessedRecords,
} from 'jsforce/lib/api/bulk2.js';

import { Schema } from 'jsforce';
import { Connection, Messages } from '@salesforce/core';
import { ensureArray } from '@salesforce/kit';
import { BulkProcessedRecordV2, BulkRecordsV2 } from './types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export const POLL_FREQUENCY_MS = 5000;

export const isBulkV2RequestDone = (jobInfo: JobInfoV2): boolean =>
  ['Aborted', 'Failed', 'JobComplete'].includes(jobInfo.state);

export const transformResults = (results: IngestJobV2Results<Schema>): BulkRecordsV2 => ({
  // ensureArray is used to handle the undefined or non-array case
  successfulResults: ensureArray(results.successfulResults).map(anyRecordToBulkProcessedRecordV2),
  failedResults: ensureArray(results.failedResults).map(anyRecordToBulkProcessedRecordV2),
  unprocessedRecords: ensureArray(results.unprocessedRecords).map(anyRecordToBulkProcessedRecordV2),
});

const anyRecordToBulkProcessedRecordV2 = (
  record:
    | IngestJobV2SuccessfulResults<Schema>[number]
    | IngestJobV2UnprocessedRecords<Schema>[number]
    | IngestJobV2FailedResults<Schema>[number]
): BulkProcessedRecordV2 => record as unknown as BulkProcessedRecordV2;

/** call the describe to verify the object exists in the org  */
export const validateSobjectType = async (sobjectType: string, connection: Connection): Promise<string> => {
  try {
    await connection.sobject(sobjectType).describe();
    return sobjectType;
  } catch (e) {
    throw new Error(messages.getMessage('invalidSobject', [sobjectType, (e as Error).message]));
  }
};
export const remainingTime =
  (now: number) =>
  (endWaitTime?: number): number =>
    Math.max(endWaitTime ?? now - now, 0);
