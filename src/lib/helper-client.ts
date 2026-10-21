import { AnthropicError } from '../core/error';
import type { Anthropic } from '../client';
import { buildHeaders, type NullableHeaders } from '../internal/headers';
import {
  STAINLESS_HELPER_HEADER,
  type StainlessHelperHeaderValue,
} from '../internal/stainless-helper-header';

/**
 * Shared util for building a runner-helper-bound sub-client.
 *
 * The work poller, the environment worker, and the session tool runner each
 * need to issue requests authenticated by a per-helper credential (a
 * self-hosted environment key, today) rather than the parent client's own
 * API key, *and* tagged with their own `x-stainless-helper` telemetry
 * value. Each wants to inherit the parent's full configuration — `timeout`,
 * `maxRetries`, `fetch`, `fetchOptions`, custom `defaultHeaders`,
 * `defaultQuery` — and override only the auth + telemetry bits.
 *
 * {@link copyClientForHelper} is the one shared construction.
 */

interface ClientInternalAccess {
  _authState?: { extraHeaders?: Record<string, string> };
}

/**
 * Return a `withOptions()` clone of `client` set up for use *by* one of the
 * runner helpers: authenticated with `authToken` as Bearer credentials in
 * place of the parent's own credential, and tagged with the helper's
 * `x-stainless-helper` value on every outgoing request.
 *
 * The returned sub-client inherits the parent's full configuration
 * (`baseURL`, `timeout`, `maxRetries`, `fetch`, `fetchOptions`, custom
 * `defaultHeaders`, `defaultQuery`). Overrides applied:
 *
 * - `authToken: authToken` — the new credential, which replaces the parent's.
 * - `baseURL: client.baseURL` — pins the parent's resolved host (auth override otherwise resets it).
 * - `defaultHeaders` is rebuilt as `parent._authState.extraHeaders ⊕ parent.defaultHeaders ⊕
 *   {'x-stainless-helper': helper}`. `withOptions` *replaces* (does not
 *   merge) `defaultHeaders`, so we merge here so any custom headers the
 *   caller set on the parent client survive on the sub-client, except a
 *   hand-set `X-Api-Key` and a hand-set or omitted (`null`) `Authorization`.
 */
export function copyClientForHelper<T extends Anthropic>(
  client: T,
  { authToken, helper }: { authToken: string; helper: StainlessHelperHeaderValue },
): T {
  if (!authToken) {
    throw new AnthropicError(
      `copyClientForHelper: expected a non-empty authToken but received ${JSON.stringify(authToken)}`,
    );
  }
  const parentDefaults = client._options.defaultHeaders;
  // Carry the parent's credential/profile headers; strip the auth ones (we re-auth below).
  const parentAuthExtraHeaders = (client as unknown as ClientInternalAccess)._authState?.extraHeaders;
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
    { [STAINLESS_HELPER_HEADER]: helper },
  ]);
  // A parent that sends its key as a hand-set `X-Api-Key` also omits `Authorization`.
  defaultHeaders.values.delete('x-api-key');
  defaultHeaders.values.delete('authorization');
  defaultHeaders.nulls.delete('authorization');
  return client.withOptions({
    authToken,
    baseURL: client.baseURL,
    defaultHeaders,
  }) as T;
}
