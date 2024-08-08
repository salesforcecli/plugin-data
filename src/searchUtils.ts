/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SearchResult } from '@jsforce/jsforce-node';
import { Ux } from '@salesforce/sf-plugins-core';

export const displaySearchResults = (queryResult: SearchResult, resultFormat: 'human' | 'json' | 'csv'): void => {
  let reporter: HumanSearchReporter | JsonSearchReporter | CsvSearchReporter;
  const ux = new Ux();

  switch (resultFormat) {
    case 'human':
      reporter = new HumanSearchReporter(queryResult, ux);
      break;
    case 'csv':
      reporter = new CsvSearchReporter(queryResult, ux);
      break;
    case 'json':
      reporter = new JsonSearchReporter(queryResult, ux);
      break;
  }
  // delegate to selected reporter
  reporter.display();
};

abstract class SearchReporter {
  protected constructor(public result: SearchResult, public ux: Ux) {}
  public abstract display(): void;
}
class HumanSearchReporter extends SearchReporter {
  public constructor(props: SearchResult, ux: Ux) {
    super(props, ux);
  }

  public display(): void {
    // remove 'attributes' property from result and table
    delete this.result.searchRecords[0].attributes;
    this.ux.table(
      this.result.searchRecords,
      Object.fromEntries(Object.keys(this.result.searchRecords[0]).map((k) => [k, { header: k }])),
      { 'no-truncate': true, title: 'SOSL Query Results' }
    );
  }
}
class CsvSearchReporter extends SearchReporter {
  public constructor(props: SearchResult, ux: Ux) {
    super(props, ux);
  }

  public display(): void {
    // remove 'attributes' property from result and csv output
    this.result.searchRecords.map((r) => delete r.attributes);

    const cols = Object.keys(this.result.searchRecords[0]);
    this.ux.log(cols.join(','));
    this.result.searchRecords.map((record) => this.ux.log(Object.values(record).join(',')));
  }
}

class JsonSearchReporter extends SearchReporter {
  public constructor(props: SearchResult, ux: Ux) {
    super(props, ux);
  }

  public display(): void {
    this.ux.styledJSON(this.result);
  }
}
