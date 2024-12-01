/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Dictionary } from '@salesforce/ts-types';
import type { DataPlanPart } from '../../../types.js';

/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export type TreeResponse = TreeResponseSuccess | TreeResponseError;

type TreeResponseSuccess = {
  hasErrors: false;
  results: Array<{
    referenceId: string;
    id: string;
  }>;
};

type TreeResponseError = {
  hasErrors: true;
  results: Array<{
    referenceId: string;
    errors: Array<{
      statusCode: string;
      message: string;
      fields: string[];
    }>;
  }>;
};

export type ResponseRefs = {
  referenceId: string;
  id: string;
};
export type ImportResults = {
  responseRefs?: ResponseRefs[];
  sobjectTypes?: Dictionary;
  errors?: string[];
};

export type ImportResult = {
  refId: string;
  type: string;
  id: string;
}; /** like the original DataPlanPart but without the non-string options inside files */

export type DataPlanPartFilesOnly = {
  sobject: string;
  files: string[];
  saveRefs: boolean;
  resolveRefs: boolean;
} & Partial<DataPlanPart>;
