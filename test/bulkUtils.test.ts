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

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { expect } from 'chai';

import { detectDelimiter, SkipFirstLineTransform } from '../src/bulkUtils.js';

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

  describe.only('SkipFirstLineTransform', () => {
    async function streamToString(readable: Readable): Promise<string> {
      const chunks: Buffer[] = [];
      for await (const chunk of readable) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
      }
      return Buffer.concat(chunks).toString('utf8');
    }

    it('skips first line with LF endings', async () => {
      const input = 'Header1,Header2,Header3\nRow1Col1,Row1Col2,Row1Col3\nRow2Col1,Row2Col2,Row2Col3\n';
      const expected = 'Row1Col1,Row1Col2,Row1Col3\nRow2Col1,Row2Col2,Row2Col3\n';

      const result = await streamToString(Readable.from(input).pipe(new SkipFirstLineTransform()));

      expect(result).to.equal(expected);
    });

    it('skips first line with CRLF endings', async () => {
      const input = 'Header1,Header2,Header3\r\nRow1Col1,Row1Col2,Row1Col3\r\nRow2Col1,Row2Col2,Row2Col3\r\n';
      const expected = 'Row1Col1,Row1Col2,Row1Col3\r\nRow2Col1,Row2Col2,Row2Col3\r\n';

      const result = await streamToString(Readable.from(input).pipe(new SkipFirstLineTransform()));

      expect(result).to.equal(expected);
    });

    it('handles header split across chunks', async () => {
      // Simulate a stream where the header is split across multiple chunks
      const chunk1 = 'Header1,Head';
      const chunk2 = 'er2,Header3\nRow1Col1,Row1Col2,Row1Col3\n';
      const expected = 'Row1Col1,Row1Col2,Row1Col3\n';

      const input = Readable.from([chunk1, chunk2]);
      const result = await streamToString(input.pipe(new SkipFirstLineTransform()));

      expect(result).to.equal(expected);
    });

    it('handles empty stream after header', async () => {
      const input = 'Header1,Header2,Header3\n';
      const expected = '';

      const result = await streamToString(Readable.from(input).pipe(new SkipFirstLineTransform()));

      expect(result).to.equal(expected);
    });

    it('handles single-line input without newline', async () => {
      // Edge case: header with no newline at all
      const input = 'Header1,Header2,Header3';
      const expected = '';

      const result = await streamToString(Readable.from(input).pipe(new SkipFirstLineTransform()));

      expect(result).to.equal(expected);
    });

    it('handles multi-byte UTF-8 characters in header', async () => {
      const input = 'Header1,Hëàdér2,Header3\nRow1Col1,Row1Col2,Row1Col3\n';
      const expected = 'Row1Col1,Row1Col2,Row1Col3\n';

      const result = await streamToString(Readable.from(input).pipe(new SkipFirstLineTransform()));

      expect(result).to.equal(expected);
    });

    it('handles very long header line', async () => {
      // Create a header with many columns
      const headerCols = Array.from({ length: 100 }, (_, i) => `Header${i}`).join(',');
      const dataCols = Array.from({ length: 100 }, (_, i) => `Data${i}`).join(',');
      const input = `${headerCols}\n${dataCols}\n`;
      const expected = `${dataCols}\n`;

      const result = await streamToString(Readable.from(input).pipe(new SkipFirstLineTransform()));

      expect(result).to.equal(expected);
    });

    it('passes through data correctly in pipeline', async () => {
      const input = 'Id,Name,Email\n1,John,john@example.com\n2,Jane,jane@example.com\n';
      const expected = '1,John,john@example.com\n2,Jane,jane@example.com\n';

      const chunks: string[] = [];
      await pipeline(
        Readable.from(input),
        new SkipFirstLineTransform(),
        async function* (source: AsyncIterable<Buffer>) {
          for await (const chunk of source) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
            chunks.push(buffer.toString('utf8'));
            yield chunk;
          }
        }
      );

      expect(chunks.join('')).to.equal(expected);
    });
  });
});
