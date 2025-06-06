/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TTLConfig, Global, Logger, Messages, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import type { ResumeBulkExportOptions, ResumeBulkImportOptions } from './types.js';
import { ColumnDelimiterKeys } from './bulkUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

export type BulkDataCacheConfig = {
  username: string;
  jobId: string;
  apiVersion: string;
};

export type BulkExportCacheConfig = {
  username: string;
  outputInfo: {
    filePath: string;
    format: 'csv' | 'json';
    columnDelimiter: ColumnDelimiterKeys;
  };
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

  /**
   * Resolve entries from the local cache.
   *
   * @param jobIdOrMostRecent job ID or boolean value to decide if it should return the most recent entry in the cache.
   * @param skipCacheValidatation make this method not throw if you passed a job ID that's not in the cache
   * This was only added for `data upsert/delete resume` for backwards compatibility and will be removed after March 2025.
   */
  public async resolveResumeOptionsFromCache(jobIdOrMostRecent: string | boolean): Promise<ResumeBulkImportOptions> {
    if (typeof jobIdOrMostRecent === 'boolean') {
      const key = this.getLatestKey();
      if (!key) {
        throw messages.createError('error.missingCacheEntryError');
      }
      // key definitely exists because it came from the cache
      const entry = this.get(key);

      return {
        jobInfo: { id: entry.jobId },
        options: {
          connection: (await Org.create({ aliasOrUsername: entry.username })).getConnection(),
        },
      };
    } else {
      const entry = this.get(jobIdOrMostRecent);
      if (!entry) {
        throw messages.createError('error.bulkRequestIdNotFound', [jobIdOrMostRecent]);
      }

      return {
        jobInfo: { id: entry.jobId },
        options: {
          connection: (await Org.create({ aliasOrUsername: entry.username })).getConnection(),
        },
      };
    }
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

export class BulkImportRequestCache extends TTLConfig<TTLConfig.Options, BulkExportCacheConfig> {
  public static getDefaultOptions(): TTLConfig.Options {
    return {
      isGlobal: true,
      isState: true,
      filename: BulkImportRequestCache.getFileName(),
      stateFolder: Global.SF_STATE_FOLDER,
      ttl: Duration.days(7),
    };
  }

  public static getFileName(): string {
    return 'bulk-data-import-cache.json';
  }

  public static async unset(key: string): Promise<void> {
    const cache = await BulkImportRequestCache.create();
    cache.unset(key);
    await cache.write();
  }

  /**
   * Creates a new bulk data import cache entry for the given bulk request id.
   *
   * @param bulkRequestId
   * @param username
   * @param apiVersion
   */
  public async createCacheEntryForRequest(bulkRequestId: string, username: string, apiVersion: string): Promise<void> {
    this.set(bulkRequestId, {
      jobId: bulkRequestId,
      username,
      apiVersion,
    });
    await this.write();
    Logger.childFromRoot('BulkImportCache').debug(`bulk cache saved for ${bulkRequestId}`);
  }

  public async resolveResumeOptionsFromCache(jobIdOrMostRecent: string | boolean): Promise<ResumeBulkImportOptions> {
    if (typeof jobIdOrMostRecent === 'boolean') {
      const key = this.getLatestKey();
      if (!key) {
        throw messages.createError('error.missingCacheEntryError');
      }
      // key definitely exists because it came from the cache
      const entry = this.get(key);

      return {
        jobInfo: { id: entry.jobId },
        options: {
          connection: (await Org.create({ aliasOrUsername: entry.username })).getConnection(),
        },
      };
    } else {
      const entry = this.get(jobIdOrMostRecent);
      if (!entry) {
        throw messages.createError('error.bulkRequestIdNotFound', [jobIdOrMostRecent]);
      }

      return {
        jobInfo: { id: entry.jobId },
        options: {
          connection: (await Org.create({ aliasOrUsername: entry.username })).getConnection(),
        },
      };
    }
  }
}

export class BulkUpdateRequestCache extends TTLConfig<TTLConfig.Options, BulkExportCacheConfig> {
  public static getDefaultOptions(): TTLConfig.Options {
    return {
      isGlobal: true,
      isState: true,
      filename: BulkUpdateRequestCache.getFileName(),
      stateFolder: Global.SF_STATE_FOLDER,
      ttl: Duration.days(7),
    };
  }

  public static getFileName(): string {
    return 'bulk-data-update-cache.json';
  }

  public static async unset(key: string): Promise<void> {
    const cache = await BulkImportRequestCache.create();
    cache.unset(key);
    await cache.write();
  }

  /**
   * Creates a new bulk data import cache entry for the given bulk request id.
   *
   * @param bulkRequestId
   * @param username
   * @param apiVersion
   */
  public async createCacheEntryForRequest(bulkRequestId: string, username: string, apiVersion: string): Promise<void> {
    this.set(bulkRequestId, {
      jobId: bulkRequestId,
      username,
      apiVersion,
    });
    await this.write();
    Logger.childFromRoot('BulkUpdateCache').debug(`bulk cache saved for ${bulkRequestId}`);
  }

  public async resolveResumeOptionsFromCache(jobIdOrMostRecent: string | boolean): Promise<ResumeBulkImportOptions> {
    if (typeof jobIdOrMostRecent === 'boolean') {
      const key = this.getLatestKey();
      if (!key) {
        throw messages.createError('error.missingCacheEntryError');
      }
      // key definitely exists because it came from the cache
      const entry = this.get(key);

      return {
        jobInfo: { id: entry.jobId },
        options: {
          connection: (await Org.create({ aliasOrUsername: entry.username })).getConnection(),
        },
      };
    } else {
      const entry = this.get(jobIdOrMostRecent);
      if (!entry) {
        throw messages.createError('error.bulkRequestIdNotFound', [jobIdOrMostRecent]);
      }

      return {
        jobInfo: { id: entry.jobId },
        options: {
          connection: (await Org.create({ aliasOrUsername: entry.username })).getConnection(),
        },
      };
    }
  }
}

export class BulkExportRequestCache extends TTLConfig<TTLConfig.Options, BulkExportCacheConfig> {
  public static getDefaultOptions(): TTLConfig.Options {
    return {
      isGlobal: true,
      isState: true,
      filename: BulkExportRequestCache.getFileName(),
      stateFolder: Global.SF_STATE_FOLDER,
      ttl: Duration.days(7),
    };
  }

  public static getFileName(): string {
    return 'bulk-data-export-cache.json';
  }

  public static async unset(key: string): Promise<void> {
    const cache = await BulkUpsertRequestCache.create();
    cache.unset(key);
    await cache.write();
  }

  /**
   * Creates a new bulk export request cache entry for the given id.
   */
  public async createCacheEntryForRequest(
    bulkRequestId: string,
    outputInfo: {
      filePath: string;
      format: 'csv' | 'json';
      columnDelimiter: ColumnDelimiterKeys;
    },
    username: string | undefined,
    apiVersion: string | undefined
  ): Promise<void> {
    if (!username) {
      throw messages.createError('usernameRequired');
    }
    this.set(bulkRequestId, {
      jobId: bulkRequestId,
      outputInfo,
      username,
      apiVersion,
    });
    await this.write();
    Logger.childFromRoot('BulkExportCache').debug(`bulk cache saved for ${bulkRequestId}`);
  }

  public async resolveResumeOptionsFromCache(
    jobIdOrMostRecent: string | boolean,
    apiVersion: string | undefined
  ): Promise<ResumeBulkExportOptions> {
    if (typeof jobIdOrMostRecent === 'boolean') {
      const key = this.getLatestKey();
      if (!key) {
        throw messages.createError('error.missingCacheEntryError');
      }
      // key definitely exists because it came from the cache
      const entry = this.get(key);

      return {
        jobInfo: { id: entry.jobId },
        outputInfo: {
          filePath: entry.outputInfo.filePath,
          format: entry.outputInfo.format,
          columnDelimiter: entry.outputInfo.columnDelimiter,
        },
        options: {
          connection: (await Org.create({ aliasOrUsername: entry.username })).getConnection(apiVersion),
        },
      };
    } else {
      const entry = this.get(jobIdOrMostRecent);
      if (!entry) {
        throw messages.createError('error.bulkRequestIdNotFound', [jobIdOrMostRecent]);
      }

      return {
        jobInfo: { id: entry.jobId },
        outputInfo: entry.outputInfo,
        options: {
          connection: (await Org.create({ aliasOrUsername: entry.username })).getConnection(apiVersion),
        },
      };
    }
  }
}
