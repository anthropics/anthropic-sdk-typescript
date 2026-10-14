import type { BaseAnthropic } from '../../client';
import { buildHeaders } from '../../internal/headers';
import type { RequestOptions } from '../../internal/request-options';
import { stainlessHelperHeader } from '../../internal/stainless-helper-header';
import { startApiCallSpan, type ApiCallSpan } from '../../internal/tracing';
import type { MessageCreateParamsBase } from '../../resources/messages/messages';
import { messagesCreateSpanSettings } from './tracing';

/**
 * The headers of a `messages.create` request. `create()` and `stream()` build them before they
 * start the span, so that what throws here throws while no span is open.
 */
export function messagesCreateHeaders(params: MessageCreateParamsBase, options: RequestOptions | undefined) {
  const { user_profile_id, workspace_id, tools, messages } = params;
  return buildHeaders([
    {
      ...(user_profile_id != null ? { 'anthropic-user-profile-id': user_profile_id } : undefined),
      ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
    },
    stainlessHelperHeader(tools, messages),
    options?.headers,
  ]);
}

/**
 * Starts the call span of the request that a stream helper sends `body` with. The helper calls this
 * as it sends the request, so that what throws here fails the stream. It records the final message
 * on the span, which its `create()` call uses too.
 */
export function startMessagesStreamSpan(
  client: BaseAnthropic,
  body: MessageCreateParamsBase,
  options: RequestOptions | undefined,
): ApiCallSpan | undefined {
  if (!client._tracer) return undefined;
  // Built here too, where no span is open yet: the helper's `create()` call builds them again
  // from the same input, so it cannot throw once the span is open.
  const headers = messagesCreateHeaders(body, options);
  return startApiCallSpan(
    client,
    'anthropic.messages.create',
    options,
    messagesCreateSpanSettings(client, { ...body, stream: true }, headers),
  );
}
