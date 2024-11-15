/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';

import { remainingTime, detectDelimiter } from '../src/bulkUtils.js';

describe('bulkUtils', () => {
  describe('csv', () => {
    it('detects column separator', async () => {
      expect(await detectDelimiter('./test/test-files/csv/backquote.csv')).to.equal('BACKQUOTE');
      expect(await detectDelimiter('./test/test-files/csv/caret.csv')).to.equal('CARET');
      expect(await detectDelimiter('./test/test-files/csv/comma.csv')).to.equal('COMMA');
      expect(await detectDelimiter('./test/test-files/csv/comma_wrapped_values.csv')).to.equal('COMMA');
      expect(await detectDelimiter('./test/test-files/csv/pipe.csv')).to.equal('PIPE');
      expect(await detectDelimiter('./test/test-files/csv/semicolon.csv')).to.equal('SEMICOLON');
      expect(await detectDelimiter('./test/test-files/csv/tab.csv')).to.equal('TAB');
    });
  });
  describe('remainingTime', () => {
    it('returns the remaining time when endWaitTime is defined', () => {
      const now = Date.now();
      const endWaitTime = now + 1000;
      const result = remainingTime(now)(endWaitTime);
      expect(result).to.equal(1000);
    });
    it('returns the remaining time when endWaitTime is undefined', () => {
      const now = Date.now();
      const result = remainingTime(now)();
      expect(result).to.equal(0);
    });
    it('does not return less than 0', () => {
      const now = Date.now();
      const endWaitTime = now - 1000;
      const result = remainingTime(now)(endWaitTime);
      expect(result).to.equal(0);
    });
  });
});
