import { AnthropicError, APIError } from '../../../core/error';
import type { Logger } from '../../../client';
import { type HeadersLike, appendHeaderValue, buildHeaders } from '../../../internal/headers';
import { STAINLESS_HELPER_METHOD_HEADER, helperHeader } from '../../../internal/stainless-helper-header';
import type { RequestOptions } from '../../../internal/request-options';
import { isObj, isReadonlyArray } from '../../../internal/utils/values';
import type {
  BetaMessage,
  BetaMessageParam,
  BetaStopReason,
  MessageCreateParamsBase,
} from '../../../resources/beta/messages/messages';
import type {
  UnsupportedRequestBehavior,
  BetaMessageThreadFields,
  BetaMessageThreadCreateParams,
  BetaMessageThreadRequestOptions,
  BetaMessageThreadSendParams,
  BetaMessageThreadInput,
} from '../../threads/params';

/** The `create()` arguments of one turn, except `stream`. */
type CreateArguments = { params: MessageCreateParamsBase; options: RequestOptions };

/**
 * One message of the history: the reply it records if the thread received it from the server rather than from the
 * caller, and whether that reply's stream ended before `message_stop`.
 */
type Entry =
  | { param: BetaMessageParam; reply: null }
  | { param: BetaMessageParam; reply: BetaMessage; partial: boolean };

/**
 * What the next turn builds on: no `thread` field (in a state that never threads, or on a thread that has stopped), a
 * new thread it creates with the full history, or the stored reply it continues from. `replacesLostThread` says that
 * the thread stands in for one the server no longer had, and that no turn has continued it yet.
 */
type Anchor =
  | { type: 'never_threaded' }
  | { type: 'unthreaded' }
  | { type: 'create'; replacesLostThread: boolean }
  | { type: 'continue'; previousMessageId: string; createdWith: CreateOnlyJSON; replacesLostThread: boolean };

/**
 * A turn in flight: the request fields it sends, the messages its call staged, the create-only fields its call gave,
 * and the history edits to apply once it ends.
 */
class Turn {
  deferredMessages: Array<BetaMessageParam | BetaMessage> = [];
  replacementHistory: BetaMessageParam[] | null = null;
  // As JSON: a copy, because the caller can still edit the values they gave.
  readonly createOnly: CreateOnlyJSON;

  constructor(
    readonly fields: BetaMessageThreadFields,
    readonly ownMessages: readonly Entry[],
    // Less the ones set on the thread since the call, because the later value stands.
    public ownCreateOnly: CreateOnlyFields,
  ) {
    this.createOnly = createOnlyJSON(fields);
  }
}

export type { Turn };

/**
 * A thread's local view of the conversation: the full history, which part of it the server holds and which
 * reply the next turn continues from, the request fields for the next turn, and the turn in flight, if any.
 *
 * Sends nothing itself: it assembles each turn's `create()` arguments and records what the reply changes.
 */
export class ThreadState {
  options: BetaMessageThreadRequestOptions;
  readonly unsupportedRequestBehavior: UnsupportedRequestBehavior;
  #fields: BetaMessageThreadFields;
  #stored: Entry[] = [];
  #staged: Entry[] = [];
  #anchor: Anchor;
  #turn: Turn | null = null;
  readonly #logger: Logger;

  constructor({
    params,
    options,
    threading,
    logger,
  }: {
    params: BetaMessageThreadCreateParams;
    options: BetaMessageThreadRequestOptions;
    threading: boolean;
    logger: Logger;
  }) {
    const { messages, unsupportedRequestBehavior, ...fields } = params;
    rejectThreadField(fields);
    this.options = options;
    this.unsupportedRequestBehavior = unsupportedRequestBehavior ?? 'error';
    this.#fields = fields;
    this.#anchor = threading ? { type: 'create', replacesLostThread: false } : { type: 'never_threaded' };
    this.#logger = logger;
    this.push(messages ?? []);
  }

  /** Whether turns send a `thread` field at all. */
  get threading(): boolean {
    return this.#anchor.type === 'create' || this.#anchor.type === 'continue';
  }

  /** The `id` of the stored reply the next turn continues from, or `null` when it starts a new thread. */
  get previousMessageId(): string | null {
    return this.#anchor.type === 'continue' ? this.#anchor.previousMessageId : null;
  }

