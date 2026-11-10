type Token = {
  type: string;
  value: string;
  /** set on a number that runs to the very end of the input, so more digits may follow */
  unterminated?: boolean;
};

// Completes truncated JSON (drops a partial trailing token, closes open brackets) for
// JSON.parse. Input that contains anything other than truncated JSON — an unknown word
// or character outside a string, a mismatched or unopened closing bracket — is handed
// to JSON.parse unchanged so that it still throws rather than being repaired.

const LITERALS = ['true', 'false', 'null'];

const isWhitespace = (char: string | undefined): boolean =>
    char === ' ' || char === '\t' || char === '\n' || char === '\r',
  // a literal cut off by the end of the text, e.g. `nul`
  isTruncatedLiteral = (word: string, rest: string): boolean =>
    LITERALS.some((literal) => literal !== word && literal.startsWith(word)) && [...rest].every(isWhitespace),
  // null when the input holds anything other than JSON tokens and whitespace outside its strings
  tokenize = (input: string): Token[] | null => {
    let current = 0;
    let tokens: Token[] = [];

    while (current < input.length) {
      let char = input[current];

      if (char === '{') {
        tokens.push({
          type: 'brace',
          value: '{',
        });

        current++;
        continue;
      }

      if (char === '}') {
        tokens.push({
          type: 'brace',
          value: '}',
        });

        current++;
        continue;
      }

      if (char === '[') {
        tokens.push({
          type: 'paren',
          value: '[',
        });

        current++;
        continue;
      }

      if (char === ']') {
        tokens.push({
          type: 'paren',
          value: ']',
        });

        current++;
        continue;
      }

      if (char === ':') {
        tokens.push({
          type: 'separator',
          value: ':',
        });

        current++;
        continue;
      }

      if (char === ',') {
        tokens.push({
          type: 'delimiter',
          value: ',',
        });

        current++;
        continue;
      }

      if (char === '"') {
        // a `"` closes the string only after an even number of backslashes; escapes are kept verbatim
        const start = current + 1;
        let end = start;
        let danglingQuote = false;

        while (true) {
          end = input.indexOf('"', end);
          if (end === -1) {
            danglingQuote = true;
            break;
          }

          let backslashes = 0;
          let i = end - 1;
          while (i >= start && input[i] === '\\') {
            backslashes++;
            i--;
          }
          if (backslashes % 2 === 0) break;
          end++;
        }

        if (danglingQuote) {
          current = input.length;
        } else {
          tokens.push({
            type: 'string',
            value: input.slice(start, end),
          });
          current = end + 1;
        }
        continue;
      }

      if (isWhitespace(char)) {
        current++;
        continue;
      }

      let NUMBERS = /[0-9]/;
      if ((char && NUMBERS.test(char)) || char === '-' || char === '.') {
        let value = '';

        if (char === '-') {
          value += char;
          char = input[++current];
        }

        while (
          char &&
          (NUMBERS.test(char) ||
            char === '.' ||
            // exponent marker, e.g. `1e10` or `1.5E-9`
            char === 'e' ||
            char === 'E' ||
            // exponent sign, only valid immediately after the exponent marker
            ((char === '-' || char === '+') &&
              (value[value.length - 1] === 'e' || value[value.length - 1] === 'E')))
        ) {
          value += char;
          char = input[++current];
        }

        tokens.push({
          type: 'number',
          value,
          unterminated: current === input.length,
        });
        continue;
      }

      let LETTERS = /[a-z]/i;
      if (char && LETTERS.test(char)) {
        let value = '';

        while (char && LETTERS.test(char)) {
          if (current === input.length) {
            break;
          }
          value += char;
          char = input[++current];
        }

        if (LITERALS.includes(value)) {
          tokens.push({
            type: 'name',
            value,
          });
        } else if (!isTruncatedLiteral(value, input.slice(current))) {
          return null;
        }
        continue;
      }

      return null;
    }

    return tokens;
  },
  strip = (tokens: Token[]): Token[] => {
    let open: string[] = [];

    for (const token of tokens) {
      if (token.type === 'brace' || token.type === 'paren') {
        if (token.value === '{' || token.value === '[') {
          open.push(token.value);
        } else {
          open.pop();
        }
      }
    }

    // brackets are never stripped, so this holds for every token looked at below
    let innermostOpenBracket = open[open.length - 1];
    let length = tokens.length;
    let JSON_NUMBER = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?$/;

    while (length > 0) {
      let lastToken = tokens[length - 1]!;

      switch (lastToken.type) {
        case 'separator':
          length--;
          continue;
        case 'number':
          // more digits may follow a number that runs to the end of the input, and one that
          // something else cuts short, e.g. `1.` or `1e-`, will never be a number
          if (lastToken.unterminated || !JSON_NUMBER.test(lastToken.value)) {
            length--;
            continue;
          }
          break;
        case 'string':
          // in an object this is a key without a value yet, in an array it is a complete item
          let tokenBeforeTheLastToken = tokens[length - 2];
          if (
            innermostOpenBracket === '{' &&
            (tokenBeforeTheLastToken?.type === 'delimiter' ||
              (tokenBeforeTheLastToken?.type === 'brace' && tokenBeforeTheLastToken.value === '{'))
          ) {
            length--;
            continue;
          }
          break;
        case 'delimiter':
          // whatever precedes a comma is complete
          length--;
          break;
      }

      break;
    }

    return tokens.slice(0, length);
  },
  // null when a closer does not match the innermost open bracket
  unstrip = (tokens: Token[]): Token[] | null => {
    let tail: string[] = [];

    for (const token of tokens) {
      if (token.type !== 'brace' && token.type !== 'paren') {
        continue;
      }
      if (token.value === '{') {
        tail.push('}');
      } else if (token.value === '[') {
        tail.push(']');
      } else if (tail.pop() !== token.value) {
        return null;
      }
    }

    if (tail.length > 0) {
      tail.reverse().map((item) => {
        if (item === '}') {
          tokens.push({
            type: 'brace',
            value: '}',
          });
        } else if (item === ']') {
          tokens.push({
            type: 'paren',
            value: ']',
          });
        }
      });
    }

    return tokens;
  },
  isScalar = (token: Token | undefined): boolean =>
    token?.type === 'string' || token?.type === 'number' || token?.type === 'name',
  generate = (tokens: Token[]): string => {
    let output = '';

    tokens.map((token, index) => {
      // keep adjacent scalars apart so malformed input like `12 3` still fails the strict parse
      if (isScalar(tokens[index - 1]) && isScalar(token)) {
        output += ' ';
      }
      switch (token.type) {
        case 'string':
          output += '"' + token.value + '"';
          break;
        default:
          output += token.value;
          break;
      }
    });

    return output;
  },
  partialParse = (input: string): unknown => {
    const tokens = tokenize(input);
    const completed = tokens && unstrip(strip(tokens));
    return JSON.parse(completed ? generate(completed) : input);
  };

export { partialParse };
