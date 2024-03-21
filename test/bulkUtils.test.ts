/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';

import { remainingTime } from '../src/bulkUtils.js';

describe('bulkUtils', () => {
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
