/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection, QueryResult } from 'jsforce';
import { Logger, Messages, Org, SfdxError } from '@salesforce/core';
import { CsvReporter, FormatTypes, HumanReporter, JsonReporter, QueryReporter } from './reporters';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'soql.query');

const logger = Logger.childFromRoot('dataSoqlQuery');

/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/restrict-template-expressions */
const handleResults = async function (
  conn: Connection,
  result: QueryResult<unknown>,
  reporter: QueryReporter
): Promise<QueryResult<unknown>> {
  if (result.records && result.records.length > 0) {
    await reporter.retrieveColumns();

    // get all result batches
    let moreResults: QueryResult<unknown> = result;
    while (!moreResults.done) {
      if (moreResults.nextRecordsUrl) {
        moreResults = await conn.queryMore(moreResults.nextRecordsUrl);
        if (moreResults.records) {
          result.records = result.records.concat(moreResults.records);
        } else {
          throw Error(messages.getMessage('queryMoreMissingRecords'));
        }
      } else {
        throw Error(messages.getMessage('queryMoreMissingUrl'));
      }
    }
    if (result.records) {
      reporter.emit('finished', result.records);
    } else {
      throw Error(messages.getMessage('queryMoreMissingRecords'));
    }
  } else if (!(reporter instanceof JsonReporter)) {
    logger.info(messages.getMessage('queryNoResults'));
  }

  // Clean result for consumer
  delete result.nextRecordsUrl;
  result.done = true;
  return result;
};

export class DataSoqlQueryExecutor {
  private context: any;

  public validate(context: any): any {
    if (context.flags.json) {
      context.flags.resultformat = 'json';
    } else if (context.flags.resultformat === 'json') {
      // If the result format is json, make sure the context is too
      context.flags.json = true;
    }
    return context;
  }

  public async execute(context: any): Promise<QueryResult<unknown>> {
    this.context = context;
    this.context.ux.startSpinner('Querying Data');
    const resultFormat: string = context.flags.resultformat || 'human';
    const formatType = resultFormat as keyof typeof FormatTypes;

    if (!formatType) {
      this.context.ux.stopSpinner();
      throw Error(messages.getMessage('queryInvalidReporter', Object.keys(FormatTypes)));
    }

    if (!context.flags.query) {
      this.context.ux.stopSpinner();
      throw Error(this.context.command);
    }

    const org = await Org.create({ aliasOrUsername: this.context.flags.username });
    let conn = org.getConnection();

    if (this.context.flags.usetoolingapi) {
      conn = conn.tooling as any;
    }
    // Reporter requires a legacy logapi type
    // let reporter = new FormatTypes[resultFormat as keyof typeof FormatTypes](conn, this.context.flags.query, context);
    let reporter;
    switch (resultFormat as keyof typeof FormatTypes) {
      case 'human':
        reporter = new HumanReporter(conn, this.context.flags.query, context);
        break;
      case 'json':
        reporter = new JsonReporter(conn, this.context.flags.query, context);
        break;
      case 'csv':
        reporter = new CsvReporter(conn, this.context.flags.query, context);
        break;
    }
    // eslint-disable-next-line no-console
    const result = await conn.query(this.context.flags.query).catch((reason) => {
      throw new SfdxError(reason.message ?? reason);
    });
    context.ux.stopSpinner();
    return await handleResults(conn, result, reporter);
  }
}