  /**
   * Every message the server holds plus those staged for the next turn, with any edits deferred by a turn in flight
   * already applied.
   */
  get messages(): BetaMessageParam[] {
    const messages =
      this.#turn?.replacementHistory?.slice() ??
      [...this.#stored, ...this.#staged].map((entry) => entry.param);
    if (this.#turn) messages.push(...this.#turn.deferredMessages.map(toMessageParam));
    return messages;
  }

  /**
   * The thread as the params of one call for the whole conversation: its request fields and full history. A new
   * object on each access. While a turn that creates the thread is in flight, it shows that turn's create-only fields.
   */
  get params(): BetaMessageThreadFields & { messages: BetaMessageParam[] } {
    const ownCreateOnly = this.#anchor.type === 'create' ? this.#turn?.ownCreateOnly : undefined;
    return { ...this.#fields, ...ownCreateOnly, messages: this.messages };
  }

  /** Stage messages for the next turn, skipping the reply just recorded and deferring while a turn is in flight. */
  push(messages: Iterable<BetaMessageParam | BetaMessage>): void {
    if (this.#turn) {
      this.#turn.deferredMessages.push(...messages);
      return;
    }
    for (const message of messages) {
      if (this.#repeatsLastReply(message)) continue;
      this.#staged.push({ param: toMessageParam(message), reply: null });
    }
  }

  /** The most recent reply the history records. */
  get #lastReply(): BetaMessage | null {
    for (const entries of [this.#staged, this.#stored]) {
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i]!.reply) return entries[i]!.reply;
      }
    }
    return null;
  }

  /** Whether `message` is the reply just recorded, pushed again right after it. */
  #repeatsLastReply(message: BetaMessageParam | BetaMessage): boolean {
    if ('id' in message) return message.id === this.#lastReply?.id;
    const last = this.#staged.at(-1) ?? this.#stored.at(-1);
    return last?.reply != null && sameMessage(message, last.param);
  }

  /** Apply the given request fields and request options to all later turns. */
  update(fields: BetaMessageThreadSendParams = {}, options: BetaMessageThreadRequestOptions = {}): void {
    rejectThreadField(fields);
    this.#fields = { ...this.#fields, ...definedEntries(fields) };
    this.options = { ...this.options, ...definedEntries(options) };
    for (const field of CREATE_ONLY_FIELDS) {
      if (fields[field] !== undefined) delete this.#turn?.ownCreateOnly[field];
    }
  }

