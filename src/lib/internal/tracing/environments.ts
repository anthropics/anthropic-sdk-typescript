import { context, trace, SpanKind, SpanStatusCode, type Context, type Span } from '@opentelemetry/api';
import type { BaseAnthropic } from '../../../client';
import { guardTracing, setErrorStatus } from '../../../internal/tracing';
import type { BetaSelfHostedWork } from '../../../resources/beta/environments/work';
import { ATTR_GEN_AI_PROVIDER_NAME } from './attributes';

/**
 * Starts the span of `work`, a Work item that the work poller just claimed, under `parentContext`:
 * the context of whoever asked the poller for the item.
 */
export function startEnvironmentWorkSpan(
  client: BaseAnthropic,
  work: BetaSelfHostedWork,
  parentContext: Context,
): Span | undefined {
  return client._tracer?.startSpan(
    'anthropic.environment.work',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        [ATTR_GEN_AI_PROVIDER_NAME]: client._genAIProviderName,
        'anthropic.environment.id': work.environment_id,
        'anthropic.environment.work.id': work.id,
        'anthropic.session.id': work.data.id,
      },
    },
    parentContext,
  );
}

/**
 * Ends the span of a Work item that is finished with as `OK`. The status stays unset when `signal`,
 * the work poller's, was aborted first: the item was then neither finished with nor failed.
 */
export function endEnvironmentWorkSpan(span: Span | undefined, signal: AbortSignal): void {
  if (!span?.isRecording()) {
    return;
  }
  if (!signal.aborted) {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}

/**
 * Ends the span of a Work item whose handling failed with `error`. The status stays unset when
 * `signal`, the work poller's, was aborted first, or `error` is such an abort.
 */
export function failEnvironmentWorkSpan(span: Span | undefined, signal: AbortSignal, error: unknown): void {
  if (!span?.isRecording()) {
    return;
  }
  if (!signal.aborted) {
    setErrorStatus(span, error);
  }
  span.end();
}

/**
 * Runs `handle`, the environment worker's handling of a Work item, with the item's span current,
 * and ends the span with how that went.
 */
export async function withEnvironmentWorkSpan(
  client: BaseAnthropic,
  span: Span | undefined,
  signal: AbortSignal,
  handle: () => Promise<void>,
): Promise<void> {
  if (!span) {
    return handle();
  }
  try {
    await context.with(trace.setSpan(context.active(), span), handle);
  } catch (error) {
    guardTracing(client, () => failEnvironmentWorkSpan(span, signal, error));
    throw error;
  }
  guardTracing(client, () => endEnvironmentWorkSpan(span, signal));
}
