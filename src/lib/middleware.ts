import type { APIRequest } from '../core/api';
import { AnthropicError } from '../core/error';
import type { Middleware, MiddlewareContext, MiddlewareNext } from '../core/middleware';
import { Stream, type ServerSentEvent } from '../core/streaming';
import { isAbortError } from '../internal/errors';
import { safeJSON } from '../internal/utils/values';
import type { AnthropicBeta } from '../resources/beta/beta';
import type {
  BetaContentBlockParam,
  BetaFallbackBlock,
  BetaFallbackMessageIterationUsage,
  BetaFallbackParam,
  BetaMessage,
  BetaMessageDeltaUsage,
  BetaMessageIterationUsage,
  BetaRawContentBlockDeltaEvent,
  BetaRawContentBlockStartEvent,
  BetaRawContentBlockStopEvent,
  BetaRawMessageDeltaEvent,
  BetaRawMessageStopEvent,
  BetaRawMessageStreamEvent,
  BetaRefusalStopDetails,
  BetaUsage,
  MessageCreateParams,
} from '../resources/beta/messages/messages';

export { BetaFallbackState } from '../internal/request-options';

const encoder = new TextEncoder();

/** Betas sent by default; override with {@link BetaRefusalFallbackOptions.betas}. */
const DEFAULT_BETAS: readonly AnthropicBeta[] = ['fallback-credit-2026-06-01'];

/**
 * Remove `fallback` blocks replayed in history. They only parse under the
 * server-side fallback beta, which belongs to the caller-owned server-side
 * `fallbacks` feature — this middleware never sends it, so a request
 * replaying them would 400. An assistant turn left empty is dropped whole.
 */
function stripFallbackBlocks(body: MessageCreateParams): MessageCreateParams {
  const messages = body.messages
    .map((message) =>
      Array.isArray(message.content) ?
        { ...message, content: message.content.filter((block) => block.type !== 'fallback') }
      : message,
    )
    .filter((message) => !Array.isArray(message.content) || message.content.length > 0);
  return { ...body, messages };
}

/** Why {@link BetaRefusalFallbackOptions.onError} fired. */
export type BetaRefusalFallbackError =
  | {
      /** The refusal carries no `fallback_credit_token`, so it can't be retried. */
      kind: 'no_credit_token';
      message: string;
      /** The refusal `message_delta` event, verbatim. */
      event: BetaRawMessageDeltaEvent;
    }
  | {
      /** The stream refused but every fallback entry has been used up. */
      kind: 'chain_exhausted';
      message: string;
      /** The refusal `message_delta` event, verbatim. */
      event: BetaRawMessageDeltaEvent;
    }
  | {
      /** A streaming fallback request failed; the hop was skipped. */
      kind: 'request_failed';
      message: string;
      /** The fallback model whose request failed. */
      model: string;
      /** The HTTP status, or `null` when the request threw instead of resolving. */
      status: number | null;
      /** The parsed error body, or the thrown error when `status` is `null`. */
      detail: unknown;
    };

export interface BetaRefusalFallbackOptions {
  /**
   * Betas added to the `anthropic-beta` header of every `/v1/messages`
   * request this middleware handles — the original request included, since
   * refusals only carry a `fallback_credit_token` when the beta is enabled.
   * Defaults to `['fallback-credit-2026-06-01']`; pass `[]` to send none.
   */
  betas?: readonly AnthropicBeta[] | undefined;

  /**
   * Called when a refusal is surfaced to the client rather than retried —
   * it carries no `fallback_credit_token`, no fallback entries remain, or a
   * streaming fallback request failed. Discriminate on `error.kind`.
   * Defaults to logging through the client logger.
   */
  onError?: ((error: BetaRefusalFallbackError) => void) | undefined;
}

