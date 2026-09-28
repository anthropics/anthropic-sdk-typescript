import { partialParse } from '@anthropic-ai/sdk/_vendor/partial-json-parser/parser';

describe('partialParse', () => {
  test('a valid complete JSON string', () => {
    expect(partialParse(`{"foo": "bar", "thing": "baz"}`)).toEqual({ foo: 'bar', thing: 'baz' });
  });

  test('a valid partial JSON string', () => {
    expect(partialParse(`{"foo": "bar", "thing": "`)).toEqual({ foo: 'bar' });
  });

  test('empty JSON object', () => {
    expect(partialParse(`{}`)).toEqual({});
  });

  test('incomplete nested JSON object', () => {
    expect(partialParse(`{"foo": {"bar": "baz"}`)).toEqual({ foo: { bar: 'baz' } });
  });

  test('complete nested JSON object', () => {
    expect(partialParse(`{"foo": {"bar": "baz"}}`)).toEqual({ foo: { bar: 'baz' } });
  });

  test('JSON array with incomplete object', () => {
    expect(partialParse(`{"foo": [{"bar": "baz"}`)).toEqual({ foo: [{ bar: 'baz' }] });
  });

  test('JSON array with complete objects', () => {
    expect(partialParse(`{"foo": [{"bar": "baz"}, {"qux": "quux"}]}`)).toEqual({
      foo: [{ bar: 'baz' }, { qux: 'quux' }],
    });
  });

  test('string with escaped characters', () => {
    expect(partialParse(`{"foo": "bar\\\"baz"}`)).toEqual({ foo: 'bar"baz' });
  });

  test('string with incomplete escape sequence', () => {
    expect(partialParse(`{"foo": "bar\\`)).toEqual({});
  });

  test('invalid JSON string gracefully', () => {
    expect(partialParse(`{"foo": "bar", "thing": "baz"`)).toEqual({ foo: 'bar', thing: 'baz' });
  });

  test('incomplete array of strings', () => {
    expect(partialParse(`["a", "b", "c"`)).toEqual(['a', 'b', 'c']);
    expect(partialParse(`["a", "b", "c`)).toEqual(['a', 'b']);
    expect(partialParse(`["a", "b",`)).toEqual(['a', 'b']);
    expect(partialParse(`{"tags": ["x", "y", "z"`)).toEqual({ tags: ['x', 'y', 'z'] });
  });

  test('incomplete array of numbers', () => {
    expect(partialParse(`[1, 2, 3`)).toEqual([1, 2]);
    expect(partialParse(`[1, 2, 3,`)).toEqual([1, 2, 3]);
    expect(partialParse(`[1, 2, 3.`)).toEqual([1, 2]);
    expect(partialParse(`{"ids": [10, 20, 30`)).toEqual({ ids: [10, 20] });
  });

  test('incomplete array of mixed values', () => {
    expect(partialParse(`[1, true, 2, 3`)).toEqual([1, true, 2]);
    expect(partialParse(`[null, "a", 1`)).toEqual([null, 'a']);
    expect(partialParse(`[{"a": 1}, "b", [2, 3], "c"`)).toEqual([{ a: 1 }, 'b', [2, 3], 'c']);
    expect(partialParse(`[["a", "b"], ["c", "d"`)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  test('incomplete object key inside an array', () => {
    expect(partialParse(`[{"a": 1, "b"`)).toEqual([{ a: 1 }]);
    expect(partialParse(`["a", {"b"`)).toEqual(['a', {}]);
    expect(partialParse(`{"a": 1, "b"`)).toEqual({ a: 1 });
    expect(partialParse(`{"a": 1, "b":`)).toEqual({ a: 1 });
  });

  test('JSON string with null value', () => {
    expect(partialParse(`{"foo": null, "bar": "baz"}`)).toEqual({ foo: null, bar: 'baz' });
  });

  test('JSON string with number values', () => {
    expect(partialParse(`{"foo": 123, "bar": 45.67}`)).toEqual({ foo: 123, bar: 45.67 });
  });

  test('JSON string with negative number values', () => {
    expect(partialParse(`{"foo": -123, "bar": -45.67}`)).toEqual({ foo: -123, bar: -45.67 });
  });

  test('JSON string with scientific notation values', () => {
    expect(partialParse(`{"foo": 8.2156e-15}`)).toEqual({ foo: 8.2156e-15 });
    expect(partialParse(`{"foo": 1.5e+10}`)).toEqual({ foo: 1.5e10 });
    expect(partialParse(`{"foo": 2E8}`)).toEqual({ foo: 2e8 });
    expect(partialParse(`{"foo": 1e5}`)).toEqual({ foo: 1e5 });
    expect(partialParse(`{"foo": -1.5e-3}`)).toEqual({ foo: -1.5e-3 });
    expect(partialParse(`{"foo": 8.2156e-15, "bar": "baz"}`)).toEqual({ foo: 8.2156e-15, bar: 'baz' });
    expect(partialParse(`{"foo": [1e2, 2.5E-3]}`)).toEqual({ foo: [1e2, 2.5e-3] });
  });

  test('JSON string with partial number values', () => {
    expect(partialParse(`{"foo": 123.`)).toEqual({});
    expect(partialParse(`{"foo": -`)).toEqual({});
    expect(partialParse(`{"foo": 8.2156e`)).toEqual({});
    expect(partialParse(`{"foo": 8.2156E`)).toEqual({});
    expect(partialParse(`{"foo": 8.2156e-`)).toEqual({});
    expect(partialParse(`{"foo": 8.2156e+`)).toEqual({});
    expect(partialParse(`{"foo": 8.2156e-1`)).toEqual({});
    expect(partialParse(`{"foo": 8.2156e-1,`)).toEqual({ foo: 8.2156e-1 });
    expect(partialParse(`{"foo": 1, "bar": 8.2156e`)).toEqual({ foo: 1 });
  });

  test('number that may have more digits to come', () => {
    expect(partialParse(`{"foo": 12`)).toEqual({});
    expect(partialParse(`{"foo": 12,`)).toEqual({ foo: 12 });
    expect(partialParse(`{"foo": 12}`)).toEqual({ foo: 12 });
    expect(partialParse(`{"foo": 1, "bar": 2`)).toEqual({ foo: 1 });
    expect(partialParse(`{"foo": [1, 2`)).toEqual({ foo: [1] });
    expect(partialParse(`[1`)).toEqual([]);
    expect(partialParse(`[1]`)).toEqual([1]);
    expect(() => partialParse(`12`)).toThrow(SyntaxError);
  });

  test('number followed by a comma is kept whatever is incomplete after it', () => {
    expect(partialParse(`{"a": 1, "b":`)).toEqual({ a: 1 });
    expect(partialParse(`{"a": 1, "b"`)).toEqual({ a: 1 });
    expect(partialParse(`{"a": 1, "b": tr`)).toEqual({ a: 1 });
    expect(partialParse(`{"a": 1, "b": 2.`)).toEqual({ a: 1 });
    expect(partialParse(`[1, "x`)).toEqual([1]);
    expect(partialParse(`[1, 2,`)).toEqual([1, 2]);
    expect(partialParse(`[1 ,`)).toEqual([1]);
  });

  test('number followed by whitespace is kept', () => {
    expect(partialParse(`{"foo": 12 `)).toEqual({ foo: 12 });
    expect(partialParse(`{"foo": 12\n`)).toEqual({ foo: 12 });
    expect(partialParse(`{"foo": 12\r\n\t`)).toEqual({ foo: 12 });
    expect(partialParse(`{"foo": -1.5e-3 `)).toEqual({ foo: -1.5e-3 });
    expect(partialParse(`{"foo": 1, "bar": 2 `)).toEqual({ foo: 1, bar: 2 });
    expect(partialParse(`[1 `)).toEqual([1]);
    expect(partialParse(`[1, 2\n`)).toEqual([1, 2]);
    expect(partialParse(`{"foo": [1, 2 `)).toEqual({ foo: [1, 2] });
    expect(partialParse(`12 `)).toEqual(12);
  });

  test('pretty-printed number cut off before or after the line break', () => {
    expect(partialParse(`{\n  "count": 12`)).toEqual({});
    expect(partialParse(`{\n  "count": 12\n`)).toEqual({ count: 12 });
    expect(partialParse(`{\n  "ids": [\n    10,\n    20`)).toEqual({ ids: [10] });
    expect(partialParse(`{\n  "ids": [\n    10,\n    20\n  `)).toEqual({ ids: [10, 20] });
    expect(partialParse(`{\n  "name": "a",\n  "count": 12\n`)).toEqual({ name: 'a', count: 12 });
  });

  test('partial number followed by whitespace is still dropped', () => {
    expect(partialParse(`{"foo": 123. `)).toEqual({});
    expect(partialParse(`{"foo": - `)).toEqual({});
    expect(partialParse(`{"foo": 8.2156e\n`)).toEqual({});
    expect(partialParse(`{"foo": 8.2156E `)).toEqual({});
    expect(partialParse(`{"foo": 8.2156e- `)).toEqual({});
    expect(partialParse(`{"foo": 8.2156e+\n`)).toEqual({});
    expect(partialParse(`{"foo": 1, "bar": 2. `)).toEqual({ foo: 1 });
    expect(partialParse(`[1, 2. `)).toEqual([1]);
    expect(partialParse(`[- `)).toEqual([]);
    expect(partialParse(`{"foo": 1.2.3 `)).toEqual({});
  });

  test('JSON string with boolean values', () => {
    expect(partialParse(`{"foo": true, "bar": false}`)).toEqual({ foo: true, bar: false });
  });

  test('JSON string with mixed data types', () => {
    expect(partialParse(`{"foo": "bar", "baz": 123, "qux": true, "quux": null}`)).toEqual({
      foo: 'bar',
      baz: 123,
      qux: true,
      quux: null,
    });
  });

  test('JSON string with partial literal tokens', () => {
    expect(partialParse(`{"foo": "bar", "baz": nul`)).toEqual({ foo: 'bar' });
    expect(partialParse(`{"foo": "bar", "baz": tr`)).toEqual({ foo: 'bar' });
    expect(partialParse(`{"foo": "bar", "baz": truee`)).toEqual({ foo: 'bar' });
    expect(partialParse(`{"foo": "bar", "baz": fal`)).toEqual({ foo: 'bar' });
  });

  test('deeply nested JSON objects', () => {
    expect(partialParse(`{"a": {"b": {"c": {"d": "e"}}}}`)).toEqual({ a: { b: { c: { d: 'e' } } } });
  });

  test('deeply nested partial JSON objects', () => {
    expect(partialParse(`{"a": {"b": {"c": {"d": "e`)).toEqual({ a: { b: { c: {} } } });
  });

  test('long unclosed array does not exhaust the call stack', () => {
    const elements = Array.from({ length: 20_000 }, (_, i) => `"value-${i}"`).join(',');
    expect(() => partialParse(`{"items": [${elements}`)).not.toThrow();
    expect(partialParse(`{"items": [${elements}]}`)).toEqual({
      items: Array.from({ length: 20_000 }, (_, i) => `value-${i}`),
    });
  });

  test('string tokens keep escape sequences intact', () => {
    expect(partialParse(`{"a": "x\\\\", "b": "y"}`)).toEqual({ a: 'x\\', b: 'y' });
    expect(partialParse(`{"a": "quote \\" inside", "b": 1}`)).toEqual({ a: 'quote " inside', b: 1 });
    expect(partialParse(`{"a": "\\\\\\"", "b": 2}`)).toEqual({ a: '\\"', b: 2 });
    expect(partialParse(`{"a": "unterminated`)).toEqual({});
  });
});
