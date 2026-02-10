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