  /**
   * A copy with the same history and options that continues from no stored reply and has no turn in flight. Its request
   * fields are the same too, unless `fields` takes their place.
   */
  fork(fields: BetaMessageThreadFields = this.#fields): ThreadState {
    const fork = new ThreadState({
      params: { ...fields, unsupportedRequestBehavior: this.unsupportedRequestBehavior },
      options: this.options,
      threading: this.#anchor.type !== 'never_threaded',
      logger: this.#logger,
    });
    if (!this.threading) fork.stopThreading();
    if (this.#turn?.replacementHistory) {
      fork.#staged = this.#turn.replacementHistory.map((param) => ({ param, reply: null }));
    } else {
      fork.#stored = [...this.#stored];
      fork.#staged = [...this.#staged];
    }
    if (this.#turn) fork.push(this.#turn.deferredMessages);
    return fork;
  }

  /** Replace the request fields with those of `params`, so a field it leaves out is gone, then `setMessages()`. */
  setParams({ messages, ...fields }: BetaMessageThreadFields & { messages: BetaMessageParam[] }): void {
    this.#fields = fields;
    if (this.#turn) this.#turn.ownCreateOnly = {};
    this.setMessages(messages);
  }

  /**
   * Take the history from `messages`: additions to the current history are staged, and any other list replaces it
   * and starts a new thread.
   */
  setMessages(messages: BetaMessageParam[]): void {
    const entries = [...this.#stored, ...this.#staged];
    if (this.#turn) {
      // A turn in flight has already sent what is staged: an edit that only appends to it is deferred like
      // `push()`, and a rewritten history replaces the thread (and anything deferred so far) once the turn ends.
      const sent = entries.map((entry) => entry.param);
      if (startsWith(messages, sent)) {
        this.#turn.replacementHistory = null;
        this.#turn.deferredMessages = messages.slice(sent.length);
      } else {
        this.#turn.replacementHistory = messages;
        this.#turn.deferredMessages = [];
      }
      return;
    }
    if (
      !startsWith(
        messages,
        this.#stored.map((entry) => entry.param),
      )
    ) {
      this.#stored = [];
      if (this.threading) this.#anchor = { type: 'create', replacesLostThread: false };
    }
    this.#staged = [];
    // A message that is a recorded reply keeps that record, so a history copied from `messages` or `params` and
    // edited still knows which of its messages the thread received rather than was given.
    const replies = new Map(
      entries.filter((entry) => entry.reply).map((entry) => [entry.param.content, entry]),
    );
    for (const message of messages.slice(this.#stored.length)) {
      if (this.#repeatsLastReply(message)) continue;
      this.#staged.push({
        ...(replies.get(message.content) ?? { reply: null }),
        param: toMessageParam(message),
      });
    }
  }

  /** Whether the next turn has something to send: staged messages, or an unfinished reply to resume. */
  get hasTurnToSend(): boolean {
    return this.#staged.length > 0 || isUnfinishedStopReason(this.#stored.at(-1)?.reply?.stop_reason);
  }

  /** Stage `messages` and start the turn that sends them with the overrides `fields`, in flight until `endTurn()`. */
  startTurn(messages: Iterable<BetaMessageParam | BetaMessage>, fields: BetaMessageThreadSendParams): Turn {
    if (this.#turn) {
      throw new AnthropicError(
        'Another `send()`, `parse()` or `stream()` is already in progress on this thread',
      );
    }
    rejectThreadField(fields);
    const alreadyStaged = this.#staged.length;
    this.push(messages);
    const ownMessages = this.#staged.slice(alreadyStaged);
    this.#retryPartialTurn();
    const ownCreateOnly: CreateOnlyFields = {};
    if (fields.system !== undefined) ownCreateOnly.system = fields.system;
    if (fields.tools !== undefined) ownCreateOnly.tools = fields.tools;
    return (this.#turn = new Turn(
      { ...this.#fields, ...definedEntries(fields) },
      ownMessages,
      ownCreateOnly,
    ));
  }

  /**
   * Mark `turn` finished, take back the messages its call staged if no reply to them started, and apply the history
   * edits deferred during it.
   */
  endTurn(turn: Turn): void {
    this.#turn = null;
    // A reply that started has moved everything staged into the stored history.
    this.#staged = this.#staged.filter((entry) => !turn.ownMessages.includes(entry));
    if (turn.replacementHistory) this.setMessages(turn.replacementHistory);
    this.push(turn.deferredMessages);
  }

  /**
   * Whether the turn should be sent again because `error` is a thread rejection this state has now adjusted for. With
   * `'continue_unthreaded'` a replay that finds the new thread lost as well stops threading, because the server may be
   * unable to store the conversation.
   */
  recoversFrom(error: unknown): boolean {
    if (!(error instanceof APIError)) return false;
    const continuesUnthreaded = this.unsupportedRequestBehavior === 'continue_unthreaded';
    const reason = replayReason(error);
    if (reason !== null && this.#anchor.type === 'continue') {
      if (reason === 'thread_not_found' && this.#anchor.replacesLostThread && continuesUnthreaded) {
        this.#logger.info(
          `The server lost the thread again right after a replay; continuing without a thread: previous_message_id=${this.#anchor.previousMessageId}`,
        );
        this.stopThreading();
      } else {
        this.#startNewThread(reason);
      }
      return true;
    }
    const unsupported = unsupportedFeatures(error);
    if (unsupported !== null && this.threading && continuesUnthreaded) {
      this.#logger.info(
        `The server cannot thread this request; continuing without a thread: unsupported=${unsupported.join(
          ',',
        )}`,
      );
      this.stopThreading();
      return true;
    }
    return false;
  }

  /** Stop continuing from the stored reply so the turn re-sends the full history under a new thread. */
  #startNewThread(reason: NewThreadReason): void {
    this.#logger.info(
      `Replaying the full message history under a new thread: reason=${reason} previous_message_id=${this.previousMessageId}`,
    );
    this.#anchor = { type: 'create', replacesLostThread: reason === 'thread_not_found' };
  }

  /** Drop the `thread` field from this turn and every later one. */
  stopThreading(): void {
    if (this.threading) this.#anchor = { type: 'unthreaded' };
  }

  /**
   * Record a turn whose stream ended after `message_start` and before `message_stop`. The next turn starts a new
   * thread because the server holds either the whole reply or none of it. `completedBlocks` is how many content
   * blocks received `content_block_stop`.
   */
  recordPartialReply(snapshot: BetaMessage, completedBlocks: number): void {
    if (this.#dropsRefusedTurn(snapshot)) return;
    this.#storeTurn(partialReply(snapshot, completedBlocks), { partial: true });
    if (this.previousMessageId !== null) {
      this.#startNewThread('stream_ended_before_message_stop');
    }
  }

  /**
   * If nothing is staged and the history ends with a turn whose stream ended early (its messages, then its partial
   * reply if any content arrived), drop the partial reply and stage those messages again so the next turn re-sends
   * them.
   */
  #retryPartialTurn(): void {
    const tail = this.#stored.at(-1);
    if (this.#staged.length || !tail || (tail.reply && !tail.partial)) return;
    if (tail.reply) this.#stored.pop();
    let turnStart = this.#stored.length;
    while (turnStart > 0 && !this.#stored[turnStart - 1]!.reply) turnStart -= 1;
    this.#staged = this.#stored.splice(turnStart);
    this.#logger.info(
      `Re-sending the turn whose reply ended before \`message_stop\`: partial_reply_id=${
        tail.reply?.id ?? null
      }`,
    );
  }

  /**
   * Whether `reply` is a refusal on a thread, which records nothing of a turn the model refused, so the turn ends like
   * one that failed. The server may hold the refused turn all the same, so the next turn starts a new thread.
   */
  #dropsRefusedTurn(reply: BetaMessage): boolean {
    if (reply.stop_reason !== 'refusal' || this.#anchor.type === 'never_threaded') return false;
    if (this.previousMessageId !== null) this.#startNewThread('refusal');
    return true;
  }

  /** Move what was staged into the stored history, followed by `reply` if there is one. */
  #storeTurn(reply: BetaMessage | null, { partial }: { partial: boolean }): void {
    this.#stored.push(...this.#staged);
    this.#staged = [];
    if (reply) this.#stored.push({ param: toMessageParam(reply), reply, partial });
  }

  /**
   * Record `message` as the reply of `turn`, for the next turn to continue from. The server does not store a reply
   * that a fallback model wrote, so the turn after one starts a new thread.
   */
  recordReply(turn: Turn, message: BetaMessage): void {
    if (this.#dropsRefusedTurn(message)) return;
    this.#storeTurn(message, { partial: false });
    if (this.#anchor.type === 'create') {
      this.#fields = { ...this.#fields, ...turn.ownCreateOnly };
    }
    if (this.threading) {
      this.#anchor = {
        type: 'continue',
        previousMessageId: message.id,
        createdWith: turn.createOnly,
        replacesLostThread: this.#anchor.type === 'create' && this.#anchor.replacesLostThread,
      };
      if (message.usage.iterations?.some((iteration) => iteration.type === 'fallback_message')) {
        this.#startNewThread('fallback_message');
      }
    }
    if (message.container) {
      this.#adoptContainer(message.container.id);
    }
  }

  /**
   * Continue in the container `containerId` on later turns, unless the thread already names one: container-bound
   * server tools reject a follow-up request that omits the container the previous turn ran in.
   */
  #adoptContainer(containerId: string): void {
    const { container } = this.#fields;
    if (container == null) {
      this.#fields = { ...this.#fields, container: containerId };
    } else if (typeof container === 'object' && container.id == null) {
      this.#fields = { ...this.#fields, container: { ...container, id: containerId } };
    }
  }

  /**
   * The `create()` arguments of `turn` except `stream`: request fields, betas, the `thread` field with the delta or
   * full history, and request options.
   */
  buildCreateArguments(
    turn: Turn,
    options: BetaMessageThreadRequestOptions,
    { stream }: { stream: boolean },
  ): CreateArguments {
    this.#checkCreateOnly(turn.createOnly);
    const anchor = this.#anchor;
    // A `continue` sends only what the server lacks. With nothing staged after a `pause_turn` reply that is
    // nothing: the server holds the unfinished turn and resumes it from an empty `messages`.
    let stored = anchor.type === 'continue' ? [] : this.#stored.map((entry) => entry.param);
    // The caller set the cache markers of an answered message for the request that first sent it, and a thread that
    // sends them all again in one request can exceed what a request may hold. A stored message after the last reply
    // was never answered, so it goes out as given.
    if (anchor.type !== 'never_threaded') {
      const answered = this.#stored.map((entry) => entry.reply !== null).lastIndexOf(true) + 1;
      stored = stored.map((message, i) => (i < answered ? withoutCacheControl(message) : message));
    }
    const params: CreateArguments['params'] = {
      ...(turn.fields as Omit<MessageCreateParamsBase, 'messages'>),
      messages: [...stored, ...this.#staged.map((entry) => entry.param)],
    };
    if (this.threading && !params.betas?.includes(MESSAGE_THREADS_BETA)) {
      params.betas = [...(params.betas ?? []), MESSAGE_THREADS_BETA];
    }
    if (anchor.type === 'create') {
      params.thread = { type: 'create' };
    } else if (anchor.type === 'continue') {
      params.thread = { type: 'continue', previous_message_id: anchor.previousMessageId };
      for (const field of CREATE_ONLY_FIELDS) delete params[field];
    }
    return { params, options: this.#requestOptions(options, { stream }) };
  }

  /** Throws if the thread refuses a turn with the overrides `fields`, as that turn would before it is sent. */
  checkNextTurn(fields: BetaMessageThreadSendParams): void {
    this.#checkCreateOnly(createOnlyJSON({ ...this.#fields, ...definedEntries(fields) }));
  }

  /**
   * The server takes the create-only fields from the thread on a `continue` and never sees the turn's own, so a
   * `continue` that changes one throws.
   */
  #checkCreateOnly(createOnly: CreateOnlyJSON): void {
    if (this.#anchor.type !== 'continue') return;
    const { createdWith } = this.#anchor;
    const changed = CREATE_ONLY_FIELDS.filter((field) => createOnly[field] !== createdWith[field]);
    if (changed.length) {
      const names = changed.map((field) => `\`${field}\``).join(' and ');
      throw new AnthropicError(
        `Cannot change ${names} on a thread: the server keeps the \`system\` and \`tools\` the thread was created ` +
          'with. To change them, start a new thread from `thread.params`.' +
          (changed.includes('tools') ?
            ' To add or remove tools on this thread, send `tool_addition` or `tool_removal` blocks in a ' +
            '`system` message.'
          : ''),
      );
    }
  }

  #requestOptions(
    overrides: BetaMessageThreadRequestOptions,
    { stream }: { stream: boolean },
  ): RequestOptions {
    const options: RequestOptions = { ...this.options, ...definedEntries(overrides) };
    if (stream) {
      options.headers = buildHeaders([{ [STAINLESS_HELPER_METHOD_HEADER]: 'stream' }, options.headers]);
    }
    // Added last, apart from the options, which the caller can replace.
    if (this.#anchor.type !== 'never_threaded') {
      options.headers = buildHeaders([options.headers, helperHeader('message-thread')]);
    }
    if (this.threading) {
      options.headers = withThreadsBeta(options.headers);
    }
    return options;
  }
}

