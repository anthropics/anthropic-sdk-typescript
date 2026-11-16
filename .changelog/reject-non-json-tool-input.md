fix(streaming): reject characters that aren't JSON in streamed tool input

The lenient parser for streamed tool input used to skip characters and words that aren't JSON, such as a comment, and to join numbers such as `12 3`, so it could return a value that the text doesn't contain. It now rejects such text, and a stream with such tool input fails with an error, as it already did for a bad escape or a missing comma. Valid and truncated JSON parse as before.
