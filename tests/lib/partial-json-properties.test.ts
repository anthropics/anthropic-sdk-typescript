import { isDeepStrictEqual } from 'node:util';
import { test, fc } from '@fast-check/vitest';
import { partialParse } from '@anthropic-ai/sdk/_vendor/partial-json-parser/parser';

const characterOf = (unit: NonNullable<fc.StringConstraints['unit']>) =>
  fc.string({ unit, minLength: 1, maxLength: 1 });
const character = fc.oneof(
  // Escaped by JSON.stringify, so that cuts land inside escape sequences.
  fc.constantFrom('"', '\\', '\n', '\u0000', '\ud800'),
  // Includes JSON punctuation.
  characterOf('grapheme-ascii'),
  // Any code point, so that cuts land inside surrogate pairs.
  characterOf('binary'),
);
const jsonKey = fc.string({ unit: character });
const jsonValue = fc.jsonValue({ stringUnit: character });
const jsonNumber = fc.double({ noNaN: true, noDefaultInfinity: true });
const jsonNonNumber = fc.oneof(fc.constantFrom(null, true, false), fc.string({ unit: character }));
const jsonContainer = fc.oneof(fc.array(jsonValue), fc.dictionary(jsonKey, jsonValue));
const whitespace = fc.string({ unit: fc.constantFrom(' ', '\t', '\n', '\r'), minLength: 1 });
// A number cannot continue across a comma or whitespace.
const numberEnd = fc.oneof(fc.constant(','), whitespace);

const serialized = (arbitrary: fc.Arbitrary<unknown>) =>
  fc.tuple(arbitrary, fc.nat({ max: 2 })).map(([value, indent]) => JSON.stringify(value, null, indent));
const document = serialized(jsonValue);
// A bare number never shows whether more digits follow, so it cannot be a whole document.
const completeDocument = serialized(jsonValue.filter((value) => typeof value !== 'number'));
const containerDocument = serialized(jsonContainer);

// Wraps `n` so that every cut point is reachable whatever the length of `text`.
const prefixOf = (text: string, n: number) => text.slice(0, n % (text.length + 1));
const nonEmptyPrefixOf = (text: string, n: number) => text.slice(0, 1 + (n % text.length));

/**
 * Whether `partial` could be an earlier view of `full`: entries arrive in order, all but the last
 * are final, and only an object or array can be shown before it is complete.
 */
function isPartialOf(partial: unknown, full: unknown): boolean {
  if (typeof partial !== 'object' || partial === null) return partial === full;
  if (typeof full !== 'object' || full === null) return false;
  if (Array.isArray(partial) !== Array.isArray(full)) return false;

  const seen = Object.entries(partial);
  const all = Object.entries(full);
  return seen.every(([key, value], i) => {
    const [fullKey, fullValue] = all[i] ?? [];
    if (key !== fullKey) return false;
    return i < seen.length - 1 ? isDeepStrictEqual(value, fullValue) : isPartialOf(value, fullValue);
  });
}

function expectPartialOf(partial: unknown, full: unknown) {
  const message = `${JSON.stringify(partial)} is not a partial view of ${JSON.stringify(full)}`;
  expect(isPartialOf(partial, full), message).toBe(true);
}

describe('partialParse properties', () => {
  test.prop([completeDocument], { numRuns: 1000 })('parses a complete document like JSON.parse', (text) => {
    expect(partialParse(text)).toStrictEqual(JSON.parse(text));
  });

  test.prop([document, fc.nat()], { numRuns: 1000 })(
    'throws nothing but a SyntaxError on a truncated document',
    (text, n) => {
      try {
        partialParse(prefixOf(text, n));
      } catch (error) {
        expect(error).toBeInstanceOf(SyntaxError);
      }
    },
  );

  test.prop([containerDocument, fc.nat()], { numRuns: 1000 })(
    'parses any non-empty prefix of an object or array into a partial view of it',
    (text, n) => {
      expectPartialOf(partialParse(nonEmptyPrefixOf(text, n)), JSON.parse(text));
    },
  );

  test.prop([containerDocument, fc.nat(), fc.nat()], { numRuns: 1000 })(
    'never takes back what a shorter prefix already showed',
    (text, m, n) => {
      const longer = nonEmptyPrefixOf(text, n);
      const shorter = nonEmptyPrefixOf(longer, m);
      expectPartialOf(partialParse(shorter), partialParse(longer));
    },
  );

  test.prop([jsonNonNumber, fc.nat()], { numRuns: 1000 })(
    'shows a string, boolean or null only once it is complete',
    (value, n) => {
      const text = JSON.stringify(value);
      const prefix = prefixOf(text, n);
      const arrived = prefix === text ? [value] : [];

      expect(partialParse('[' + prefix)).toStrictEqual(arrived);
      expect(partialParse('{"key":' + prefix)).toStrictEqual(
        Object.fromEntries(arrived.map((value) => ['key', value])),
      );
    },
  );

  test.prop([jsonNumber, fc.nat(), numberEnd, whitespace], { numRuns: 1000 })(
    'shows a number only once what follows proves it complete',
    (value, n, end, space) => {
      const text = JSON.stringify(value);
      const prefix = prefixOf(text, n);
      const number = JSON.parse(text);
      // Ended early by whitespace, the digits so far are a shorter number, unless they stop at `.`, `-`, `+` or `e`.
      const cutShort = /\d$/.test(prefix) ? [JSON.parse(prefix)] : [];

      expect(partialParse('[' + prefix)).toStrictEqual([]);
      expect(partialParse('{"key":' + prefix)).toStrictEqual({});
      expect(partialParse('[' + text + end)).toStrictEqual([number]);
      expect(partialParse('{"key":' + text + end)).toStrictEqual({ key: number });
      expect(partialParse('[' + prefix + space)).toStrictEqual(cutShort);
      expect(partialParse('{"key":' + prefix + space)).toStrictEqual(
        Object.fromEntries(cutShort.map((value) => ['key', value])),
      );
    },
  );

  test.prop([fc.array(fc.tuple(jsonKey, jsonValue)), jsonKey, fc.nat(), numberEnd])(
    'shows exactly the object members that have fully arrived',
    (entries, nextKey, n, end) => {
      const members = entries.map(([key, value]) => JSON.stringify(key) + ':' + JSON.stringify(value));
      const danglingKey = prefixOf(JSON.stringify(nextKey) + ':', n);
      const objectOf = (members: string[]) => JSON.parse('{' + members.join(',') + '}');
      // More digits may follow a number until a comma or whitespace ends it.
      const pending = typeof entries.at(-1)?.[1] === 'number' ? 1 : 0;

      expect(partialParse('{' + [...members, danglingKey].join(','))).toStrictEqual(objectOf(members));
      expect(partialParse('{' + members.join(',') + end)).toStrictEqual(objectOf(members));
      expect(partialParse('{' + members.join(','))).toStrictEqual(
        objectOf(members.slice(0, members.length - pending)),
      );
    },
  );

  test.prop([fc.array(jsonValue, { minLength: 1 }), numberEnd], { numRuns: 1000 })(
    'shows exactly the array items that have fully arrived',
    (items, end) => {
      const text = '[' + items.map((item) => JSON.stringify(item)).join(',');
      const arrived: unknown[] = JSON.parse(text + ']');
      // More digits may follow a number until a comma or whitespace ends it.
      const pending = typeof items.at(-1) === 'number' ? 1 : 0;

      expect(partialParse(text + end)).toStrictEqual(arrived);
      expect(partialParse(text)).toStrictEqual(arrived.slice(0, arrived.length - pending));
    },
  );
});