// A reply with one of these stop reasons is an unfinished turn: a request with no new message has the server go on
// from where it stopped (`compaction` hands the turn back before the model answers). On a thread that request is a
// `continue` with `messages: []`; without one it re-sends the full history, which ends in the unfinished reply.
const UNFINISHED_STOP_REASONS = ['pause_turn', 'compaction'] as const;

export type UnfinishedStopReason = (typeof UNFINISHED_STOP_REASONS)[number];

export function isUnfinishedStopReason(
  stopReason: BetaStopReason | null | undefined,
): stopReason is UnfinishedStopReason {
  return UNFINISHED_STOP_REASONS.some((unfinished) => unfinished === stopReason);
}

const MESSAGE_THREADS_BETA = 'message-threads-2026-08-12';

/** Request fields the server takes from the thread on a `continue` and rejects if the request repeats them. */
const CREATE_ONLY_FIELDS = ['system', 'tools'] as const;

type CreateOnlyFields = Pick<BetaMessageThreadFields, (typeof CREATE_ONLY_FIELDS)[number]>;

type CreateOnlyJSON = Record<keyof CreateOnlyFields, string | undefined>;

function createOnlyJSON(fields: BetaMessageThreadFields): CreateOnlyJSON {
  return { system: JSON.stringify(fields.system), tools: JSON.stringify(fields.tools) };
}

