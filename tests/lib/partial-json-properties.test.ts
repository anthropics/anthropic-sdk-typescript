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
const jsonScalar = fc.jsonValue({ stringUnit: character, maxDepth: 0 });
const jsonContainer = fc.oneof(fc.array(jsonValue), fc.dictionary(jsonKey, jsonValue));

const serialized = (arbitrary: fc.Arbitrary<unknown>) =>
  fc.tuple(arbitrary, fc.nat({ max: 2 })).map(([value, indent]) => JSON.stringify(value, null, indent));
const document = serialized(jsonValue);
const containerDocument = serialized(jsonContainer);

// Wraps `n` so that every cut point is reachable whatever the length of `text`.
const prefixOf = (text: string, n: number) => text.slice(0, n % (text.length + 1));
const nonEmptyPrefixOf = (text: string, n: number) => text.slice(0, 1 + (n % text.length));

/**
 * Whether `partial` could be an earlier view of `full`: entries arrive in order and all but the
 * last are final. A trailing number may still change (`12` of `123`) or come and go (`1`, `1.`, `1.5`).
 */
function isPartialOf(partial: unknown, full: unknown): boolean {
  if (typeof partial === 'number') return typeof full === 'number';
  if (typeof partial !== 'object' || partial === null) return partial === full;
  if (typeof full !== 'object' || full === null) return false;
  if (Array.isArray(partial) !== Array.isArray(full)) return false;

  const seen = Object.entries(partial);
  const all = Object.entries(full);
  return seen.every(([key, value], i) => {
    const [fullKey, fullValue] = all[i] ?? [];
    if (i < seen.length - 1) return key === fullKey && isDeepStrictEqual(value, fullValue);
    if (typeof value === 'number' && i === all.length) return true;
    return key === fullKey && isPartialOf(value, fullValue);
  });
}

function expectPartialOf(partial: unknown, full: unknown) {
  const message = `${JSON.stringify(partial)} is not a partial view of ${JSON.stringify(full)}`;
  expect(isPartialOf(partial, full), message).toBe(true);
}

describe('partialParse properties', () => {
  test.prop([document], { numRuns: 1000 })('parses a complete document like JSON.parse', (text) => {
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

  test.prop([jsonScalar, fc.nat()], { numRuns: 1000 })(
    'keeps a truncated scalar only once the text so far is valid JSON by itself',
    (value, n) => {
      const prefix = prefixOf(JSON.stringify(value), n);
      let seen: unknown[];
      try {
        seen = [JSON.parse(prefix)];
      } catch {
        seen = [];
      }
      expect(partialParse('[' + prefix)).toStrictEqual(seen);
      expect(partialParse('{"key":' + prefix)).toStrictEqual(
        Object.fromEntries(seen.map((scalar) => ['key', scalar])),
      );
    },
  );

  test.prop([fc.array(fc.tuple(jsonKey, jsonValue)), jsonKey, fc.nat()])(
    'shows exactly the object members that have fully arrived',
    (entries, nextKey, n) => {
      const members = entries.map(([key, value]) => JSON.stringify(key) + ':' + JSON.stringify(value));
      const danglingKey = prefixOf(JSON.stringify(nextKey) + ':', n);
      const arrived = JSON.parse('{' + members.join(',') + '}');

      expect(partialParse('{' + members.join(','))).toStrictEqual(arrived);
      expect(partialParse('{' + [...members, danglingKey].join(','))).toStrictEqual(arrived);
    },
  );

  test.prop([fc.array(jsonContainer, { minLength: 1 })])(
    'shows exactly the nested objects and arrays that have fully arrived',
    (items) => {
      const text = '[' + items.map((item) => JSON.stringify(item)).join(',');
      const arrived = JSON.parse(text + ']');

      expect(partialParse(text)).toStrictEqual(arrived);
      expect(partialParse(text + ',')).toStrictEqual(arrived);
    },
  );
});
