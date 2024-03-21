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
} from '@jsforce/jsforce-node/lib/api/bulk2.js';

import { Schema } from '@jsforce/jsforce-node';
import { Connection, Messages } from '@salesforce/core';
import { BulkProcessedRecordV2, BulkRecordsV2 } from './types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export const POLL_FREQUENCY_MS = 5000;

export const isBulkV2RequestDone = (jobInfo: JobInfoV2): boolean =>
  ['Aborted', 'Failed', 'JobComplete'].includes(jobInfo.state);

export const transformResults = (results: IngestJobV2Results<Schema>): BulkRecordsV2 => ({
  // ensureArray is used to handle the undefined or non-array case
  successfulResults: results.successfulResults.map(anyRecordToBulkProcessedRecordV2),
  failedResults: results.failedResults.map(anyRecordToBulkProcessedRecordV2),
  // if the csv can't be read, it returns a string that is the csv body
  ...(typeof results.unprocessedRecords === 'string'
    ? { unprocessedRecords: [], unparsed: results.unprocessedRecords }
    : { unprocessedRecords: results.unprocessedRecords.map(anyRecordToBulkProcessedRecordV2) }),
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

/** calculate ms between the "now" time and the endWaitTime */
export const remainingTime =
  (now: number) =>
  (endWaitTime?: number): number =>
    Math.max((endWaitTime ?? now) - now, 0);
