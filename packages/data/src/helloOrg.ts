/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection, Logger, Messages, SfdxError, Org } from '@salesforce/core';
import { AsyncCreatable } from '@salesforce/kit';
import { ensure, Nullable } from '@salesforce/ts-types';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname, true, '@salesforce/data');
const messages = Messages.loadMessages('@salesforce/data', 'org');

// comment asdf
export class HelloOrg extends AsyncCreatable<HelloOrg.Options> {
  private logger!: Logger;
  private connection: Connection;
  private username: string;
  private orgId: string;
  private org: Org;

  public constructor(opts: HelloOrg.Options) {
    super(opts);
    this.org = ensure(opts.org);
    this.connection = this.org.getConnection();
    this.username = opts.username;
    this.orgId = this.org.getOrgId();
  }

  public async getHelloMessage(): Promise<string> {
    this.logger.debug('getting hello message');
    const details = await this.query();
    let msg = `Hello ${this.username}! This is org: ${details.name}`;
    if (details.expiration) {
      const date = new Date(details.expiration).toDateString();
      msg = `${msg} and I will be around until ${date}!`;
    }
    return msg;
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
  }

  private async query(): Promise<HelloOrg.OrgDetails> {
    const query = 'Select Name, TrialExpirationDate from Organization';
    const result = await this.connection.query<HelloOrg.OrgQueryResult>(query);

    if (!result.records || result.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoOrgResults', [this.orgId]));
    }

    const name = result.records[0].Name;
    const expiration = result.records[0].TrialExpirationDate;
    return { name, expiration };
  }
}

namespace HelloOrg {
  export interface Options {
    org: Nullable<Org>;
    username: string;
  }

  export interface OrgQueryResult {
    Name: string;
    TrialExpirationDate: string;
  }

  export interface OrgDetails {
    name: string;
    expiration?: string;
  }
}
