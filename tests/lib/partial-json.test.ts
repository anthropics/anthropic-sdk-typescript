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

  test('JSON string with null value', () => {
    expect(partialParse(`{"foo": null, "bar": "baz"}`)).toEqual({ foo: null, bar: 'baz' });
  });

  test('JSON string with number values', () => {
    expect(partialParse(`{"foo": 123, "bar": 45.67}`)).toEqual({ foo: 123, bar: 45.67 });
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
});
