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
