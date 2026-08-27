// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

export function isAbortError(err: unknown) {
  return (
    typeof err === 'object' &&
    err !== null &&
    // Spec-compliant fetch implementations
    (('name' in err && (err as any).name === 'AbortError') ||
      // Expo fetch
      ('message' in err && String((err as any).message).includes('FetchRequestCanceledException')))
  );
}

export const castToError = (err: any): Error => {
  if (err instanceof Error) return err;
  if (typeof err === 'object' && err !== null) {
    try {
      const tag = Object.prototype.toString.call(err);
      // cross-realm errors (e.g. undici's abort `DOMException` under jest) fail `instanceof Error`
      if (tag === '[object Error]' || tag === '[object DOMException]') {
        // @ts-ignore - not all envs have native support for cause yet
        const error = new Error(err.message, err.cause ? { cause: err.cause } : {});
        if (err.stack) error.stack = err.stack;
        // @ts-ignore - not all envs have native support for cause yet
        if (err.cause && !error.cause) error.cause = err.cause;
        if (err.name) error.name = err.name;
        return error;
      }
    } catch {}
    try {
      return new Error(JSON.stringify(err));
    } catch {}
  }
  return new Error(err);
};
