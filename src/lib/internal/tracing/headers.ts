import type { Middleware } from '../../../core/middleware';
import { traceHeaderNames } from '../../../internal/trace-headers';

/**
 * Removes the trace-context headers ({@link traceHeaderNames}) from `headers` and returns them.
 */
export function takeTraceHeaders(headers: Headers): Array<[string, string]> {
  // By the names that `headers` has: a propagator can list a field that `Headers` rejects as a name.
  const names = traceHeaderNames();
  const taken = Array.from(headers.entries()).filter(([name]) => names.has(name));
  for (const [name] of taken) {
    headers.delete(name);
  }
  return taken;
}

/**
 * Returns a middleware that runs `middleware`, which may sign the request, without the trace-context
 * headers, and sets them again on what `middleware` passes on.
 */
export function withoutTraceHeaders(middleware: Middleware): Middleware {
  return (request, next, ctx) => {
    const headers = new Headers(request.headers);
    const traceHeaders = takeTraceHeaders(headers);
    return middleware(
      { ...request, headers },
      (inner) => {
        const restored = new Headers(inner.headers);
        for (const [name, value] of traceHeaders) restored.set(name, value);
        return next({ ...inner, headers: restored });
      },
      ctx,
    );
  };
}
