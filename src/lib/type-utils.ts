/** Vendored from typefest — flattens complex type hover display. */
export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

/** A value T or a Promise of T. */
export type Promisable<T> = T | Promise<T>;
