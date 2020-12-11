/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable  @typescript-eslint/no-explicit-any */

export async function sequentialExecute(funcs: any[]): Promise<any> {
  let result = Promise.resolve();
  funcs.forEach((promiseFactory) => {
    result = result.then(promiseFactory);
  });
  return result;
}
