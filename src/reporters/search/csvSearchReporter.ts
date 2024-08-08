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
    if (this.types.length === 0) {
      this.ux.log('No Records Found');
    }
    this.types.map((type) => {
      const filtered = this.result.searchRecords.filter((t) => t.attributes?.type === type);
      // remove 'attributes' property from result and csv output
      filtered.map((r) => delete r.attributes);

      const cols = Object.keys(filtered[0]).join(',');
      const body = filtered.map((r) => Object.values(r).join(',')).join(os.EOL);

      this.ux.log(`Written to ${type}.csv`);
      fs.writeFileSync(`${type}.csv`, [cols, body].join(os.EOL));
    });
  }
}
