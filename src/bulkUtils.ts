/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { IngestJobV2Results, JobInfoV2 } from 'jsforce/lib/api/bulk';
import { Schema } from 'jsforce';
import { Connection, Messages } from '@salesforce/core';
import { BulkProcessedRecordV2, BulkRecordsV2 } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export const isBulkV2RequestDone = (jobInfo: JobInfoV2): boolean =>
  ['Aborted', 'Failed', 'JobComplete'].includes(jobInfo.state);

export const didBulkV2RequestJobFail = (jobInfo: JobInfoV2): boolean => ['Aborted', 'Failed'].includes(jobInfo.state);

export const transformResults = (results: IngestJobV2Results<Schema>): BulkRecordsV2 => ({
  successfulResults: results.successfulResults.map((record) => record as unknown as BulkProcessedRecordV2),
  failedResults: results.failedResults.map((record) => record as unknown as BulkProcessedRecordV2),
  unprocessedRecords: results.unprocessedRecords.map((record) => record as unknown as BulkProcessedRecordV2),
});

export const validateSobjectType = async (sobjectType: string, connection: Connection): Promise<void> => {
  try {
    await connection.sobject(sobjectType).describe();
  } catch (e) {
    throw new Error(messages.getMessage('invalidSobject', [sobjectType, (e as Error).message]));
  }
};
