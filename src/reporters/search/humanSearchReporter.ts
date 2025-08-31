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
import { SearchResult } from '@jsforce/jsforce-node';
import { SearchReporter } from './reporter.js';

export class HumanSearchReporter extends SearchReporter {
  public constructor(props: SearchResult) {
    super(props);
  }

  public display(): void {
    if (this.typeRecordsMap.size === 0) {
      this.ux.log('No Records Found');
    }
    this.typeRecordsMap.forEach((records, type) => {
      this.ux.table({
        data: records,
        overflow: 'wrap',
        title: type,
      });
      this.ux.log();
    });
  }
}
