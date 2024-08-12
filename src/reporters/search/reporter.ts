/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Ux } from '@salesforce/sf-plugins-core';
import { Record, SearchResult } from '@jsforce/jsforce-node';
import { ensureString } from '@salesforce/ts-types';
import { omit } from '@salesforce/kit';

export abstract class SearchReporter {
  public typeRecordsMap: Map<string, Record[]> = new Map<string, Record[]>();
  public ux = new Ux();
  protected constructor(public result: SearchResult) {
    this.result.searchRecords.map((r) => {
      const type = ensureString(r.attributes?.type);
      return this.typeRecordsMap.has(type)
        ? // the extra info in 'attributes' causes issues when creating generic csv/table columns
          this.typeRecordsMap.get(type)!.push(omit(r, 'attributes'))
        : this.typeRecordsMap.set(type, [omit(r, 'attributes')]);
    });
  }
  public abstract display(): void;
}

export class JsonSearchReporter extends SearchReporter {
  public constructor(props: SearchResult) {
    super(props);
  }

  public display(): void {
    this.ux.styledJSON(this.result);
  }
}
