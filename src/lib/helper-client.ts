import { AnthropicError } from '../core/error';
import type { Anthropic } from '../client';
import { buildHeaders, type HeadersLike, type NullableHeaders } from '../internal/headers';

/**
 * Shared util for building a runner-helper-bound sub-client.
 *
 * The work poller, the environment worker, and the session tool runner each
 * need to issue requests authenticated by a per-helper credential (a
 * self-hosted environment key, today) rather than the parent client's own
 * `X-Api-Key`, *and* tagged with their own `x-stainless-helper` telemetry
 * value. Each wants to inherit the parent's full configuration — `timeout`,
 * `maxRetries`, `fetch`, `fetchOptions`, custom `defaultHeaders`,
 * `defaultQuery` — and override only the auth + telemetry bits.
 *
 * {@link copyClientForHelper} is the one shared construction.
 */

/**
 * The closed set of `x-stainless-helper` telemetry tags the runner helpers
 * stamp on outgoing requests. Constrained as a string union so a typo at any
 * call site is a type error rather than silently mistagged telemetry.
 */
export type HelperTag = 'environments-work-poller' | 'environments-worker' | 'session-tool-runner';

interface ClientInternalAccess {
  _options: { defaultHeaders?: HeadersLike };
  _authState?: { extraHeaders?: Record<string, string> };
}

/**
 * Return a `withOptions()` clone of `client` set up for use *by* one of the
 * runner helpers: authenticated with `authToken` as Bearer credentials, with
 * the parent's `X-Api-Key` cleared, and tagged with the helper's
 * `x-stainless-helper` value on every outgoing request.
 *
 * The returned sub-client inherits the parent's full configuration
 * (`baseURL`, `timeout`, `maxRetries`, `fetch`, `fetchOptions`, custom
 * `defaultHeaders`, `defaultQuery`). Overrides applied:
 *
 * - `authToken: authToken` — the new credential.
 * - `apiKey: null` — the parent's `X-Api-Key` is cleared. `withOptions`
 *   inherits the parent's `apiKey` by default; without this, both
 *   `X-Api-Key` *and* `Authorization: Bearer …` would land on the wire.
 *   `client.ts` only triggers the env-var fallback when `apiKey === undefined`,
 *   so explicit `null` is honored.
 * - `credentials: undefined` — opts the clone out of any inherited
 *   credentials/config/profile so the explicit bearer is the unambiguous auth.
 * - `baseURL: client.baseURL` — pins the parent's resolved host (auth override otherwise resets it).
 * - `defaultHeaders` is rebuilt as `parent._authState.extraHeaders ⊕ parent.defaultHeaders ⊕
 *   {'x-stainless-helper': helper}`. `withOptions` *replaces* (does not
 *   merge) `defaultHeaders`, so we merge here so any custom headers the
 *   caller set on the parent client survive on the sub-client.
 */
export function copyClientForHelper<T extends Anthropic>(
  client: T,
  { authToken, helper }: { authToken: string; helper: HelperTag },
): T {
  if (!authToken) {
    throw new AnthropicError(
      `copyClientForHelper: expected a non-empty authToken but received ${JSON.stringify(authToken)}`,
    );
  }
  const internal = client as unknown as ClientInternalAccess;
  const parentDefaults = internal._options.defaultHeaders;
  // Carry the parent's credential/profile headers; strip the auth ones (we re-auth below).
  const parentAuthExtraHeaders = internal._authState?.extraHeaders;
  const inheritedAuthExtraHeaders: Record<string, string> | undefined =
    parentAuthExtraHeaders ?
      Object.fromEntries(
        Object.entries(parentAuthExtraHeaders).filter(([name]) => {
          const lower = name.toLowerCase();
          return lower !== 'authorization' && lower !== 'x-api-key';
        }),
      )
    : undefined;
  const defaultHeaders: NullableHeaders = buildHeaders([
    inheritedAuthExtraHeaders,
    parentDefaults,
    { 'x-stainless-helper': helper },
  ]);
  return client.withOptions({
    apiKey: null,
    authToken,
    baseURL: client.baseURL,
    credentials: undefined,
    defaultHeaders,
  }) as T;
}