/**
 * Middleware that retries refused `/v1/messages` requests down a fallback chain.
 *
 * Non-streaming: when a response comes back with `stop_reason: 'refusal'`, the
 * request is retried with each entry of `fallbacks` merged over the original
 * params — passing along the refusal's `fallback_credit_token` — until a model
 * accepts or the chain is exhausted. A message served by a fallback carries a
 * `fallback` content block prepended at each model boundary — the same seam
 * block shape the server-side `fallbacks` param places in `content`, though
 * the rest of the envelope is the serving hop's as returned (see the
 * known-divergences note below); an exhausted chain surfaces the final
 * refusal verbatim.
 *
 * Streaming: when the stream ends in `stop_reason: 'refusal'`, a second
 * request is issued to the fallback model — carrying the refused model's
 * partial output as a trailing assistant prefill when the refusal grants one
 * (`fallback_has_prefill_claim`), plus the refusal's `fallback_credit_token`
 * — and the fallback's events are spliced onto the
 * still-open stream, so the client sees one continuous message in the
 * server-side `fallbacks` wire shape: a `fallback` content block at each model
 * boundary, monotonic block indices, and per-hop `usage.iterations` on the
 * final `message_delta`. Only `model` is honored from each entry on this path:
 * the credit token is redeemable only against the refused request's body, so
 * the other per-entry overrides (`max_tokens`, `thinking`, ...) would be
 * rejected.
 *
 * The fallback-credit beta the credit tokens require is sent by default on
 * every request the middleware handles; the `betas` option controls this.
 *
 * In both modes a fallback that itself refuses with a fresh credit token
 * continues down the chain. A streaming fallback whose prefill the server
 * rejects (HTTP 400) is retried once without it; a fallback whose request
 * fails outright is skipped — its token was never redeemed, so it carries to
 * the next entry.
 *
 * To keep later requests on the model that accepted, pass a
 * {@link BetaFallbackState} via the `fallbackState` request option; requests
 * sharing that state start directly at the pinned fallback. Reuse one state
 * across whatever scope the pin should apply to — typically a conversation.
 *
 * @example
 * ```ts
 * const client = new Anthropic({
 *   middleware: [betaRefusalFallbackMiddleware([{ model: 'claude-opus-4-8' }])],
 * });
 *
 * const fallbackState = new BetaFallbackState();
 * const message = await client.beta.messages.create(params, { fallbackState });
 * ```
 */
