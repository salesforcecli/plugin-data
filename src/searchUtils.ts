/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import os from 'node:os';
import type { SearchResult } from '@jsforce/jsforce-node';
import { Ux } from '@salesforce/sf-plugins-core';

export const displaySearchResults = (queryResult: SearchResult, resultFormat: 'human' | 'json' | 'csv'): void => {
  let reporter: HumanSearchReporter | JsonSearchReporter | CsvSearchReporter;

  switch (resultFormat) {
    case 'human':
      reporter = new HumanSearchReporter(queryResult);
      break;
    case 'csv':
      reporter = new CsvSearchReporter(queryResult);
      break;
    case 'json':
      reporter = new JsonSearchReporter(queryResult);
      break;
  }
  // delegate to selected reporter
  reporter.display();
};

abstract class SearchReporter {
  public types: string[];
  public ux = new Ux();
  protected constructor(public result: SearchResult) {
    this.types = [...new Set(this.result.searchRecords.map((row) => row.attributes?.type ?? ''))];
  }
  public abstract display(): void;
}
class HumanSearchReporter extends SearchReporter {
  public constructor(props: SearchResult) {
    super(props);
  }

  public display(): void {
    this.types.map((type) => {
      const filtered = this.result.searchRecords.filter((t) => t.attributes?.type === type);
      // remove 'attributes' property from result and table
      delete filtered[0].attributes;
      this.ux.table(filtered, Object.fromEntries(Object.keys(filtered[0]).map((k) => [k, { header: k }])), {
        'no-truncate': true,
        title: `${type} Results`,
      });
      this.ux.log();
    });
  }
}
class CsvSearchReporter extends SearchReporter {
  public constructor(props: SearchResult) {
    super(props);
  }

  public display(): void {
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

class JsonSearchReporter extends SearchReporter {
  public constructor(props: SearchResult) {
    super(props);
  }

  public display(): void {
    this.ux.styledJSON(this.result);
  }
}
