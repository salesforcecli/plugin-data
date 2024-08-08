/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Ux } from '@salesforce/sf-plugins-core';
import { SearchResult } from '@jsforce/jsforce-node';

export abstract class SearchReporter {
  public types: string[];
  public ux = new Ux();
  protected constructor(public result: SearchResult) {
    this.types = [...new Set(this.result.searchRecords.map((row) => row.attributes?.type ?? ''))];
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