export function betaRefusalFallbackMiddleware(
  fallbacks: readonly BetaFallbackParam[],
  options: BetaRefusalFallbackOptions = {},
): Middleware {
  let warnedMissingState = false;

  return async (request, next, ctx) => {
    // This middleware only applies to the beta messages API
    // (`client.beta.messages`, which posts to `/v1/messages?beta=true`).
    // An empty chain also disables this middleware.
    const [path, query] = (ctx.options?.path ?? '').split('?');
    if (
      fallbacks.length === 0 ||
      ctx.options?.method !== 'post' ||
      path !== '/v1/messages' ||
      new URLSearchParams(query).get('beta') !== 'true' ||
      typeof ctx.options.body !== 'object' ||
      ctx.options.body == null
    ) {
      return next(request);
    }

    if ((ctx.options.body as MessageCreateParams).fallbacks != null) {
      throw new AnthropicError(
        'Sending the `fallbacks:` request param is not supported when using the `betaRefusalFallbackMiddleware`. ' +
          'You should either remove the middleware and send `fallbacks:` with the `server-side-fallback-2026-06-01` beta header to let the API handle refusal fallbacks, ' +
          "or omit the `fallbacks:` param if you'd like `betaRefusalFallbackMiddleware` to handle fallbacks on the client side.",
      );
    }

    const onError =
      options.onError ??
      ((error: BetaRefusalFallbackError) =>
        ctx.logger.error(`anthropic-sdk: betaRefusalFallbackMiddleware: ${error.message}`));

    // Send the configured betas on this and every hop request derived from it.
    request = appendBetas(request, options.betas ?? DEFAULT_BETAS);

    const body = stripFallbackBlocks(ctx.options.body as MessageCreateParams);
    const state = ctx.options.fallbackState;

    // start from the pinned fallback (-1 = the original params)
    const startIndex = state?.index ?? -1;
    if (!Number.isInteger(startIndex) || startIndex < -1 || startIndex >= fallbacks.length) {
      throw new AnthropicError(
        `fallbackState.index ${startIndex} is out of bounds for a chain of ${fallbacks.length} fallback(s); was the state shared with a different middleware?`,
      );
    }

    // pin requests sharing the state to the entry being tried
    const pin = (index: number) => {
      if (state) {
        state.index = index;
      } else if (!warnedMissingState) {
        warnedMissingState = true;
        ctx.logger.warn(
          'anthropic-sdk: betaRefusalFallbackMiddleware fell back without a `fallbackState` request option; follow-up requests will retry models that already refused. Pass a shared `{ fallbackState: new BetaFallbackState() }` to pin them to the accepted model.',
        );
      }
    };

    // a non-string body can't be respliced or redeemed against — leave the
    // request untouched (the streaming path stands down on it below too)
    const initialRequest =
      typeof request.body !== 'string' ?
        request
      : {
          ...request,
          body: JSON.stringify(startIndex === -1 ? body : { ...body, ...fallbacks[startIndex] }),
        };

    const response = await next(initialRequest);
    if (!response.ok) {
      return response;
    }

    if (ctx.options.stream === true) {
      const firstHop = startIndex + 1;
      // Splicing needs at least one entry left to hop to and the JSON request
      // body the credit token is redeemable against (an earlier middleware
      // may have rewritten it to another BodyInit); otherwise the stream
      // passes through untouched.
      if (firstHop >= fallbacks.length || typeof initialRequest.body !== 'string') {
        return response;
      }
      return spliceFallbackStream({
        request: initialRequest,
        response,
        next,
        ctx,
        fallbacks,
        firstHop,
        onError,
        pin,
      });
    }

    let index = startIndex;
    let res = response;
    // The model the current hop was requested as — the caller's spelling, not
    // the server's `message.model` echo; the seam block's `from` carries it.
    let requestedModel = (startIndex === -1 ? body : { ...body, ...fallbacks[startIndex] }).model;
    const fallbackBlocks: BetaFallbackBlock[] = [];
    while (index < fallbacks.length - 1) {
      const message = await ctx.parse<BetaMessage | null>(res);
      if (message?.type !== 'message' || message.stop_reason !== 'refusal') {
        break;
      }

      index += 1;
      pin(index);
      const entry = fallbacks[index]!;
      // One `fallback` seam block per model boundary, prepended to the serving
      // hop's content below — the same block shape the server places in
      // `content`, not a claim of full envelope parity.
      fallbackBlocks.push({
        type: 'fallback',
        // `requestedModel` is always set for a typed body; the `??` defends
        // against an untyped body that carried no `model` field.
        from: { model: requestedModel ?? message.model },
        to: { model: entry.model },
        trigger: { type: 'refusal', category: message.stop_details?.category ?? null },
      });
      requestedModel = entry.model;
      res = await next({
        ...request,
        body: JSON.stringify({
          ...body,
          ...entry,
          ...(message.stop_details?.fallback_credit_token ?
            { fallback_credit_token: message.stop_details.fallback_credit_token }
          : undefined),
        }),
      });
    }

    if (fallbackBlocks.length === 0) {
      return res;
    }
    const served = await ctx.parse<BetaMessage | null>(res);
    // Chain exhausted on a refusal (or an error/malformed body): surface it
    // verbatim. The array guard keeps a message-shaped body with non-array
    // `content` from throwing at the spread below.
    if (served?.type !== 'message' || served.stop_reason === 'refusal' || !Array.isArray(served.content)) {
      return res;
    }
    // A fallback hop served (or exhausted the chain with output): prepend the
    // seam blocks so the app-visible `content` opens with one `fallback` block
    // per model boundary. Response init is preserved (same `_request_id`);
    // `content-length` is dropped since the body grew.
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    return new Response(JSON.stringify({ ...served, content: [...fallbackBlocks, ...served.content] }), {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
}

// --- streaming fallback (credit-token continuation) -------------------------
//
// The retry uses the appended-assistant form documented on
// `fallback_credit_token`: the refused request's body, extended by one
// trailing assistant turn carrying the refused model's partial output. The
// token authorizes that turn as a prefill continuation and applies the
// fallback credit. The refusal's `fallback_has_prefill_claim` says whether
// the partial output may be resent verbatim: when true the accumulated
// blocks are appended as-is; when false the refused hop's output is dropped
// and the token is redeemed against the same body.
//
// Known divergences from server-side `fallbacks` (applies to both paths):
//
// * Seam `to.model` and non-first `from.model` carry the chain entry's
//   spelling, not the canonical id the server emits.
// * Streaming: `message.model` keeps the refused model's id — `message_start`
//   has already been sent when the refusal arrives; the seam's `to.model`
//   carries the serving model.
// * Streaming: `usage.iterations` survives stream accumulation only on the
//   beta surface (`client.beta.messages.stream`); the non-beta accumulator
//   drops it. Non-streaming: no `fallback_message` entry is synthesized in
//   `usage.iterations` — the serving hop's `usage` passes through as-is.
// * Streaming: refusal text streamed before the refusal stays in the message
//   and is resent as-is (the appended turn must match the partial output
//   verbatim). Non-streaming: a refused hop's partial content is dropped.
// * First-seam `from.model` differs by path: non-streaming uses the caller's
//   body spelling; streaming uses the server's `message.model` echo.

interface FallbackStreamArgs {
  /** The request stream A was made with — the body its credit token is redeemable against. */
  request: APIRequest;
  /** Stream A: the OK SSE response that may end in a refusal. */
  response: Response;
  next: MiddlewareNext;
  ctx: MiddlewareContext;
  fallbacks: readonly BetaFallbackParam[];
  /** Index into `fallbacks` of the first entry to try when stream A refuses. */
  firstHop: number;
  onError: (error: BetaRefusalFallbackError) => void;
  /** Pin shared state to the entry being tried (or warn that there is none). */
  pin: (index: number) => void;
}

/**
 * Wrap stream A in a response whose body passes events through until a
 * retryable refusal, then splices the fallback chain's events on (see
 * {@link splicedEvents}). Cancelling the returned body tears down whichever
 * stream is being read and aborts any in-flight fallback request or retry
 * backoff: hop requests run under `controller`'s signal, which fires on
 * cancel and mirrors the original request's signal — a user abort has no
 * other way to reach a hop, since this synthetic body isn't fetch-backed.
 */
function spliceFallbackStream(args: FallbackStreamArgs): Response {
  const controller = new AbortController();
  const signal = args.request.signal;
  if (signal?.aborted) {
    controller.abort(signal.reason);
  } else {
    signal?.addEventListener('abort', makeAbort(controller, signal), { once: true });
  }
  const iter = splicedEvents(args, controller);
  const body = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      try {
        const { value, done } = await iter.next();
        if (done) return ctrl.close();
        ctrl.enqueue(value);
      } catch (err) {
        ctrl.error(err);
      }
    },
    async cancel() {
      controller.abort();
      await iter.return?.(undefined);
    },
  });
  return new Response(body, args.response);
}

