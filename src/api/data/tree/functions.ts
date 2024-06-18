/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SObjectTreeInput } from '../../../types.js';

/** This is the format for references created by the export command */
const genericRefRegex = new RegExp('^@\\w+Ref\\d+$');

export const isUnresolvedRef = (v: unknown): boolean => typeof v === 'string' && genericRefRegex.test(v);

/** at least record in the array has at least one property value that matches the regex */
export const hasUnresolvedRefs = (records: SObjectTreeInput[]): boolean =>
  records.some((r) => Object.values(r).some(isUnresolvedRef));
