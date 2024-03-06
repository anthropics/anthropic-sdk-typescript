import { _decodeChunks as decodeChunks } from '@anthropic-ai/sdk/streaming';

describe('line decoder', () => {
  test('basic', () => {
    // baz is not included because the line hasn't ended yet
    expect(decodeChunks(['foo', ' bar\nbaz'])).toEqual(['foo bar']);
  });

  test('basic with \\r', () => {
    // baz is not included because the line hasn't ended yet
    expect(decodeChunks(['foo', ' bar\r\nbaz'])).toEqual(['foo bar']);
  });

  test('trailing new lines', () => {
    expect(decodeChunks(['foo', ' bar', 'baz\n', 'thing\n'])).toEqual(['foo barbaz', 'thing']);
  });

  test('trailing new lines with \\r', () => {
    expect(decodeChunks(['foo', ' bar', 'baz\r\n', 'thing\r\n'])).toEqual(['foo barbaz', 'thing']);
  });

  test('escaped new lines', () => {
    expect(decodeChunks(['foo', ' bar\\nbaz\n'])).toEqual(['foo bar\\nbaz']);
  });

  test('escaped new lines with \\r', () => {
    expect(decodeChunks(['foo', ' bar\\r\\nbaz\n'])).toEqual(['foo bar\\r\\nbaz']);
  });
});