/** A response content block being accumulated from its streaming deltas. */
type AccumulatedBlock = { index: number; block: any };

async function* splicedEvents(
  { request, response, next, ctx, fallbacks, firstHop, onError, pin }: FallbackStreamArgs,
  controller: AbortController,
): AsyncGenerator<Uint8Array> {
  // --- stream A: pass through until a chainable refusal ---
  const a = yield* consumeHop({
    response,
    controller,
    indexBase: 0,
    hasNext: true, // the caller guarantees firstHop < fallbacks.length
    onError,
    splice: null,
  });
  if (!a.refused) return; // non-refusal or not-retryable: pure pass-through.

  // --- fallback chain: try each entry in order ---
  // `base` is the assistant-turn content the current token's request already
  // carried — the token is redeemable only with it resent verbatim. `partial`
  // is the newest refused hop's output, included only when its refusal
  // granted a prefill claim (any other change to the body is a 400).
  let nextIndex = a.nextIndex; // monotonic block index across all spliced streams
  let token = a.refused.token;
  let base: BetaContentBlockParam[] = [];
  let partial = a.refused.hasPrefillClaim ? toPrefillBlocks(a.blocks) : [];
  let fromModel = a.model ?? '';
  let lastUsage: BetaMessageDeltaUsage | null = a.refused.usage;
  // The refusal whose token is currently in flight — surfaced verbatim (with a
  // recommended_model added) if every fallback request fails and we degrade.
  let refusalDetails = a.refused.stopDetails;

  // One `message` entry per refused hop, in order — A first. Failed hops are
  // skipped (no usage came back); the serving hop is appended as
  // `fallback_message` when its message_delta arrives.
  const iterations: BetaMessageIterationUsage[] = [
    toIterationUsage('message', a.model ?? '', a.refused.usage),
  ];

  for (let hop = firstHop; hop < fallbacks.length; hop++) {
    const model = fallbacks[hop]!.model;
    const hasNext = hop + 1 < fallbacks.length;
    pin(hop);

    // --- boundary: a `fallback` content block at the next monotonic index ---
    // Emitted before the request, so a hop that fails leaves its boundary in
    // place and the next attempt emits its own (still `from: fromModel` — the
    // last model that contributed output).
    const fbIndex = nextIndex++;
    yield emit<BetaRawContentBlockStartEvent>('content_block_start', {
      type: 'content_block_start',
      index: fbIndex,
      content_block: {
        type: 'fallback',
        from: { model: fromModel },
        to: { model },
        trigger: { type: 'refusal', category: refusalDetails?.category ?? null },
      },
    });
    yield emit<BetaRawContentBlockStopEvent>('content_block_stop', {
      type: 'content_block_stop',
      index: fbIndex,
    });

    // --- build the request: appended-assistant continuation ---
    // First attempt carries the newest partial appended (when its refusal
    // granted a prefill claim); a 400 on that form means the server rejected
    // the prefill, so the hop is retried once without it — the same-body
    // form the token always supports.
    let continuation = [...base, ...partial];
    let resB: Response | null = null;
    let failure: BetaRefusalFallbackError | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const reqB = buildFallbackRequest(request, { model, creditToken: token, continuation });
      // controller mirrors the original signal and additionally fires when the
      // spliced body is cancelled — either must abort an in-flight hop request.
      reqB.signal = controller.signal;

      try {
        resB = await next(reqB);
      } catch (err) {
        // the consumer cancelled (or the original request was aborted): unwind
        if (isAbortError(err)) throw err;
        failure = {
          kind: 'request_failed',
          message: `fallback request failed: ${err}`,
          model,
          status: null,
          detail: err,
        };
        break;
      }
      if (resB.ok) break;
      // ctx.parse reads through an internal clone, so it works even though
      // the client will also read this body; resB.text() would conflict.
      const errBody = await ctx.parse(resB).catch(() => null);
      if (attempt === 0 && resB.status === 400 && partial.length) {
        ctx.logger.warn(
          `anthropic-sdk: betaRefusalFallbackMiddleware: fallback request with the partial output appended was rejected (HTTP 400: ${JSON.stringify(
            errBody,
          )}); retrying without it`,
        );
        continuation = base;
        resB = null;
        continue;
      }
      failure = {
        kind: 'request_failed',
        message: `fallback request failed: HTTP ${resB.status}: ${JSON.stringify(errBody)}`,
        model,
        status: resB.status,
        detail: errBody,
      };
      break;
    }

    if (failure) {
      onError(failure);
      // The token was never redeemed — retry it against the next entry.
      if (hasNext) continue;
      // Surface the held refusal verbatim — its category/explanation and the
      // still-unredeemed credit token — and point recommended_model at the hop
      // we last tried.
      const stopDetails: BetaRefusalStopDetails = {
        ...refusalDetails,
        recommended_model: model,
      };
      yield emit<BetaRawMessageDeltaEvent>('message_delta', {
        type: 'message_delta',
        context_management: null,
        delta: {
          stop_reason: 'refusal',
          stop_sequence: null,
          container: null,
          stop_details: stopDetails,
        },
        usage: (lastUsage ?? {}) as BetaMessageDeltaUsage,
      });
      yield emit<BetaRawMessageStopEvent>('message_stop', { type: 'message_stop' });
      return;
    }

    // --- splice: monotonic indices, suppressed message_start, usage.iterations ---
    const b = yield* consumeHop({
      response: resB!,
      controller,
      indexBase: nextIndex,
      hasNext,
      onError,
      splice: { iterations, model },
    });
    if (!b.refused) return;

    // This hop refused too, with a fresh token: its emitted partial stays in
    // the client's message, becomes the next partial segment, and the chain
    // continues.
    token = b.refused.token;
    refusalDetails = b.refused.stopDetails;
    base = continuation;
    partial = b.refused.hasPrefillClaim ? toPrefillBlocks(b.blocks) : [];
    iterations.push(toIterationUsage('message', model, b.refused.usage));
    lastUsage = b.refused.usage;
    fromModel = model;
    nextIndex = b.nextIndex;
  }
}

