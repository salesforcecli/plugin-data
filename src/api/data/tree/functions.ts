/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { SObjectTreeInput } from '../../../types.js';

/** This is the format for references created by the export command */
const genericRefRegex = new RegExp('^@\\w+Ref\\d+$');

export const isUnresolvedRef = (v: unknown): boolean => typeof v === 'string' && genericRefRegex.test(v);

/** at least record in the array has at least one property value that matches the regex */
export const hasUnresolvedRefs = (records: SObjectTreeInput[]): boolean =>
  records.some((r) => Object.values(r).some(isUnresolvedRef));
