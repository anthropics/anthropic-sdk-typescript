import { STAINLESS_HELPER_METHOD_HEADER } from '../../internal/stainless-helper-header';
import { type RequestOptions } from '../../internal/request-options';
import type {
  BetaRawMessageStreamEvent,
  BetaToolUseBlock,
  MessageCreateParamsBase,
  Messages,
} from '../../resources/beta/messages/messages';
import { BetaMessageStream, type MessageStreamEvents } from '../BetaMessageStream';

/**
 * The stream a tool runner yields. It hands each `tool_use` call to `onToolCall` once the model has moved on
 * from it, and the caller's listeners and `for await` loops over the stream have handled the event that shows it.
 */
export class BetaToolRunnerStream extends BetaMessageStream {
  #onToolCall: (toolUse: BetaToolUseBlock) => void;
  /** The number of stream events emitted so far */
  #emitted = 0;
  /** The `for await` loops over the stream that are still reading it */
  #readers: Reader[] = [];
  /** The `tool_use` blocks that have finished streaming, in the model's order */
  #toolCalls: BetaToolUseBlock[] = [];
  /** The last `tool_use` block to close, until the model moves on from it */
  #closed: BetaToolUseBlock | undefined;
  /** The calls the model has moved on from, in its order, until every reader has caught up with them */
  #ready: ReadyCall[] = [];
  /** Whether a refusal has handed the reply to a fallback model */
  #fallback = false;

  constructor(params: MessageCreateParamsBase, onToolCall: (toolUse: BetaToolUseBlock) => void) {
    super(params);
    this.#onToolCall = onToolCall;
  }

  /** The `tool_use` blocks that have finished streaming, in the model's order */
  get toolCalls(): readonly BetaToolUseBlock[] {
    return this.#toolCalls;
  }

  /** Sends the request as `client.beta.messages.stream()` does. */
  static start(
    messages: Messages,
    params: MessageCreateParamsBase,
    options: RequestOptions | undefined,
    onToolCall: (toolUse: BetaToolUseBlock) => void,
  ): BetaToolRunnerStream {
    const stream = new BetaToolRunnerStream({ ...params, stream: true }, onToolCall);
    for (const message of params.messages) {
      stream._addMessageParam(message);
    }
    stream._run(() =>
      stream._createMessage(
        messages,
        { ...params, stream: true },
        { ...options, headers: { ...options?.headers, [STAINLESS_HELPER_METHOD_HEADER]: 'stream' } },
      ),
    );
    return stream;
  }

  protected override _emit<Event extends keyof MessageStreamEvents>(
    event: Event,
    ...args: Parameters<MessageStreamEvents[Event]>
  ) {
    if (event !== 'streamEvent' || this.ended) {
      super._emit(event, ...args);
      return;
    }
    // Counted first, so that a reader created by a listener of this event starts after it.
    this.#emitted++;
    const [streamEvent, snapshot] = args as Parameters<MessageStreamEvents['streamEvent']>;
    const block = streamEvent.type === 'content_block_stop' ? snapshot.content[streamEvent.index] : undefined;
    const closed = block?.type === 'tool_use' ? block : undefined;
    if (closed) {
      this.#toolCalls.push(closed);
    }
    super._emit(event, ...args);
    this.#track(streamEvent, closed);
    this.#release();
  }

  override [Symbol.asyncIterator](): AsyncIterator<BetaRawMessageStreamEvent> {
    const iterator = super[Symbol.asyncIterator]();
    const reader: Reader = { handled: this.#emitted };
    this.#readers.push(reader);
    let holdsEvent = false;

    return {
      next: async () => {
        // Asking for the next event is how a `for await` loop says it is done with the one it holds.
        if (holdsEvent) {
          holdsEvent = false;
          reader.handled++;
          this.#release();
        }
        try {
          const result = await iterator.next();
          holdsEvent = !result.done;
          if (result.done) {
            this.#removeReader(reader);
          }
          return result;
        } catch (error) {
          this.#removeReader(reader);
          throw error;
        }
      },
      return: async () => {
        // Leaving the loop aborts the stream, which has to come first so that no call starts after it.
        const result = iterator.return?.();
        this.#removeReader(reader);
        return (await result) ?? { value: undefined, done: true };
      },
    };
  }

  #track(event: BetaRawMessageStreamEvent, closed: BetaToolUseBlock | undefined): void {
    if (this.#fallback) {
      return;
    }
    if (event.type === 'content_block_start' && event.content_block.type === 'fallback') {
      // The refusal that led to the fallback may have cut the call before it off.
      this.#fallback = true;
      this.#closed = undefined;
      return;
    }
    // A call's own `content_block_stop` isn't enough, because a reply that is cut off closes its last call too.
    const movedOn =
      event.type === 'content_block_start' ||
      (event.type === 'message_delta' && event.delta.stop_reason === 'tool_use');
    if (this.#closed && movedOn) {
      this.#ready.push({ toolUse: this.#closed, event: this.#emitted });
      this.#closed = undefined;
    }
    if (closed) {
      this.#closed = closed;
    }
  }

  /** Hands over the calls that the listeners and every reader are done with. */
  #release(): void {
    // Events that were already read still arrive after the stream has failed or been aborted.
    if (this.errored || this.controller.signal.aborted) {
      return;
    }
    const handled = Math.min(this.#emitted, ...this.#readers.map((reader) => reader.handled));
    while (this.#ready[0] && this.#ready[0].event <= handled) {
      this.#onToolCall(this.#ready.shift()!.toolUse);
    }
  }

  #removeReader(reader: Reader): void {
    const index = this.#readers.indexOf(reader);
    if (index >= 0) {
      this.#readers.splice(index, 1);
      this.#release();
    }
  }
}

type Reader = {
  /** The number of stream events the loop is done with, counting the ones emitted before it started */
  handled: number;
};

type ReadyCall = {
  toolUse: BetaToolUseBlock;
  /** The number of the event that showed the model had moved on from the call */
  event: number;
};
