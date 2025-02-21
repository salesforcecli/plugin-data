/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

export const isErrorCause = (error: Error | SfError): boolean => {
  if (
    error.cause &&
    error.cause instanceof Error &&
    'data' in error.cause &&
    isObject(error.cause.data) &&
    'message' in error.cause.data
  ) {
    return true;
  }
  return false;
};

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
      const results = flags.plan
        ? await importFromPlan(conn, flags.plan)
        : await importFromFiles(conn, flags.files ?? []);

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
        const errorData = JSON.parse(ensureString(error.cause.data.message)) as TreeResponse;

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
          if (errorData.hasErrors) {
            process.exitCode = 1;
          }
        }
      }
      throw error;
    }
  }
}
