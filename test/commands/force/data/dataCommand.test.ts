/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';

import { Config } from '@oclif/core';
import { DataCommand } from '../../../../src/dataCommand';

describe.only('dataCommand', () => {
  // This is a test class that extends DataCommand so that we can test protected methods
  class DataCommandInstance extends DataCommand {
    // The `run` method is abstract in SfdxCommand, so we need to implement it but it doesn't need to do anything
    public run() {
      return Promise.resolve();
    }

    // This is a test method that exposes the protected method stringToDictionary
    public testStringToDictionary(str: string) {
      return this.stringToDictionary(str);
    }
  }

  const dataCommand = new DataCommandInstance(['test'], new Config({ root: '.' }));

  it('should transform a "key=value" string into an equivalent object', () => {
    const dict = dataCommand.testStringToDictionary('key=value');

    expect(dict).to.deep.equal({
      key: 'value',
    });
  });

  it('should transform a "key=leftvalue rightvalue" string into an equivalent object', () => {
    const dict = dataCommand.testStringToDictionary('key="leftvalue rightvalue"');

    expect(dict).to.deep.equal({
      key: 'leftvalue rightvalue',
    });
  });

  it('should transform a "key1=value key2=value" string into an equivalent object', () => {
    const dict = dataCommand.testStringToDictionary('key1=value key2=value');

    expect(dict).to.deep.equal({
      key1: 'value',
      key2: 'value',
    });
  });

  it('should transform a "key1=value key2=leftvalue rightvalue" string into an equivalent object', () => {
    const dict = dataCommand.testStringToDictionary('key1=value key2="leftvalue rightvalue"');

    expect(dict).to.deep.equal({
      key1: 'value',
      key2: 'leftvalue rightvalue',
    });
  });

  it('should allow single quotes in key=value pairs', () => {
    const dict = dataCommand.testStringToDictionary('key1="val\'ue"');

    expect(dict).to.deep.equal({
      key1: "val'ue",
    });
  });

  it('should allow double quotes in key=value pairs', () => {
    const dict = dataCommand.testStringToDictionary("key1='val\"ue'");

    expect(dict).to.deep.equal({
      key1: 'val"ue',
    });
  });

  it('should allow non alphanumeric characters in key=value pairs', () => {
    const dict = dataCommand.testStringToDictionary('key1=!@#$%^&*()-_=+[{]}\\|;:,<.>/?`~');

    expect(dict).to.deep.equal({
      key1: '!@#$%^&*()-_=+[{]}\\|;:,<.>/?`~',
    });
  });

  it('should allow weird or foreign unicode characters in key=value pairs', () => {
    const dict = dataCommand.testStringToDictionary('key1=♣♦♥♠&£ë╤è☺¼Φ╚↕↓㍿々');

    expect(dict).to.deep.equal({
      key1: '♣♦♥♠&£ë╤è☺¼Φ╚↕↓㍿々',
    });
  });
});
