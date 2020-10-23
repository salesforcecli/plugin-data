/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfdxCommand } from '@salesforce/command';
import { Connection, Messages, SfdxError, Org } from '@salesforce/core';
import { SObjectErrorResult } from '@salesforce/data';
import { AnyJson, ensure } from '@salesforce/ts-types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-data', 'messages');

interface Result {
  status: number;
  result: AnyJson;
  perfMetrics?: Connection.Metric[];
}

export abstract class DataCommand extends SfdxCommand {
  public validateIdXorWhereFlags(): void {
    if (!this.flags.where && !this.flags.sobjectid) {
      throw new SfdxError(messages.getMessage('NeitherSobjectidNorWhereError'), 'NeitherSobjectidNorWhereError', [
        messages.getMessage('NeitherSobjectidNorWhereErrorActions'),
      ]);
    }

    if (!!this.flags.where && !!this.flags.sobjectid) {
      throw new SfdxError(messages.getMessage('BothSobjectidAndWhereError'), 'BothSobjectidAndWhereError', [
        messages.getMessage('BothSobjectidAndWhereErrorActions'),
      ]);
    }
  }

  public collectErrorMessages(result: SObjectErrorResult): string {
    let errors = '';
    if (result.errors) {
      errors = '\nErrors:\n';
      result.errors.forEach((err) => {
        errors += '  ' + err + '\n';
      });
    }
    return errors;
  }

  public getJsonResultObject(result = this.result.data, status = process.exitCode || 0): Result {
    const final: Result = { status, result };
    const perfMetrics = Connection.getMetrics();
    if (perfMetrics.length) final.perfMetrics = perfMetrics;
    return final;
  }

  public async getConnection(): Promise<Connection> {
    const org = ensure<Org>(this.org);
    if (this.flags.perflog) {
      const authInfo = org.getConnection().getAuthInfo();
      const connection = await Connection.create({ authInfo, perfOption: 'MINIMUM' });
      return connection;
    } else {
      return org.getConnection();
    }
  }
}
