/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