/** The outcome of consuming one hop's stream. */
interface HopOutcome {
  /** Set when the hop refused with a credit token and an entry remained to chain to. */
  refused: {
    token: string;
    hasPrefillClaim: boolean;
    usage: BetaMessageDeltaUsage;
    /** The refusal's stop_details verbatim, surfaced if the whole chain degrades. */
    stopDetails: BetaRefusalStopDetails;
  } | null;
  /** The hop's serving model, from its message_start. */
  model: string | undefined;
  /** The hop's accumulated content blocks, in start order — the next partial segment. */
  blocks: any[];
  /** One past the highest (shifted) block index emitted — where the next boundary goes. */
  nextIndex: number;
}

/**
 * Consume one hop's SSE events, forwarding them to the client while
 * accumulating its content blocks (returned in the outcome).
 *
 * Stream A (`splice: null`) is forwarded in its original wire bytes; a
 * spliced hop (`splice` set) has its message_start suppressed (the client
 * already saw A's), its block indices shifted by `indexBase`, and its
 * terminal message_delta's usage rewritten to the `usage.iterations`
 * chain shape.
 *
 * A refusal that can be chained — it carries a `fallback_credit_token` and a
 * fallback entry remains — ends the hop early: open blocks are closed, the
 * terminal message_delta + message_stop are suppressed, and the token+usage
 * are returned so the caller can issue the next hop. Any other refusal is
 * reported through `onError` and passes through to the client.
 */
