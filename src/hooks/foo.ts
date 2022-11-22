/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfHook } from '@salesforce/sf-plugins-core';

// eslint-disable-next-line @typescript-eslint/require-await
const hook: SfHook = async function (opts) {
  // eslint-disable-next-line no-console
  console.log('hello from the foo hook');
};

export default hook;