/**
 * `headers` with the threads beta appended to a caller-set `anthropic-beta` header, which would otherwise replace the
 * one `create()` builds from `betas`.
 */
function withThreadsBeta(headers: HeadersLike | undefined): HeadersLike | undefined {
  const callerBetas = buildHeaders([headers]).values.get('anthropic-beta');
  if (callerBetas === null) return headers;
  return buildHeaders([headers, { 'anthropic-beta': appendHeaderValue(callerBetas, MESSAGE_THREADS_BETA) }]);
}

/** The `error_code` of a rejection that a full replay under a new thread recovers from, if it is one. */
function replayReason(error: APIError): ReplayErrorCode | null {
  const errorCode = errorDetails(error)?.['error_code'];
  return REPLAY_ERROR_CODES.find((code) => code === errorCode) ?? null;
}

const REPLAY_ERROR_CODES = [
  'thread_not_found',
  'thread_already_continued',
  'thread_continue_in_flight',
] as const;

type ReplayErrorCode = (typeof REPLAY_ERROR_CODES)[number];

type NewThreadReason = ReplayErrorCode | 'stream_ended_before_message_stop' | 'refusal' | 'fallback_message';

/** The `unsupported` values of a `thread_unsupported_request` rejection, or `null` for any other error. */
function unsupportedFeatures(error: APIError): string[] | null {
  const details = errorDetails(error);
  if (details?.['error_code'] !== 'thread_unsupported_request') return null;
  const unsupported = details['unsupported'];
  return Array.isArray(unsupported) ? unsupported.map(String) : [];
}

