# Partial JSON Parser

Vendored from https://www.npmjs.com/package/partial-json-parser and updated to use TypeScript.

Local changes to `parser.ts`:

- Text that is not truncated JSON (an unknown word or character outside a string, including a backslash, or a closing bracket that does not match the innermost open one) is not repaired: `tokenize` and `unstrip` return `null` for it, and `partialParse` then passes the original text to `JSON.parse`, which throws.
- A literal cut off by the end of the text, such as `nul`, is recognized with `LITERALS` and `isTruncatedLiteral` and dropped. Any other unknown word is rejected.
- `generate` keeps adjacent scalars apart, so input such as `[12 3]` still fails `JSON.parse`.
