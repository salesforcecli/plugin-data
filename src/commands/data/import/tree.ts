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

import { Messages, SfError } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { ensureString, isObject } from '@salesforce/ts-types';
import { importFromPlan } from '../../../api/data/tree/importPlan.js';
import { importFromFiles } from '../../../api/data/tree/importFiles.js';
import { orgFlags } from '../../../flags.js';
import type { ImportResult, TreeResponse } from '../../../api/data/tree/importTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'tree.import');

/**
 * Command that provides data import capability via the SObject Tree Save API.
 */
export default class Import extends SfCommand<ImportResult[]> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:data:tree:import'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    ...orgFlags,
    files: Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.files.summary'),
      exactlyOne: ['files', 'plan'],
      aliases: ['sobjecttreefiles'],
      deprecateAliases: true,
      multiple: true,
      delimiter: ',',
    }),
    plan: Flags.file({
      char: 'p',
      summary: messages.getMessage('flags.plan.summary'),
      description: messages.getMessage('flags.plan.description'),
      exactlyOne: ['files', 'plan'],
      exists: true,
    }),
  };

  public async run(): Promise<ImportResult[]> {
    const { flags } = await this.parse(Import);

    const conn = flags['target-org'].getConnection(flags['api-version']);

    try {
      const { results, warnings } = flags.plan
        ? await importFromPlan(conn, flags.plan)
        : await importFromFiles(conn, flags.files ?? []);
      for (const warning of warnings) {
        this.warn(warning);
      }

      this.table({
        data: results,
        columns: [
          { key: 'refId', name: 'Reference ID' },
          { key: 'type', name: 'Type' },
          { key: 'id', name: 'ID' },
        ],
        title: 'Import Results',
      });
      return results;
    } catch (err) {
      const error = err as Error;
      if (
        error.cause &&
        error.cause instanceof Error &&
        'data' in error.cause &&
        isObject(error.cause.data) &&
        'message' in error.cause.data
      ) {
        const getTreeResponse = (payload: string): TreeResponse => {
          try {
            return JSON.parse(payload) as TreeResponse;
          } catch (parseErr) {
            // throw original error on invalid JSON payload
            if (parseErr instanceof Error && parseErr.name === 'SyntaxError') {
              throw error;
            }
            throw parseErr;
          }
        };
        const errorData = getTreeResponse(ensureString(error.cause.data.message));

        if (errorData.hasErrors) {
          const errorResults = errorData.results
            .map((result) =>
              result.errors.map((errors) => ({
                referenceId: result.referenceId,
                StatusCode: errors.statusCode,
                Message: errors.message,
                fields: errors.fields.join(', ') || 'N/A',
              }))
            )
            .flat();
          this.table({
            data: errorResults,
            columns: [
              { key: 'referenceId', name: 'Reference ID' },
              { key: 'StatusCode', name: 'Status Code' },
              { key: 'Message', name: 'Error Message' },
              { key: 'fields', name: 'Fields' },
            ],
            title: 'Tree import errors',
          });
          const errors = new SfError('Data Import failed');
          errors.setData(errorResults);
          throw errors;
        }
      }
      throw error;
    }
  }
}
