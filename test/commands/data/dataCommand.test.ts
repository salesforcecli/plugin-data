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

import { stringToDictionary } from '../../../src/dataUtils.js';

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
