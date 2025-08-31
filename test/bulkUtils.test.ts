/*
 * Copyright 2025, Salesforce, Inc.
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

import { expect } from 'chai';

import { detectDelimiter } from '../src/bulkUtils.js';

describe('bulkUtils', () => {
  describe('csv', () => {
    it('detects column separator', async () => {
      expect(await detectDelimiter('./test/test-files/csv/backquote.csv')).to.equal('BACKQUOTE');
      expect(await detectDelimiter('./test/test-files/csv/caret.csv')).to.equal('CARET');
      expect(await detectDelimiter('./test/test-files/csv/comma.csv')).to.equal('COMMA');
      expect(await detectDelimiter('./test/test-files/csv/single-column.csv')).to.equal('COMMA');
      expect(await detectDelimiter('./test/test-files/csv/comma_wrapped_values.csv')).to.equal('COMMA');
      expect(await detectDelimiter('./test/test-files/csv/pipe.csv')).to.equal('PIPE');
      expect(await detectDelimiter('./test/test-files/csv/semicolon.csv')).to.equal('SEMICOLON');
      expect(await detectDelimiter('./test/test-files/csv/tab.csv')).to.equal('TAB');
    });
  });
});
