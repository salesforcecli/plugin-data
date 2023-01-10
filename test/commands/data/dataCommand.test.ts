/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';

import { stringToDictionary } from '../../../src/dataCommand';

describe('dataCommand', () => {
  it('should transform a "key=value" string into an equivalent object', () => {
    const dict = stringToDictionary('key=value');

    expect(dict).to.deep.equal({
      key: 'value',
    });
  });

  it('should transform a "key=leftvalue rightvalue" string into an equivalent object', () => {
    const dict = stringToDictionary('key="leftvalue rightvalue"');

    expect(dict).to.deep.equal({
      key: 'leftvalue rightvalue',
    });
  });

  it('should transform a "key1=value key2=value" string into an equivalent object', () => {
    const dict = stringToDictionary('key1=value key2=value');

    expect(dict).to.deep.equal({
      key1: 'value',
      key2: 'value',
    });
  });

  it('should transform a "key1=value key2=leftvalue rightvalue" string into an equivalent object', () => {
    const dict = stringToDictionary('key1=value key2="leftvalue rightvalue"');

    expect(dict).to.deep.equal({
      key1: 'value',
      key2: 'leftvalue rightvalue',
    });
  });

  it('should allow single quotes in key=value pairs', () => {
    let dict = stringToDictionary('key="val\'ue"');

    expect(dict).to.deep.equal({
      key: "val'ue",
    });

    dict = stringToDictionary("key=val'ue");

    expect(dict).to.deep.equal({
      key: "val'ue",
    });
  });

  it('should allow double quotes in key=value pairs', () => {
    let dict = stringToDictionary("key='val\"ue'");

    expect(dict).to.deep.equal({
      key: 'val"ue',
    });

    dict = stringToDictionary('key=val"ue');

    expect(dict).to.deep.equal({
      key: 'val"ue',
    });
  });

  it('should allow non alphanumeric characters in key=value pairs', () => {
    const dict = stringToDictionary('key=!@#$%^&*()-_=+[{]}\\|;:,<.>/?`~');

    expect(dict).to.deep.equal({
      key: '!@#$%^&*()-_=+[{]}\\|;:,<.>/?`~',
    });
  });

  it('should allow weird or foreign unicode characters in key=value pairs', () => {
    const dict = stringToDictionary('key=♣♦♥♠&£ë╤è☺¼Φ╚↕↓㍿々');

    expect(dict).to.deep.equal({
      key: '♣♦♥♠&£ë╤è☺¼Φ╚↕↓㍿々',
    });
  });
});
