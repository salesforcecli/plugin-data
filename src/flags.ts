/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Flags } from '@oclif/core';

export const stringArrayFlag = Flags.custom<string[]>({
  parse: async (input) => Promise.resolve(input.split(',').map((s) => s.trim())),
});
