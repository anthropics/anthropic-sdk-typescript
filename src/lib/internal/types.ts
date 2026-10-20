/** Flattens an intersection type so it reads better on hover; vendored from type-fest. */
export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};
