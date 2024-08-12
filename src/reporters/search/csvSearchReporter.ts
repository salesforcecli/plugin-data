/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import os from 'node:os';
import fs from 'node:fs';
import { SearchResult } from '@jsforce/jsforce-node';
import { SearchReporter } from './reporter.js';

export class CsvSearchReporter extends SearchReporter {
  public constructor(props: SearchResult) {
    super(props);
  }

  public display(): void {
    if (this.typeRecordsMap.size === 0) {
      this.ux.log('No Records Found');
    }
    this.typeRecordsMap.forEach((records, type) => {
      this.ux.log(`Written to ${type}.csv`);
      fs.writeFileSync(
        `${type}.csv`,
        // columns, with the rows (...) and then joined with new lines
        [Object.keys(records[0]).join(','), ...records.map((r) => Object.values(r).join(','))].join(os.EOL)
      );
    });
  }
}
