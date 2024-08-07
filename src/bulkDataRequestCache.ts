/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TTLConfig, Global, Logger, Messages, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import type { ResumeOptions } from './types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export type BulkDataCacheConfig = {
  username: string;
  jobId: string;
  apiVersion: string;
};

export abstract class BulkDataRequestCache extends TTLConfig<TTLConfig.Options, BulkDataCacheConfig> {
  public static getDefaultOptions(): TTLConfig.Options {
    return {
      isGlobal: true,
      isState: true,
      filename: BulkDataRequestCache.getFileName(),
      stateFolder: Global.SF_STATE_FOLDER,
      ttl: Duration.days(3),
    };
  }

  /**
   * Creates a new bulk data request cache entry for the given bulk request id.
   *
   * @param bulkRequestId
   * @param username
   */
  public async createCacheEntryForRequest(
    bulkRequestId: string,
    username: string | undefined,
    apiVersion: string | undefined
  ): Promise<void> {
    if (!username) {
      throw messages.createError('usernameRequired');
    }
    this.set(bulkRequestId, {
      jobId: bulkRequestId,
      username,
      apiVersion,
    });
    await this.write();
    Logger.childFromRoot('DataRequestCache').debug(`bulk cache saved for ${bulkRequestId}`);
  }

  public async resolveResumeOptionsFromCache(
    bulkJobId: string | undefined,
    useMostRecent: boolean,
    org: Org | undefined,
    apiVersion: string | undefined
  ): Promise<ResumeOptions> {
    if (!useMostRecent && !bulkJobId) {
      throw messages.createError('bulkRequestIdRequiredWhenNotUsingMostRecent');
    }
    const resumeOptionsOptions = {
      operation: 'query',
      query: '',
      pollingOptions: { pollTimeout: 0, pollInterval: 0 },
    } satisfies Pick<ResumeOptions['options'], 'operation' | 'query' | 'pollingOptions'>;

    if (useMostRecent) {
      const key = this.getLatestKey();
      if (key) {
        // key definitely exists because it came from the cache
        const entry = this.get(key);

        return {
          jobInfo: { id: entry.jobId },
          options: {
            ...resumeOptionsOptions,
            connection: (await Org.create({ aliasOrUsername: entry.username })).getConnection(apiVersion),
          },
        };
      }
    }
    if (bulkJobId) {
      const entry = this.get(bulkJobId);
      if (entry) {
        return {
          jobInfo: { id: entry.jobId },
          options: {
            ...resumeOptionsOptions,
            connection: (await Org.create({ aliasOrUsername: entry.username })).getConnection(apiVersion),
          },
        };
      } else if (org) {
        return {
          jobInfo: { id: bulkJobId },
          options: {
            ...resumeOptionsOptions,
            connection: org.getConnection(apiVersion),
          },
        };
      } else {
        throw messages.createError('cannotCreateResumeOptionsWithoutAnOrg');
      }
    } else if (useMostRecent) {
      throw messages.createError('cannotFindMostRecentCacheEntry');
    } else {
      throw messages.createError('bulkRequestIdRequiredWhenNotUsingMostRecent');
    }
  }
}

export class BulkQueryRequestCache extends BulkDataRequestCache {
  public static getDefaultOptions(): TTLConfig.Options {
    return {
      isGlobal: true,
      isState: true,
      filename: BulkQueryRequestCache.getFileName(),
      stateFolder: Global.SF_STATE_FOLDER,
      ttl: Duration.days(3),
    };
  }

  public static getFileName(): string {
    return 'bulk-data-query-cache.json';
  }

  public static async unset(key: string): Promise<void> {
    const cache = await BulkQueryRequestCache.create();
    cache.unset(key);
    await cache.write();
  }
}
export class BulkDeleteRequestCache extends BulkDataRequestCache {
  public static getDefaultOptions(): TTLConfig.Options {
    return {
      isGlobal: true,
      isState: true,
      filename: BulkDeleteRequestCache.getFileName(),
      stateFolder: Global.SF_STATE_FOLDER,
      ttl: Duration.days(3),
    };
  }

  public static getFileName(): string {
    return 'bulk-data-delete-cache.json';
  }

  public static async unset(key: string): Promise<void> {
    const cache = await BulkDeleteRequestCache.create();
    cache.unset(key);
    await cache.write();
  }
}

export class BulkUpsertRequestCache extends BulkDataRequestCache {
  public static getDefaultOptions(): TTLConfig.Options {
    return {
      isGlobal: true,
      isState: true,
      filename: BulkUpsertRequestCache.getFileName(),
      stateFolder: Global.SF_STATE_FOLDER,
      ttl: Duration.days(3),
    };
  }

  public static getFileName(): string {
    return 'bulk-data-upsert-cache.json';
  }

  public static async unset(key: string): Promise<void> {
    const cache = await BulkUpsertRequestCache.create();
    cache.unset(key);
    await cache.write();
  }
}