async function* consumeHop(args: {
  response: Response;
  controller: AbortController;
  /** Shift wire block indices by this much, keeping them monotonic across hops. */
  indexBase: number;
  /** Whether a fallback entry exists to chain to if this hop refuses. */
  hasNext: boolean;
  onError: (error: BetaRefusalFallbackError) => void;
  /** Splice context for fallback hops; null for stream A. */
  splice: { iterations: BetaMessageIterationUsage[]; model: string } | null;
}): AsyncGenerator<Uint8Array, HopOutcome> {
  const { response, controller, indexBase, hasNext, onError, splice } = args;
  const tracker = new BlockTracker(indexBase);
  let model: string | undefined;
  let startUsage: BetaUsage | null = null;

  for await (const sse of Stream.rawEvents(response, controller)) {
    const p = safeJSON(sse.data) as BetaRawMessageStreamEvent | undefined;
    switch (p?.type) {
      case 'message_start': {
        model = p.message.model;
        startUsage = p.message.usage;
        if (splice) continue;
        break;
      }
      case 'content_block_start': {
        tracker.start(p);
        if (splice) {
          yield emit(p.type, p);
          continue;
        }
        break;
      }
      case 'content_block_delta': {
        tracker.delta(p);
        if (splice) {
          yield emit(p.type, p);
          continue;
        }
        break;
      }
      case 'content_block_stop': {
        tracker.stop(p);
        if (splice) {
          yield emit(p.type, p);
          continue;
        }
        break;
      }
      case 'message_delta': {
        if (p.delta.stop_reason === 'refusal') {
          // `fallback_credit_token` is null when the refusal isn't eligible
          // for a fallback credit; without one we don't retry.
          const details = p.delta.stop_details?.type === 'refusal' ? p.delta.stop_details : null;
          if (details?.fallback_credit_token && hasNext) {
            const usage = backfill(p.usage, startUsage);
            yield* tracker.closeOpenBlocks();
            // suppress this hop's message_delta + message_stop
            return {
              refused: {
                token: details.fallback_credit_token,
                hasPrefillClaim: details.fallback_has_prefill_claim === true,
                usage,
                stopDetails: details,
              },
              model,
              blocks: tracker.contentBlocks(),
              nextIndex: tracker.nextIndex,
            };
          }
          if (!details?.fallback_credit_token) {
            onError({
              kind: 'no_credit_token',
              message: 'refusal stop_details has no fallback_credit_token',
              event: p,
            });
          } else {
            onError({
              kind: 'chain_exhausted',
              message: 'refusal but no fallback entries remain',
              event: p,
            });
          }
        }
        if (splice) {
          // Terminal hop. Replace iterations, don't append: this hop's own
          // message_delta self-reports a single `{type:"message",
          // model:undefined}` iteration (a fresh non-fallback request counts
          // itself as one message hop). Server-side `fallbacks` relabels the
          // whole chain instead — refused hops as `message`, the serving hop
          // as `fallback_message` — so spreading the self-report would
          // prepend a spurious `message:undefined` entry.
          const usage = backfill(p.usage, startUsage);
          usage.iterations = [
            ...splice.iterations,
            toIterationUsage('fallback_message', splice.model, usage),
          ];
          p.usage = usage;
          yield emit('message_delta', p);
          continue;
        }
        break;
      }
    }

    // message_stop, ping, error, unrecognised — and for stream A every
    // event — pass through in their original wire bytes.
    yield passthroughSSE(sse);
  }
  return { refused: null, model, blocks: tracker.contentBlocks(), nextIndex: tracker.nextIndex };
}

