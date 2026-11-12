fix(tools): stop the grep tool's built-in search at a NUL byte in a file

The built-in search of `grep` reads no further into a file once it meets a NUL byte, much as ripgrep does. A very large binary file with no line break used to end the process with an uncaught `RangeError`.
