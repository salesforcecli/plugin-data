/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
      // to find the columns of the query, parse the keys of the first record
      this.ux.table(records, Object.fromEntries(Object.keys(records[0]).map((k) => [k, { header: k }])), {
        'no-truncate': true,
        title: `${type} Results`,
      });
      this.ux.log();
    });
  }
}
