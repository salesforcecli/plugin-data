/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { JobInfoV2 } from 'jsforce/api/bulk';
import { BulkResultV2 } from './types';

function isJobInfo(results: BulkResultV2): results is JobInfoV2 {
  return (results as JobInfoV2).id !== undefined;
}

export const isBulkV2RequestDone = (results: BulkResultV2): boolean => {
  if (isJobInfo(results)) {
    return ['Aborted', 'Failed', 'JobComplete'].includes(results.state);
  }
  return true
}

export const didBulkV2RequestJobFail = (results: BulkResultV2): boolean => {
  if (isJobInfo(results)) {
    return ['Aborted', 'Failed'].includes(results.state);
  }
  return false;
};