/**
 * Block bookkeeping for one stream of the splice: accumulates each content
 * block from its deltas (for the continuation prefill), shifts wire indices
 * by `indexBase` so they stay monotonic across hops, and tracks which blocks
 * are still open so a refusal that cuts mid-block can close them.
 */
class BlockTracker {
  /** The stream's accumulated blocks keyed by their original wire index. */
  private blocks: AccumulatedBlock[] = [];
  /** One past the highest shifted block index seen. */
  nextIndex: number;
  /** Shifted indices of blocks started but not yet stopped. */
  private open: number[] = [];

  constructor(private indexBase: number = 0) {
    this.nextIndex = indexBase;
  }

  /** The accumulated content blocks, in start order. */
  contentBlocks(): any[] {
    return this.blocks.map((b) => b.block);
  }

  /** Track a content_block_start, shifting `event.index`. */
  start(event: BetaRawContentBlockStartEvent): void {
    this.blocks.push({ index: event.index, block: { ...event.content_block } });
    event.index += this.indexBase;
    this.open.push(event.index);
    this.nextIndex = Math.max(this.nextIndex, event.index + 1);
  }

  /** Apply a content_block_delta to its accumulating block, shifting `event.index`. */
  delta(event: BetaRawContentBlockDeltaEvent): void {
    applyDelta(this.blocks, event.index, event.delta);
    event.index += this.indexBase;
  }

  /** Track a content_block_stop, shifting `event.index`. */
  stop(event: BetaRawContentBlockStopEvent): void {
    event.index += this.indexBase;
    const i = this.open.indexOf(event.index);
    if (i !== -1) this.open.splice(i, 1);
    this.nextIndex = Math.max(this.nextIndex, event.index + 1);
  }

  /** content_block_stop events for any blocks still open. */
  *closeOpenBlocks(): Generator<Uint8Array> {
    for (const index of this.open) {
      yield emit<BetaRawContentBlockStopEvent>('content_block_stop', {
        type: 'content_block_stop',
        index,
      });
    }
    this.open.length = 0;
  }
}

// --- fallback request construction (appended-assistant continuation) -------

function buildFallbackRequest(
  orig: APIRequest,
  {
    model,
    creditToken,
    continuation,
  }: {
    model: string;
    creditToken: string;
    continuation: BetaContentBlockParam[];
  },
): APIRequest {
  // the caller guarantees a JSON string body (checked before stream A is read)
  const body = JSON.parse(orig.body as string);

  body.model = model;
  body.fallback_credit_token = creditToken;

  // Append the continuation (decided by the chain loop) as a trailing
  // assistant turn; everything else must stay identical to the refused
  // request. When the refusal granted no prefill claim, omit the turn
  // entirely and send the same-body form.
  if (continuation.length) {
    body.messages = [...body.messages, { role: 'assistant', content: continuation }];
  }

  // Do NOT touch max_tokens (or any other render-shaping field): the token is
  // only redeemable against the same request body as the refused request —
  // model, fallback_credit_token, and the one appended assistant turn are the
  // only permitted deltas; anything else is a 400 ("request body ... does not
  // match the original refused request"). This is also why the per-entry
  // BetaFallbackParam overrides are ignored on the streaming path.

  return { ...orig, headers: new Headers(orig.headers), body: JSON.stringify(body) };
}

// --- block accumulation & prefill conversion -------------------------------

/** Apply a content_block_delta to the accumulating block at `index`. */
function applyDelta(
  blocks: AccumulatedBlock[],
  index: number,
  delta: BetaRawContentBlockDeltaEvent['delta'],
): void {
  const block = blocks.find((x) => x.index === index)?.block;
  if (!block) return;
  switch (delta.type) {
    case 'text_delta': {
      block.text = (block.text ?? '') + delta.text;
      break;
    }
    case 'input_json_delta': {
      block._partial_json = (block._partial_json ?? '') + delta.partial_json;
      break;
    }
    case 'citations_delta':
      (block.citations ??= []).push(delta.citation);
      break;
    case 'thinking_delta': {
      block.thinking = (block.thinking ?? '') + delta.thinking;
      break;
    }
    case 'signature_delta': {
      block.signature = delta.signature;
      break;
    }
    case 'compaction_delta': {
      break;
    }
    default:
      ((_: never) => {})(delta);
  }
}

