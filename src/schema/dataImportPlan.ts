/*
 * Copyright 2026, Salesforce, Inc.
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
import { z } from 'zod';

export const DataImportPlanArraySchema = z
  .array(
    z.object({
      sobject: z.string().describe('Child file references must have SObject roots of this type'),
      saveRefs: z
        .boolean()
        .optional()
        .describe(
          'Post-save, save references (Name/ID) to be used for reference replacement in subsequent saves.  Applies to all data files for this SObject type.'
        ),
      resolveRefs: z
        .boolean()
        .optional()
        .describe(
          'Pre-save, replace @<reference> with ID from previous save.  Applies to all data files for this SObject type.'
        ),
      files: z
        .array(
          z
            .string('The `files` property of the plan objects must contain only strings')
            .describe(
              'Filepath string or object to point to a JSON or XML file having data defined in SObject Tree format.'
            )
        )
        .describe('An array of files paths to load'),
    })
  )
  .describe('Schema for data import plan JSON');

export type DataImportPlanArray = z.infer<typeof DataImportPlanArraySchema>;