/** The `error.details` object of the response body, or `null` when the body has none. */
function errorDetails(error: APIError): Record<string, unknown> | null {
  const body = error.error as { error?: { details?: unknown } } | undefined;
  const details = body?.error?.details;
  return isObj(details) ? details : null;
}

/** Throws if `fields` has a `thread`. The field types leave it out, which an untyped caller or a cast gets past. */
export function rejectThreadField(fields: object): void {
  if ('thread' in fields && fields.thread !== undefined) {
    throw new TypeError('`thread` cannot be set here. The message thread sets it for each request itself.');
  }
}

/** `object` without the keys whose value is `undefined`, so a spread of it leaves those keys as they were. */
export function definedEntries<T extends object>(object: T): T {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) as T;
}

/**
 * The part of a streamed reply worth keeping when the stream ended early, or `null` if nothing is. An unfinished block
 * stays only if it is `text`, because the `input` or `signature` of any other is incomplete.
 */
function partialReply(snapshot: BetaMessage, completedBlocks: number): BetaMessage | null {
  const content = snapshot.content.slice(0, completedBlocks);
  const unfinished = snapshot.content[completedBlocks];
  if (unfinished?.type === 'text' && unfinished.text) content.push(unfinished);
  return content.length ? { ...snapshot, content } : null;
}

/**
 * A copy of `value`, a message or a content block, without its `cache_control` and that of the blocks and tool in it.
 * Those are reached through the keys below only, so the value of any other key is carried over as it is.
 */
function withoutCacheControl<T>(value: T): T {
  if (!isObj(value)) return value;
  const { cache_control, ...copy }: Record<string, unknown> = value;
  for (const key of ['content', 'source', 'tool', 'definition', 'tool_references']) {
    const nested = copy[key];
    if (Array.isArray(nested)) copy[key] = nested.map(withoutCacheControl);
    else if (isObj(nested)) copy[key] = withoutCacheControl(nested);
  }
  return copy as T;
}

/** Whether `messages` begins with every message of `prefix`, in order. */
function startsWith(messages: readonly BetaMessageParam[], prefix: readonly BetaMessageParam[]): boolean {
  return prefix.length <= messages.length && prefix.every((message, i) => sameMessage(message, messages[i]!));
}

/** Whether every field of the two messages is equal. A reply given as it was received counts as its param. */
export function sameMessage(a: BetaMessageParam | BetaMessage, b: BetaMessageParam | BetaMessage): boolean {
  const [left, right] = [toMessageParam(a), toMessageParam(b)];
  const keys = Object.keys({ ...left, ...right }) as Array<keyof BetaMessageParam>;
  return keys.every(
    (key) => left[key] === right[key] || JSON.stringify(left[key]) === JSON.stringify(right[key]),
  );
}

function toMessageParam(message: BetaMessageParam | BetaMessage): BetaMessageParam {
  return 'id' in message ? { role: message.role, content: message.content } : message;
}

export function toMessageList(
  input: BetaMessageThreadInput | undefined,
): ReadonlyArray<BetaMessageParam | BetaMessage> {
  if (input === undefined) return [];
  return isReadonlyArray(input) ? input : [input];
}