/**
 * Convert a hop's accumulated response blocks to the appended assistant turn,
 * as-is: a `fallback_has_prefill_claim` refusal guarantees the partial output
 * is resendable verbatim, so no client-side filtering is applied. The only
 * rewrite is reassembling tool inputs from their accumulated
 * `input_json_delta` JSON (content_block_start carries `input: {}`).
 */
function toPrefillBlocks(responseBlocks: any[]): BetaContentBlockParam[] {
  return responseBlocks.map((b) => {
    if (typeof b?._partial_json !== 'string') return b;
    const { _partial_json, ...block } = b;
    return { ...block, input: safeJSON(_partial_json) ?? block.input };
  });
}

// --- helpers --------------------------------------------------------------

/**
 * A copy of `request` with `betas` appended to its `anthropic-beta` header,
 * skipping values already present (set by the caller or another middleware).
 */
function appendBetas(request: APIRequest, betas: readonly AnthropicBeta[]): APIRequest {
  if (!betas.length) return request;
  const headers = new Headers(request.headers);
  const existing = new Set(
    headers
      .get('anthropic-beta')
      ?.split(',')
      .map((s) => s.trim()),
  );
  for (const beta of betas) {
    if (!existing.has(beta)) {
      headers.append('anthropic-beta', beta);
      existing.add(beta);
    }
  }
  return { ...request, headers };
}

function emit<T extends { type: string }>(event: T['type'], payload: T): Uint8Array {
  const sse: ServerSentEvent = { event, data: JSON.stringify(payload), raw: [] };
  return encoder.encode(serializeSSE(sse));
}

/**
 * Forward a decoded event in its original wire bytes, preserving SSE fields
 * the decoder doesn't model (`id:`, `retry:`, comment lines). Falls back to
 * re-serializing for events with no raw lines.
 */
function passthroughSSE(sse: ServerSentEvent): Uint8Array {
  return encoder.encode(sse.raw.length ? sse.raw.join('\n') + '\n\n' : serializeSSE(sse));
}

// Field-wise union of BetaUsage and BetaMessageDeltaUsage, all nullable —
// a plain Partial<A & B> intersects `number` with `number | null` down to
// `number`, which rejects delta usage objects.
type UsageLike =
  | { [K in keyof (BetaUsage & BetaMessageDeltaUsage)]?: (BetaUsage & BetaMessageDeltaUsage)[K] | null }
  | null
  | undefined;

function toIterationUsage(type: 'message', model: string, u: UsageLike): BetaMessageIterationUsage;
function toIterationUsage(
  type: 'fallback_message',
  model: string,
  u: UsageLike,
): BetaFallbackMessageIterationUsage;
function toIterationUsage(
  type: 'message' | 'fallback_message',
  model: string,
  u: UsageLike,
): BetaMessageIterationUsage | BetaFallbackMessageIterationUsage {
  return {
    type,
    model,
    input_tokens: u?.input_tokens ?? 0,
    output_tokens: u?.output_tokens ?? 0,
    cache_read_input_tokens: u?.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: u?.cache_creation_input_tokens ?? 0,
    cache_creation: u?.cache_creation ?? null,
  };
}

/** Fill null/undefined fields on `primary` from `fallback`. */
function backfill(
  primary: BetaMessageDeltaUsage | null | undefined,
  fallback: BetaUsage | null | undefined,
): BetaMessageDeltaUsage {
  const out: any = { ...(fallback ?? {}), ...(primary ?? {}) };
  for (const k of Object.keys(out)) {
    if (out[k] == null && (fallback as any)?.[k] != null) out[k] = (fallback as any)[k];
  }
  return out;
}

/**
 * Serialize a {@link ServerSentEvent} back to its SSE wire form
 * (`event: ...\ndata: ...\n\n`). Multi-line `data` is emitted as one
 * `data:` line per line, matching the spec. The inverse of the decoder
 * behind {@link Stream.rawEvents}.
 */
function serializeSSE(sse: ServerSentEvent): string {
  let out = '';
  if (sse.event !== null) out += `event: ${sse.event}\n`;
  for (const line of sse.data.split('\n')) out += `data: ${line}\n`;
  return out + '\n';
}

function makeAbort(controller: AbortController, signal: AbortSignal) {
  return () => controller.abort(signal.reason);
}
