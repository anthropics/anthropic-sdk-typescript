import type { RequestOptions } from '../../internal/request-options';
import type { Simplify } from '../internal/types';
import type {
  BetaMessage,
  BetaMessageParam,
  BetaToolUnion,
  MessageCreateParamsBase,
} from '../../resources/beta/messages/messages';
import type { AutoParseableBetaOutputParams } from '../beta-parser';
import type { BetaRunnableTool } from '../tools/BetaRunnableTool';

/** What a thread does with a request the server cannot thread. */
export type UnsupportedRequestBehavior = 'error' | 'continue_unthreaded';

/** The `create()` fields a thread holds between turns: every field except `messages`, `thread` and `stream`. */
export type BetaMessageThreadFields = Simplify<
  Omit<
    MessageCreateParamsBase,
    'messages' | 'stream' | 'thread' | 'output_format' | 'output_config' | 'tools'
  > &
    AutoParseableBetaOutputParams & { tools?: Array<BetaToolUnion | BetaRunnableTool<any>> }
>;

/** The arguments of `client.beta.messages.thread()`. */
export type BetaMessageThreadCreateParams = Simplify<
  BetaMessageThreadFields & {
    /** Seeds the history; the first turn sends it. Omit to start empty. */
    messages?: Array<BetaMessageParam>;
    /**
     * What to do when the server cannot thread a request: `'error'` throws the API's error, and `'continue_unthreaded'`
     * sends that turn and every later one with the full history and no `thread`.
     *
     * @default 'error'
     */
    unsupportedRequestBehavior?: UnsupportedRequestBehavior;
  }
>;

/** The request options a thread accepts at creation, per turn, and in `update()`. */
export type BetaMessageThreadRequestOptions = Pick<
  RequestOptions,
  'headers' | 'signal' | 'timeout' | 'maxRetries' | 'fallbackState'
>;

/**
 * Per-turn overrides for `send()` / `parse()` / `stream()`, and the params of `update()`: any thread field except
 * `output_config` and `output_format`. Anything omitted falls back to the thread's value.
 */
export type BetaMessageThreadSendParams = Simplify<
  Partial<Omit<BetaMessageThreadFields, 'output_format' | 'output_config'>>
>;

/** The messages `send()` / `parse()` / `stream()` / `append()` accept: one, several, or a reply as returned. */
export type BetaMessageThreadInput =
  | BetaMessageParam
  | BetaMessage
  | ReadonlyArray<BetaMessageParam | BetaMessage>;
