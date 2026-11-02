import { context, trace, SpanStatusCode, type Context } from '@opentelemetry/api';
import { BetaRunnableTool, runRunnableTool } from './BetaRunnableTool';
import { BetaRunnableToolset } from './BetaRunnableToolset';
import { isRunnableToolset, toolsetFamily } from '../internal/toolsets/family';
import { runToolsetMember, notExecutedText, toolsetResultBlock } from '../internal/toolsets/run';
import { quotedName } from '../internal/toolsets/sanitize';
import { ToolsetContractError } from '../internal/toolsets/errors';
import { Anthropic } from '../..';
import { AnthropicError } from '../../core/error';
import {
  BETA_CLIENT_TOOL_UNION_KEYS,
  BetaCompactionConfig,
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaOutputConfig,
  BetaRequestToolAdditionBlock,
  BetaRequestToolRemovalBlock,
  BetaStopReason,
  BetaToolResultBlockParam,
  BetaToolUnion,
  BetaToolUseBlock,
  BetaUserMessageParam,
  MessageCreateParams,
} from '../../resources/beta';
import type { MessageCreateParamsBase } from '../../resources/beta/messages/messages';
import { BetaMessageStream } from '../BetaMessageStream';
import { BetaToolRunnerStream } from '../internal/BetaToolRunnerStream';
import { guardTracing, setErrorStatus } from '../../internal/tracing';
import { startToolRunnerSpan, withToolUseSpan } from '../internal/tracing';
import { RequestOptions } from '../../internal/request-options';
import { type HeadersLike, buildHeaders } from '../../internal/headers';
import { promiseWithResolvers } from '../../internal/utils/promise';
import { checkNever } from '../../internal/utils/values';
import { loggerFor } from '../../internal/utils/log';
import {
  collectStainlessHelpers,
  helperHeader,
  SDK_HELPER_SYMBOL,
  STAINLESS_HELPER_HEADER,
  wasCreatedByStainlessHelper,
} from '../../internal/stainless-helper-header';
import type { BetaMessageThread } from '../threads/BetaMessageThread';
import {
  type ThreadState,
  definedEntries,
  isUnfinishedStopReason,
  sameMessage,
} from '../internal/threads/ThreadState';
import { splitToolRunnerParams } from '../internal/threads/tool-runner-params';
import type { BetaMessageThreadSendParams } from '../threads/params';
import type { Simplify } from '../internal/types';

const USE_A_NEW_RUNNER =
  "a tool runner's toolsets come only from its tools param; change them with setMessagesParams(), or build a new runner";
const REMOVE_WITH_A_NEW_RUNNER =
  "a tool runner's toolsets come only from its tools param; remove it there with setMessagesParams(), or build a new runner without it";

/**
 * A ToolRunner handles the automatic conversation loop between the assistant and tools.
 *
 * A ToolRunner is an async iterable that yields either BetaMessage or BetaMessageStream objects
 * depending on the streaming configuration. It runs over a `BetaMessageThread`, which holds the
 * conversation and sends each turn. With `runToolsEagerly` it starts each tool call while the reply is
 * still streaming, unless `deferToolCall()` holds the call.
 */
export class BetaToolRunner<Stream extends boolean> {
  /** Whether the async iterator has been consumed */
  #consumed = false;
  /** Whether parameters have been mutated since the last API call */
  #mutated = false;
  /** The thread that holds the conversation and sends each turn */
  #thread: BetaMessageThread<any>;
  /** The runner's own settings; every other param is the thread's */
  #settings: BetaToolRunnerSettings;
  #options: BetaToolRunnerRequestOptions;
  /** The helper telemetry header of every turn: the runner's tag and the tags of its tools and messages */
  #helperHeader: HeadersLike;
  /**
   * `params.messages` while the caller handles a reply: the messages that were sent and what the caller has made of them
   * since, without the reply. The thread takes them after the loop body if the caller changed anything.
   */
  #messagesWithoutReply?: BetaMessageParam[] | undefined;
  /** Promise for the last message received from the assistant */
  #message?: Promise<BetaMessage> | undefined;
  /** The stream of the request in progress, when streaming */
  #stream?: BetaMessageStream | undefined;
  /** Cached tool response to avoid redundant executions */
  #toolResponse?: Promise<BetaUserMessageParam | null> | undefined;
  /** Promise resolvers for waiting on completion */
  #completion: {
    promise: Promise<BetaMessage>;
    resolve: (value: BetaMessage) => void;
    reject: (reason?: any) => void;
  };
  /** Number of iterations (API requests) made so far */
  #iterationCount = 0;
  /**
   * The OpenTelemetry `Context` of the loop that is running: the one that was active when the loop
   * started, with the tool runner span set as the active span.
   */
  #toolRunnerOtelContext: Context | undefined;
  /** A compaction scheduled with `compactBeforeNextTurn()`, in flight until its response has been handled */
  #compaction: Compaction = { status: 'idle' };
  /** The tool calls of the current reply that are held or have started, by `tool_use` id. See `runToolsEagerly`. */
  #calls: Map<string, ToolCallState> | undefined;
  /** The last turn's stop reason, or `null` once the history has been replaced since */
  #lastStopReason: BetaStopReason | null = null;
  /**
   * `addTools()` / `removeTools()` never edit `params.tools`, because a changed `tools` misses the prompt
   * cache, so what they change about which tool runs under a name is kept here instead: the runnable tool
   * added under that name, or `null` once the name was removed or taken by a raw definition. A tool call is
   * looked up here first, and in `params.tools` only when its name has no entry.
   */
  #toolOverrides = new Map<string, BetaRunnableTool<any> | null>();
  /** Changes queued by `addTools()` / `removeTools()`, in call order, for the next request */
  #pendingToolChanges: PendingToolChange[] = [];

  /** Run the loop on `client` with `params`, the same as `client.beta.messages.toolRunner(params, options)`. */
  constructor(client: Anthropic, params: BetaToolRunnerParams, options?: BetaToolRunnerRequestOptions);
  /** Run the loop over `thread` with the runner's own `settings`, like `thread.toolRunner(settings, options)`. */
  constructor(
    thread: BetaMessageThread<any>,
    settings: BetaToolRunnerSettings,
    options?: BetaToolRunnerRequestOptions,
  );
  constructor(
    clientOrThread: Anthropic | BetaMessageThread<any>,
    paramsOrSettings: BetaToolRunnerParams | BetaToolRunnerSettings,
    options?: BetaToolRunnerRequestOptions,
  ) {
    const { thread, settings } =
      '_state' in clientOrThread ?
        { thread: clientOrThread, settings: paramsOrSettings }
      : clientOrThread.beta.messages._toolRunnerThread(paramsOrSettings as BetaToolRunnerParams);
    rejectCompactionParam(thread._state.params);
    rejectRunToolsEagerlyWithoutStream(settings);
    this.#thread = thread;
    this.#settings = definedEntries(settings);

    const { tools, messages } = thread._state.params;
    const collected = collectStainlessHelpers(tools, messages);
    if (!('_state' in clientOrThread)) {
      // A copy, so that a message the caller edits later goes out as it was given. It comes after the helper marks are
      // collected, because it drops symbol-keyed properties. Not structuredClone(): it throws on a function, and a
      // runnable tool written by value into a `tool_addition` block has `run`.
      thread._state.setMessages(JSON.parse(JSON.stringify(withToolDefinitions(messages))));
    }
    this.#options = { ...options };
    this.#helperHeader = buildHeaders([
      helperHeader('BetaToolRunner'),
      collected.length ? { [STAINLESS_HELPER_HEADER]: collected.join(', ') } : undefined,
    ]);
    this.#completion = promiseWithResolvers();
  }

  /**
   * Runs `fn` with the tool runner span current. A generator resumes in the context of whoever
   * calls `next()`, and a `yield` cannot sit in a `context.with()` callback, so each stretch of
   * runner code between two yields enters the context again.
   */
  #withToolRunnerSpan<T>(fn: () => T): T {
    if (!this.#toolRunnerOtelContext) {
      return fn();
    }
    return context.with(this.#toolRunnerOtelContext, fn);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<
    Stream extends true ? BetaMessageStream
    : Stream extends false ? BetaMessage
    : BetaMessage | BetaMessageStream
  > {
    if (this.#consumed) {
      throw new AnthropicError('Cannot iterate over a consumed stream');
    }

    this.#consumed = true;
    this.#mutated = true;
    this.#toolResponse = undefined;

    const toolRunnerSpan = guardTracing(this.#thread._client, () =>
      startToolRunnerSpan(this.#thread._client, this.params, this.#options.openTelemetry?.conversationId),
    );
    this.#toolRunnerOtelContext = toolRunnerSpan && trace.setSpan(context.active(), toolRunnerSpan);

    try {
      while (true) {
        try {
          if (this.#settings.max_iterations && this.#iterationCount >= this.#settings.max_iterations) {
            break;
          }

          this.#flushPendingToolChanges();

          // The API can't compact a conversation that ends mid-turn, so a paused turn is resumed first.
          if (
            this.#compaction.status === 'scheduled' &&
            determineNextStepFromStopReason(this.#lastStopReason) !== 'resume'
          ) {
            yield* this.#compact(this.#compaction.config);
            continue;
          }

          this.#mutated = false;
          this.#toolResponse = undefined;
          this.#iterationCount++;
          this.#message = undefined;

          yield* this.#send(this.#thread);
          const callerMessages = this.#messagesWithoutReply!;
          this.#messagesWithoutReply = undefined;

          const next = await this.#withToolRunnerSpan(async () => {
            let toAnswer: BetaMessageParam | undefined;
            if (!this.#mutated) {
              const message = await this.#message!;
              const nextStep = determineNextStepFromStopReason(message.stop_reason);
              this.#lastStopReason = message.stop_reason;
              if (nextStep === 'stop') {
                return 'stop';
              }
              // On "resume" there is nothing to push: the thread already holds the unfinished reply.
              if (nextStep === 'resume') {
                return 'continue';
              }
              toAnswer = lastAssistantMessage(this.#thread.messages);
            } else {
              // The caller has taken over the history, so the last response no longer says how it ends.
              this.#lastStopReason = null;
              // The thread takes a new history once the turn has ended.
              this.#stream?.abort();
              // Checked first, because a history without the reply starts a new thread, which would take the change.
              this.#thread._state.checkNextTurn(turnParams(this.#thread));
              this.#thread._state.setMessages(callerMessages);
              toAnswer = callerMessages.at(-1);
            }

            // No tool runs for a turn the thread refuses.
            if (hasToolUse(toAnswer)) this.#thread._state.checkNextTurn(turnParams(this.#thread));
            const toolMessage = await this.#generateToolResponse(
              toAnswer,
              this.#options.signal,
              this.#toolRunnerOtelContext,
            );
            if (toolMessage) {
              // The API takes tool results only right after the calls they answer, ahead of what the caller added since.
              const history = this.#thread.messages;
              const answered = history.map((message) => message.role).lastIndexOf('assistant') + 1;
              this.#thread._state.setMessages([
                ...history.slice(0, answered),
                toolMessage,
                ...history.slice(answered),
              ]);
            } else if (!this.#mutated && !this.#thread._state.hasTurnToSend) {
              return 'stop';
            }
            return 'continue';
          });
          if (next === 'stop') {
            yield* this.#compactAfterFinalTurn();
            break;
          }
        } finally {
          this.#stream?.abort();
          this.#stream = undefined;
        }
      }

      await this.#startedCallsSettled();
      if (!this.#message) {
        throw new AnthropicError('ToolRunner concluded without a message from the server');
      }

      this.#completion.resolve(await this.#message);
      guardTracing(this.#thread._client, () => toolRunnerSpan?.setStatus({ code: SpanStatusCode.OK }));
    } catch (error) {
      if (toolRunnerSpan) {
        guardTracing(this.#thread._client, () => setErrorStatus(toolRunnerSpan, error));
      }
      this.#consumed = false;
      this.#messagesWithoutReply = undefined;
      // Silence unhandled promise errors
      this.#completion.promise.catch(() => {});
      this.#completion.reject(error);
      this.#completion = promiseWithResolvers();
      throw error;
    } finally {
      // Ends with no status when the application closed the iterator: a cancellation.
      guardTracing(this.#thread._client, () => toolRunnerSpan?.end());
      this.#toolRunnerOtelContext = undefined;
    }
  }

  /**
   * Sends the next turn of `thread` and yields its message, or its stream when streaming. `#message` and `#stream` are set
   * before the yield, so they are there while the caller handles the item; the loop aborts the stream at the
   * end of the iteration.
   */
  async *#send(thread: BetaMessageThread<any>): AsyncGenerator<BetaToolRunnerItem<Stream>, void, undefined> {
    await this.#startedCallsSettled();
    this.#calls = undefined;
    // A turn can't override the history, so a `tool_addition` block holding a runnable tool is rewritten in the thread's
    // history to hold only the tool's API fields.
    const messages = thread.messages;
    if (messages.some(addsRunnableTool)) {
      this.#withToolRunnerSpan(() => thread._state.setMessages(withToolDefinitions(messages)));
    }
    // A thread takes the `tools` of the turn that creates it as its own unless they are set during the turn, so the
    // runnable tools are set again.
    const { tools } = thread._state.params;
    if (this.#settings.stream) {
      this.#stream = this.#withToolRunnerSpan(() =>
        this.#settings.runToolsEagerly ?
          this.#streamThatStartsTools(thread)
        : thread.stream(undefined, turnParams(thread), this.#turnOptions(thread)),
      );
      if (tools) thread.update({ tools });
      if (thread === this.#thread) this.#messagesWithoutReply = thread.messages;
      this.#message = this.#stream.finalMessage();
      // Make sure that this promise doesn't throw before we get the option to do something about it.
      // Error will be caught when we call await this.#message ultimately
      this.#message.catch(() => {});
      yield this.#stream as any;
    } else {
      this.#message = this.#withToolRunnerSpan(() =>
        thread.send(undefined, turnParams(thread), this.#turnOptions(thread)),
      );
      if (tools) thread.update({ tools });
      if (thread === this.#thread) this.#messagesWithoutReply = thread.messages;
      yield this.#message as any;
    }
  }

  /**
   * The request options of a turn of `thread`. A turn's `headers` replace the thread's, so the helper header is added to
   * whichever of the two the turn goes out with.
   */
  #turnOptions(thread: BetaMessageThread<any>): BetaToolRunnerRequestOptions {
    const { headers = thread._state.options.headers } = this.#options;
    return { ...this.#options, headers: buildHeaders([this.#helperHeader, headers]) };
  }

  /** Sends the turn as a stream that starts each tool call while the reply streams. See `runToolsEagerly`. */
  #streamThatStartsTools(thread: BetaMessageThread<any>): BetaToolRunnerStream {
    const calls = new Map<string, ToolCallState>();
    this.#calls = calls;
    // A toolset runs its calls one at a time, in the model's order. So a toolset's call starts here only while the
    // toolset is idle, and once one of its calls waits for the reply or fails, its later calls wait for the reply too.
    const toolsets = new Map<string, 'running' | 'waiting'>();
    const onToolCall = (toolUse: BetaToolUseBlock) => {
      // Held, or started by `generateToolResponse()` before a reader that is behind got to the call.
      const known = calls.has(toolUse.id);
      // A call named after a toolset is a toolset call with malformed actions, which `generateToolResponse()` answers.
      const malformed = !toolUse.toolset_name && this.#toolsetFamilies().has(toolUse.name);
      const family = malformed ? toolUse.name : toolUse.toolset_name;
      if (family) {
        if (known || malformed || toolsets.has(family)) {
          toolsets.set(family, 'waiting');
          return;
        }
        toolsets.set(family, 'running');
        const result = runToolsetCall(
          this.#toolsetParams(),
          family,
          toolUse,
          this.#options,
          this.#thread._client,
          this.#toolRunnerOtelContext,
        );
        calls.set(toolUse.id, { status: 'started', result });
        result.then(
          ({ is_error }) => {
            if (is_error || toolsets.get(family) === 'waiting') toolsets.set(family, 'waiting');
            else toolsets.delete(family);
          },
          () => toolsets.set(family, 'waiting'),
        );
        return;
      }
      if (known) {
        return;
      }
      // The call looks its tool up now, so a later `addTools()` or `removeTools()` doesn't change it.
      const result = runToolCall(
        this.#runnableTools(),
        this.#availableToolNames(),
        toolUse,
        this.#options,
        this.#thread._client,
        this.#toolRunnerOtelContext,
      );
      // Marks a rejection as handled until the results are collected.
      result.catch(() => {});
      calls.set(toolUse.id, { status: 'started', result });
    };
    const stream = new BetaToolRunnerStream(
      thread._state.params as MessageCreateParamsBase,
      onToolCall,
      thread._client,
    );
    thread._stream(stream, undefined, turnParams(thread), this.#turnOptions(thread));
    return stream;
  }

  /** Waits for the calls of the last streamed reply that have started, whether or not their results were sent. */
  async #startedCallsSettled(): Promise<void> {
    const started = [...(this.#calls?.values() ?? [])].filter((call) => call.status === 'started');
    await Promise.allSettled(started.map((call) => call.result));
  }

  async *#compact(
    compaction: BetaCompactionConfig,
  ): AsyncGenerator<BetaToolRunnerItem<Stream>, void, undefined> {
    rejectCompactionEdit(this.params);
    this.#compaction = { status: 'in_flight' };
    this.#toolResponse = undefined;
    const lastMessage = this.#message;
    const thread = this.#compactionThread(compaction);
    const summarized = this.#thread.messages.length;

    try {
      yield* this.#send(thread);
      const message = await this.#message!;
      if (message.content.some((block) => block.type === 'compaction' && block.content)) {
        this.#recordRemovalsFromHistory();
        // The response has to be sent back as it came, first, replacing the messages it summarizes.
        const response: BetaMessageParam = { role: message.role, content: message.content };
        // Appending a reply the thread already holds is a no-op, so a copy the caller appended is left out.
        const appended = this.#thread.messages.slice(summarized).filter((m) => !sameMessage(m, response));
        this.#thread._state.setMessages([response, ...appended]);
      } else {
        loggerFor(this.#thread._client).warn(
          'Compaction produced no summary; keeping the conversation as it is.',
        );
        // If the run ends here, `done()` resolves to the last real message rather than this response.
        this.#message = lastMessage;
      }
    } finally {
      this.#compaction = { status: 'idle' };
      // The request after a compaction the server could not thread goes without a thread from the start.
      if (!thread._state.threading) this.#thread._state.stopThreading();
    }
  }

  /**
   * The thread the compaction request goes out on: the whole conversation and the thread's fields and request
   * options, with `compaction` added and what `withoutCompactionIncompatibleParams()` removes left out. It is a
   * thread of its own because a turn on the runner's thread can't leave a field out.
   */
  #compactionThread(compaction: BetaCompactionConfig): BetaMessageThread<any> {
    const { messages, ...fields } = withoutCompactionIncompatibleParams(this.#thread._state.params);
    const thread = this.#thread.fork();
    thread._state = this.#thread._state.fork({ ...fields, compaction });
    return thread;
  }

  /** The tools the runner runs, by name: the runnable tools in `params.tools` with the overrides applied */
  #runnableTools(): Map<string, BetaRunnableTool<any>> {
    const runnable = new Map<string, BetaRunnableTool<any>>();
    for (const tool of this.#thread._state.params.tools ?? []) {
      if ('run' in tool && 'name' in tool) {
        runnable.set(tool.name, tool);
      }
    }
    for (const [name, tool] of this.#toolOverrides) {
      if (tool) {
        runnable.set(name, tool);
      } else {
        runnable.delete(name);
      }
    }
    return runnable;
  }

  /**
   * The names of the runnable tools the model can still call. The queued changes are folded in too:
   * they apply from when they are made, not from when they are sent.
   */
  #availableToolNames(): Set<string> {
    const available = new Set(this.#runnableTools().keys());

    for (const message of [...this.params.messages, this.#pendingToolChangesMessage()]) {
      if (!Array.isArray(message.content)) {
        continue;
      }
      for (const block of message.content) {
        if (message.role === 'system') {
          applyToolChange(block, available);
        } else if (message.role === 'assistant' && block.type === 'compaction') {
          // A compaction block's tool_changes stand in for the system messages of the turns it summarized.
          for (const change of block.tool_changes ?? []) {
            applyToolChange(change, available);
          }
        }
      }
    }
    return available;
  }

  /** Records in the overrides, which outlive the history, every runnable tool the history reports removed */
  #recordRemovalsFromHistory(): void {
    const available = this.#availableToolNames();
    for (const name of this.#runnableTools().keys()) {
      if (!available.has(name)) {
        this.#toolOverrides.set(name, null);
      }
    }
  }

  async *#compactAfterFinalTurn(): AsyncGenerator<BetaToolRunnerItem<Stream>, void, undefined> {
    if (this.#compaction.status !== 'scheduled') {
      return;
    }
    if (hasToolUse(this.#thread.messages.at(-1))) {
      // A turn that was cut short can end with tool calls that are never run, and the API can't
      // compact a conversation whose last turn has an unanswered tool call.
      loggerFor(this.#thread._client).warn(
        'The pending compaction was skipped because the last turn ended with tool calls that were not run. ' +
          'Call `compactBeforeNextTurn()` again if you continue the conversation.',
      );
      this.#compaction = { status: 'idle' };
      return;
    }
    yield* this.#compact(this.#compaction.config);
  }

  /**
   * Update the parameters for the next API call. This invalidates any cached tool responses. With
   * `runToolsEagerly`, a tool call of the reply that has started doesn't run again.
   *
   * The new params replace the current ones, so a param they leave out is gone: start from `runner.params` to keep the
   * rest. `system` and `tools` cannot change on a message thread: use {@link addTools} and {@link removeTools}, or create
   * the runner with `thread: false`.
   *
   * While you handle a reply, `params.messages` doesn't hold it yet. After a call in the loop body the runner doesn't
   * add the reply or its tool results: the next request goes out with your params, and the runner runs tool calls only
   * if your `messages` end in an assistant message that makes them.
   *
   * @param paramsOrMutator - Either new parameters or a function to mutate existing parameters
   *
   * @example
   * // Direct parameter update
   * runner.setMessagesParams({
   *   ...runner.params,
   *   max_tokens: 500,
   * });
   *
   * @example
   * // Using a mutator function
   * runner.setMessagesParams((params) => ({
   *   ...params,
   *   max_tokens: 100,
   * }));
   */
  setMessagesParams(params: BetaToolRunnerParams): void;
  setMessagesParams(mutator: (prevParams: BetaToolRunnerParams) => BetaToolRunnerParams): void;
  setMessagesParams(
    paramsOrMutator: BetaToolRunnerParams | ((prevParams: BetaToolRunnerParams) => BetaToolRunnerParams),
  ) {
    const params = typeof paramsOrMutator === 'function' ? paramsOrMutator(this.params) : paramsOrMutator;
    rejectCompactionParam(params);
    if (this.#compaction.status !== 'idle') {
      rejectCompactionEdit(params);
    }
    // `params` holds a new `messages` array on every read, so an unchanged history is told by value.
    if (this.#compaction.status === 'in_flight' && !sameMessages(params.messages, this.#thread.messages)) {
      throw new AnthropicError(MESSAGES_CHANGED_WHILE_COMPACTING);
    }
    // `thread` only chooses threading when the runner is created, so a later `false` is ignored.
    const { settings, threadParams } = splitToolRunnerParams(params);
    rejectRunToolsEagerlyWithoutStream(settings);
    this.#settings = definedEntries(settings);
    if (this.#messagesWithoutReply) {
      this.#messagesWithoutReply = threadParams.messages;
      this.#thread._state.setParams({ ...threadParams, messages: this.#thread.messages });
    } else {
      this.#thread._state.setParams(threadParams);
    }
    this.#mutated = true;
    // Invalidate cached tool response since parameters changed
    this.#toolResponse = undefined;
  }

  /**
   * Update the request options for future API calls.
   *
   * @param optionsOrMutator - Either new options or a function to mutate existing options
   *
   * @example
   * // Direct options update
   * runner.setRequestOptions({
   *   signal: controller.signal,
   * });
   *
   * @example
   * // Using a mutator function
   * runner.setRequestOptions((prevOptions) => ({
   *   ...prevOptions,
   *   signal: controller.signal,
   * }));
   */
  setRequestOptions(options: BetaToolRunnerRequestOptions): void;
  setRequestOptions(
    mutator: (prevOptions: BetaToolRunnerRequestOptions) => BetaToolRunnerRequestOptions,
  ): void;
  setRequestOptions(
    optionsOrMutator:
      | BetaToolRunnerRequestOptions
      | ((prevOptions: BetaToolRunnerRequestOptions) => BetaToolRunnerRequestOptions),
  ) {
    if (typeof optionsOrMutator === 'function') {
      this.#options = optionsOrMutator(this.#options);
    } else {
      this.#options = { ...this.#options, ...optionsOrMutator };
    }
  }

  /**
   * Get the tool response for the last message from the assistant.
   * Avoids redundant tool executions by caching results. With `runToolsEagerly`, it reuses the calls of
   * the reply that have started and runs the rest, including the ones `deferToolCall()` is holding, so that no
   * call runs twice.
   *
   * @returns A promise that resolves to a BetaUserMessageParam containing tool results, or null if no tools need to be executed
   *
   * @example
   * const toolResponse = await runner.generateToolResponse();
   * if (toolResponse) {
   *   console.log('Tool results:', toolResponse.content);
   * }
   */
  async generateToolResponse(signal: AbortSignal | null | undefined = this.#options.signal) {
    // Read before the first `await`: a context manager that does not follow promises has lost the
    // caller's context after it. Only a tool span has a use for it.
    const callerOtelContext = this.#thread._client._tracer ? context.active() : undefined;
    const message = (await this.#message) ?? this.#thread.messages.at(-1);
    if (!message) {
      return null;
    }
    return this.#generateToolResponse(message, signal, callerOtelContext);
  }

  async #generateToolResponse(
    lastMessage: BetaMessage | BetaMessageParam | undefined,
    signal: AbortSignal | null | undefined,
    toolOtelContext: Context | undefined,
  ) {
    if (this.#toolResponse !== undefined) {
      return this.#toolResponse;
    }
    this.#toolResponse = generateToolResponse(
      this.#toolsetParams(),
      this.#runnableTools(),
      this.#availableToolNames(),
      lastMessage,
      { ...this.#options, signal },
      this.#calls,
      this.#thread._client,
      toolOtelContext,
    );
    return this.#toolResponse;
  }

  /**
   * Hold a tool call of the current reply until you are done with the reply, which is when it runs without
   * streaming: at the end of the loop body, or when you call `generateToolResponse()`.
   *
   * With `runToolsEagerly` the runner otherwise starts each call while the reply streams, as soon as
   * the model has moved on from it: when the next block starts, or the reply stops with `tool_use`. A call
   * never starts before your stream listeners and any `for await` over the stream have handled that event, so
   * you can call this from either once you have seen the call. The other calls of the reply still start early,
   * except the later calls of the same toolset, which a toolset runs in order.
   * It does nothing for a call that has started, outside the loop body, and without `runToolsEagerly`.
   *
   * @param toolUse - The `tool_use` block of the call, or its id
   *
   * @example
   * for await (const stream of runner) {
   *   stream.on('contentBlock', (block) => {
   *     if (block.type === 'tool_use' && block.name === 'delete_file') {
   *       runner.deferToolCall(block);
   *     }
   *   });
   *   await stream.finalMessage();
   *   // No `delete_file` call has started yet.
   * }
   */
  deferToolCall(toolUse: BetaToolUseBlock | string): void {
    const id = typeof toolUse === 'string' ? toolUse : toolUse.id;
    if (this.#calls && !this.#calls.has(id)) {
      this.#calls.set(id, { status: 'held' });
    }
  }

  /**
   * The tool calls of the current reply that `deferToolCall()` is holding, in the model's order, as their
   * `tool_use` blocks. A call is in the list once its block has finished streaming, so read the list when you
   * are done with the stream. A call that has started is not in it. It is empty without
   * `runToolsEagerly`.
   *
   * Held calls are listed whatever the reply's `stop_reason`, because `generateToolResponse()` runs them
   * whatever it is. After `max_tokens` the input of the last call can be cut off.
   *
   * @example
   * for await (const stream of runner) {
   *   stream.on('contentBlock', (block) => {
   *     if (block.type === 'tool_use' && block.name === 'delete_file') {
   *       runner.deferToolCall(block);
   *     }
   *   });
   *   await stream.finalMessage();
   *
   *   const held = runner.deferredToolCalls;
   *   if (held.length > 0 && !(await confirm(held))) break;
   * }
   */
  get deferredToolCalls(): BetaToolUseBlock[] {
    const stream = this.#stream;
    const calls = this.#calls;
    if (!(stream instanceof BetaToolRunnerStream) || !calls) {
      return [];
    }
    return stream.toolCalls.filter((toolUse) => calls.get(toolUse.id)?.status === 'held');
  }

  /**
   * Wait for the async iterator to complete. This works even if the async iterator hasn't yet started, and
   * will wait for an instance to start and go to completion.
   *
   * @returns A promise that resolves to the final BetaMessage when the iterator completes
   *
   * @example
   * // Start consuming the iterator
   * for await (const message of runner) {
   *   console.log('Message:', message.content);
   * }
   *
   * // Meanwhile, wait for completion from another part of the code
   * const finalMessage = await runner.done();
   * console.log('Final response:', finalMessage.content);
   */
  done(): Promise<BetaMessage> {
    return this.#completion.promise;
  }

  /**
   * Returns a promise indicating that the stream is done. Unlike .done(), this will eagerly read the stream:
   * * If the iterator has not been consumed, consume the entire iterator and return the final message from the
   * assistant.
   * * If the iterator has been consumed, waits for it to complete and returns the final message.
   *
   * @returns A promise that resolves to the final BetaMessage from the conversation
   * @throws {AnthropicError} If no messages were processed during the conversation
   *
   * @example
   * const finalMessage = await runner.runUntilDone();
   * console.log('Final response:', finalMessage.content);
   */
  async runUntilDone(): Promise<BetaMessage> {
    // If not yet consumed, start consuming and wait for completion
    if (!this.#consumed) {
      for await (const _ of this) {
        // Iterator naturally populates this.#message
      }
    }

    // If consumed but not completed, wait for completion
    return this.done();
  }

  /**
   * Get the current parameters being used by the ToolRunner.
   *
   * @returns A readonly view of the current ToolRunnerParams
   *
   * @example
   * const currentParams = runner.params;
   * console.log('Current model:', currentParams.model);
   * console.log('Message count:', currentParams.messages.length);
   */
  get params(): Readonly<BetaToolRunnerParams> {
    // `tools` is left out when the thread has none: an empty list is another value of `tools` than none, so
    // writing these params back would change the `tools` of the thread.
    return {
      ...this.#thread._state.params,
      ...(this.#messagesWithoutReply && { messages: [...this.#messagesWithoutReply] }),
      ...this.#settings,
    } as BetaToolRunnerParams;
  }

  /**
   * Add one or more messages to the conversation history.
   *
   * @param messages - One or more BetaMessageParam objects to add to the conversation
   *
   * @example
   * runner.pushMessages(
   *   { role: 'user', content: 'Also, what about the weather in NYC?' }
   * );
   *
   * @example
   * // Adding multiple messages
   * runner.pushMessages(
   *   { role: 'user', content: 'What about NYC?' },
   *   { role: 'user', content: 'And Boston?' }
   * );
   */
  pushMessages(...messages: BetaMessageParam[]) {
    this.setMessagesParams((params) => ({
      ...params,
      messages: [...params.messages, ...messages],
    }));
  }

  /**
   * Schedule a compaction of the conversation. Once the current turn has finished, including any tool
   * calls, the runner requests a summary and replaces the message history with the compaction response,
   * which is yielded like any other message. Requires the `compact-2026-09-04` beta.
   *
   * @param compaction - The config to send, as `messages.create()` takes it. Defaults to `{ type: 'summarize' }`
   *
   * @example
   * for await (const message of runner) {
   *   if (message.usage.input_tokens > 100_000) {
   *     runner.compactBeforeNextTurn();
   *   }
   * }
   */
  compactBeforeNextTurn(compaction?: BetaCompactionConfig): void {
    if (this.#compaction.status === 'in_flight') {
      return;
    }
    rejectCompactionEdit(this.params);
    this.#compaction = { status: 'scheduled', config: compaction ?? { type: 'summarize' } };
  }

  /**
   * Give the model more tools without changing `params.tools`, which would miss the prompt cache.
   *
   * Each tool's whole definition is sent in a `tool_addition` block with the next request, and a
   * runnable tool replaces a runnable tool of the same name straight away, even for a call already in
   * the message being handled. A call that started while the reply streamed keeps the old one. A raw definition
   * is only sent: the runner never runs it, and stops running a tool of the same name. Passing a runnable toolset,
   * or a raw definition of a toolset the runner has, throws `ToolsetContractError` and adds nothing: a runner's
   * toolsets come only from `params.tools`. A tool named like one of its toolsets is left to the API, which rejects
   * it with the next request. Requires the `inline-tools-2026-09-15` beta, which the runner does not add for you.
   *
   * @param tools - Runnable tools (for example from `betaZodTool()`) or raw tool definitions
   *
   * @example
   * runner.addTools(queryDatabaseTool);
   */
  addTools(...tools: (BetaRunnableTool<any> | BetaToolUnion)[]): void {
    const families = this.#toolsetFamilies();
    for (const tool of tools) {
      if (isRunnableToolset(tool)) {
        throw new ToolsetContractError(
          `addTools() can't add the '${quotedName(toolsetFamily(tool))}' toolset: ${USE_A_NEW_RUNNER}`,
        );
      }
      // The API treats a definition of one of the runner's families as replacing that toolset, which would leave the
      // model with a toolset the runner doesn't run.
      const family = definitionFamily(tool);
      if (families.has(family)) {
        throw new ToolsetContractError(
          `addTools() can't replace the '${quotedName(family)}' toolset: ${USE_A_NEW_RUNNER}`,
        );
      }
    }
    for (const tool of tools) {
      // A definition without a `name` (an `mcp_toolset`) is nothing the runner runs or stops running.
      if ('name' in tool) {
        this.#toolOverrides.set(tool.name, 'run' in tool ? tool : null);
      }
      this.#pendingToolChanges.push({ type: 'addition', tool });
    }
  }

  /**
   * Take tools away from the model without changing `params.tools`, which would miss the prompt cache.
   *
   * The tools stop being run straight away: a call to one of them, even one in the message being
   * handled, gets the same "not found" error result as a call to an unknown tool. A call that started while the
   * reply streamed finishes as usual. The model is told in a `tool_removal` block with the next request. Use
   * {@link addTools} to bring a tool back. Passing the name of one of the runner's toolsets throws
   * `ToolsetContractError` and removes nothing. Requires the `inline-tools-2026-09-15` beta, which the runner does
   * not add for you.
   *
   * @param tools - The tools to remove, or their names
   *
   * @example
   * runner.removeTools('query_database');
   */
  removeTools(...tools: (BetaRunnableTool<any> | string)[]): void {
    const families = this.#toolsetFamilies();
    for (const tool of tools) {
      // A toolset's name is always its own: the API rejects any other tool of that name.
      const name = typeof tool === 'string' ? tool : tool.name;
      if (families.has(name)) {
        throw new ToolsetContractError(
          `removeTools() can't remove the '${quotedName(name)}' toolset: ${REMOVE_WITH_A_NEW_RUNNER}`,
        );
      }
    }
    for (const tool of tools) {
      const name = typeof tool === 'string' ? tool : tool.name;
      this.#toolOverrides.set(name, null);
      this.#pendingToolChanges.push({ type: 'removal', name });
    }
  }

  #toolsetFamilies(): Set<string> {
    return new Set(this.#toolsetParams().tools.filter(isRunnableToolset).map(toolsetFamily));
  }

  /**
   * The runner's params with the thread's current tools as `tools` (an empty list when it has none), because the
   * toolset code reads `params.tools` without a guard.
   */
  #toolsetParams(): BetaToolRunnerParams {
    return { ...this.params, tools: this.#thread._state.params.tools ?? [] };
  }

  #flushPendingToolChanges() {
    // A paused turn has to go back as the last message, so the changes wait for the request after it.
    if (this.#lastStopReason === 'pause_turn' || this.#pendingToolChanges.length === 0) {
      return;
    }
    // Staged on the thread directly: this runner's pushMessages() is the caller's, and marks the params as changed by them.
    this.#thread.append(this.#pendingToolChangesMessage());
    this.#pendingToolChanges = [];
  }

  /** The queued changes as the system message that carries them */
  #pendingToolChangesMessage(): BetaMessageParam {
    const content: Array<BetaRequestToolAdditionBlock | BetaRequestToolRemovalBlock> = [];
    for (const change of this.#pendingToolChanges) {
      if (change.type === 'removal') {
        content.push({ type: 'tool_removal', tool: { type: 'tool_reference', name: change.name } });
        continue;
      }
      const definition = toolDefinition(change.tool);
      content.push({ type: 'tool_addition', tool: { type: 'tool_definition', definition } });
    }
    return { role: 'system', content };
  }

  /**
   * Makes the ToolRunner directly awaitable, equivalent to calling .runUntilDone()
   * This allows using `await runner` instead of `await runner.runUntilDone()`
   */
  then<TResult1 = BetaMessage, TResult2 = never>(
    onfulfilled?: ((value: BetaMessage) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.runUntilDone().then(onfulfilled, onrejected);
  }
}

const MESSAGES_CHANGED_WHILE_COMPACTING =
  "Message params can't be changed while the conversation is being compacted, because the compaction " +
  'response is about to replace them. Change them after this iteration instead.';

function sameMessages(a: BetaMessageParam[], b: BetaMessageParam[]): boolean {
  return a.length === b.length && a.every((message, i) => sameMessage(message, b[i]!));
}

function rejectCompactionParam(params: object): void {
  if ('compaction' in params && params.compaction != null) {
    throw new AnthropicError(
      '`compaction` cannot be set on a tool runner: every request in the loop would compact again. ' +
        'Call `runner.compactBeforeNextTurn()` when the conversation should be compacted instead.',
    );
  }
}

function rejectRunToolsEagerlyWithoutStream(settings: BetaToolRunnerSettings): void {
  if (settings.runToolsEagerly && !settings.stream) {
    throw new TypeError(
      "`runToolsEagerly: true` needs `stream: true` in the tool runner's params, because a reply that " +
        "isn't streamed arrives whole.",
    );
  }
}

function rejectCompactionEdit(params: BetaToolRunnerParams): void {
  // The compaction request is sent without `context_management`, so the API can't refuse the pair there:
  // it would run and bill the compaction, then refuse the next request.
  if (params.context_management?.edits?.some((edit) => edit.type.startsWith('compact_'))) {
    throw new AnthropicError(
      "`compactBeforeNextTurn()` can't be used while `context_management` has a compaction edit, " +
        "because the API doesn't accept a compaction block together with one. Remove the edit first.",
    );
  }
}

/**
 * A compaction request returns only the compaction block, never a reply, so the API rejects the params that
 * only shape a reply. The runner's later requests keep them.
 */
function withoutCompactionIncompatibleParams(params: ToolRunnerRequestParams): ToolRunnerRequestParams {
  const { context_management, stop_sequences, output_format, ...kept } = params;
  const withoutFormat = ({ format, ...outputConfig }: BetaOutputConfig): BetaOutputConfig => outputConfig;
  if (kept.tool_choice?.type === 'any' || kept.tool_choice?.type === 'tool') {
    delete kept.tool_choice;
  }
  if (kept.output_config) {
    kept.output_config = withoutFormat(kept.output_config);
  }
  if (Array.isArray(kept.fallbacks)) {
    kept.fallbacks = kept.fallbacks.map((fallback) =>
      fallback.output_config ?
        { ...fallback, output_config: withoutFormat(fallback.output_config) }
      : fallback,
    );
  }
  return kept;
}

function toolDefinition(tool: BetaToolUnion | BetaRunnableTool): BetaToolUnion {
  if (!('run' in tool)) {
    return tool;
  }

  const apiKeys: readonly string[] = BETA_CLIENT_TOOL_UNION_KEYS;
  const fields: object = 'toJSON' in tool && typeof tool.toJSON === 'function' ? tool.toJSON() : tool;
  return {
    ...Object.fromEntries(Object.entries(fields).filter(([key]) => apiKeys.includes(key))),
    ...(wasCreatedByStainlessHelper(tool) && { [SDK_HELPER_SYMBOL]: tool[SDK_HELPER_SYMBOL] }),
  } as BetaToolUnion;
}

/**
 * What every turn of `thread` overrides: `tools` with only each runnable tool's API fields (see `toolDefinition()`), not
 * its functions or other properties such as a class's own state. The thread's own `tools` keeps the runnable tools,
 * which the loop calls.
 */
function turnParams(thread: BetaMessageThread<any>): BetaMessageThreadSendParams {
  const { tools } = thread._state.params;
  return tools ? { tools: tools.map(toolDefinition) } : {};
}

function withToolDefinitions(messages: BetaMessageParam[]): BetaMessageParam[] {
  return messages.map((message) => {
    if (message.role !== 'system' || !Array.isArray(message.content)) {
      return message;
    }
    const content = message.content.map((block) =>
      block.type === 'tool_addition' && block.tool.type === 'tool_definition' ?
        { ...block, tool: { ...block.tool, definition: toolDefinition(block.tool.definition) } }
      : block,
    );
    return { ...message, content };
  });
}

/**
 * Whether `message` has a `tool_addition` block holding a runnable tool: the only kind of block
 * `withToolDefinitions()` changes.
 */
function addsRunnableTool(message: BetaMessageParam): boolean {
  return (
    message.role === 'system' &&
    Array.isArray(message.content) &&
    message.content.some(
      (block) =>
        block.type === 'tool_addition' &&
        block.tool.type === 'tool_definition' &&
        'run' in block.tool.definition,
    )
  );
}

async function generateToolResponse(
  params: BetaToolRunnerParams,
  runnable: ReadonlyMap<string, BetaRunnableTool<any>>,
  available: ReadonlySet<string>,
  lastMessage: BetaMessage | BetaMessageParam | undefined,
  requestOptions: BetaToolRunnerRequestOptions | undefined,
  calls: Map<string, ToolCallState> | undefined,
  client: Anthropic,
  toolOtelContext: Context | undefined,
): Promise<BetaUserMessageParam | null> {
  // Only process if the last message is from the assistant and has tool use blocks
  if (
    !lastMessage ||
    lastMessage.role !== 'assistant' ||
    !lastMessage.content ||
    typeof lastMessage.content === 'string'
  ) {
    return null;
  }

  const toolUseBlocks = lastMessage.content.filter((content) => content.type === 'tool_use');
  if (toolUseBlocks.length === 0) {
    return null;
  }

  // A toolset's members run one at a time in the order the model wrote them, and once one is answered with is_error
  // the rest of that toolset's members in this turn are not run (notExecutedText). Function tools run alongside them
  // and neither wait on nor stop a toolset's members.
  const sequences = new Map<string, { tail: Promise<unknown>; failed: boolean }>();
  const toolResults = await Promise.all(
    toolUseBlocks.map(async (toolUse) => {
      // The call may have started while the reply streamed, or in an earlier `generateToolResponse()`.
      const call = calls?.get(toolUse.id);
      const started = call?.status === 'started' ? call.result : undefined;

      // Members dispatch by family, never by name: a custom tool may share the bare `name`.
      if (toolUse.toolset_name) {
        const family = toolUse.toolset_name;
        const sequence = sequences.get(family) ?? { tail: Promise.resolve(), failed: false };
        sequences.set(family, sequence);
        const registered = params.tools.some((t) => isRunnableToolset(t) && toolsetFamily(t) === family);
        const run =
          started ??
          sequence.tail.then(() =>
            sequence.failed ?
              toolsetResultBlock(toolUse, notExecutedText(family), true)
            : runToolsetCall(params, family, toolUse, requestOptions, client, toolOtelContext),
          );
        // A rejection (a usage error) propagates through Promise.all and stops the run. It also stops this toolset's
        // later members here, which would otherwise still be dispatched after the run has failed.
        sequence.tail = run.then(
          ({ is_error }) => {
            if (is_error && registered) sequence.failed = true;
          },
          () => {
            sequence.failed = true;
          },
        );
        calls?.set(toolUse.id, { status: 'started', result: run });
        return run;
      }
      if (started) {
        return started;
      }

      // A `tool_removal` is only a hint to the model, which may still emit a tool_use for a
      // withdrawn tool — treat those exactly like a tool that was never defined.
      const tool = available.has(toolUse.name) ? runnable.get(toolUse.name) : undefined;
      if (!tool && params.tools.some((t) => isRunnableToolset(t) && toolsetFamily(t) === toolUse.name)) {
        // A call named after a toolset in the run, but with no `toolset_name`, is a toolset call with malformed
        // actions. It fails like one of the toolset's calls, so the toolset's later calls in this turn are not run.
        const sequence = sequences.get(toolUse.name) ?? { tail: Promise.resolve(), failed: false };
        sequences.set(toolUse.name, sequence);
        sequence.tail = sequence.tail.then(() => {
          sequence.failed = true;
        });
        return malformedToolsetCallResult(toolUse);
      }
      const result = runToolCall(runnable, available, toolUse, requestOptions, client, toolOtelContext);
      calls?.set(toolUse.id, { status: 'started', result });
      return result;
    }),
  );

  return {
    role: 'user' as const,
    content: toolResults,
  };
}

/** Runs a toolset's call with the toolset of its family in the run. */
async function runToolsetCall(
  params: BetaToolRunnerParams,
  family: string,
  toolUse: BetaToolUseBlock,
  requestOptions: BetaToolRunnerRequestOptions | undefined,
  client: Anthropic,
  toolOtelContext: Context | undefined,
): Promise<BetaToolResultBlockParam> {
  const toolset = params.tools.find(
    (t): t is BetaRunnableToolset => isRunnableToolset(t) && toolsetFamily(t) === family,
  );
  if (!toolset) {
    return toolsetResultBlock(
      toolUse,
      `Error: Toolset '${quotedName(family)}' member '${quotedName(toolUse.name)}' not found`,
      true,
    );
  }

  const spanOptions = {
    signal: requestOptions?.signal,
    conversationId: requestOptions?.openTelemetry?.conversationId,
    parentContext: toolOtelContext,
  };
  const outcome = await withToolUseSpan(client, toolset, toolUse, spanOptions, async () => {
    const block = await runToolsetMember(toolset, toolUse, { signal: requestOptions?.signal });
    return { block, content: block.content ?? [], isError: block.is_error === true };
  });
  return outcome.block;
}

async function runToolCall(
  runnable: ReadonlyMap<string, BetaRunnableTool<any>>,
  available: ReadonlySet<string>,
  toolUse: BetaToolUseBlock,
  requestOptions: BetaToolRunnerRequestOptions | undefined,
  client: Anthropic,
  toolOtelContext: Context | undefined,
): Promise<BetaToolResultBlockParam> {
  // A `tool_removal` is only a hint to the model, which may still emit a tool_use for a
  // withdrawn tool — treat those exactly like a tool that was never defined.
  const tool = available.has(toolUse.name) ? runnable.get(toolUse.name) : undefined;
  if (!tool) {
    return toolNotFoundResult(toolUse);
  }

  const spanOptions = {
    signal: requestOptions?.signal,
    conversationId: requestOptions?.openTelemetry?.conversationId,
    parentContext: toolOtelContext,
  };
  const outcome = await withToolUseSpan(client, tool, toolUse, spanOptions, () =>
    runRunnableTool(tool, toolUse.input, {
      toolUse,
      toolUseBlock: toolUse,
      signal: requestOptions?.signal,
    }),
  );
  return {
    type: 'tool_result' as const,
    tool_use_id: toolUse.id,
    content: outcome.content,
    ...(outcome.isError ? { is_error: true } : undefined),
  };
}

/** The assistant turn the loop answers next: the last one in the history, unless `tool_result`s already follow it. */
function lastAssistantMessage(messages: BetaMessageParam[]): BetaMessageParam | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    if (message.role === 'assistant') return message;
    if (
      message.role === 'user' &&
      Array.isArray(message.content) &&
      message.content.some((block) => block.type === 'tool_result')
    ) {
      return undefined;
    }
  }
  return undefined;
}

function hasToolUse(message: BetaMessageParam | undefined): boolean {
  return Array.isArray(message?.content) && message.content.some((block) => block.type === 'tool_use');
}

type PendingToolChange =
  | { type: 'addition'; tool: BetaRunnableTool<any> | BetaToolUnion }
  | { type: 'removal'; name: string };

/**
 * A definition's family, as the API computes it for a toolset: its type without the date, and without `_toolset`.
 * So a later `browser_toolset_*` version is the browser family, and `computer_20250124` the computer family.
 */
function definitionFamily(tool: BetaRunnableTool<any> | BetaToolUnion): string {
  return (tool.type ?? 'custom').replace(/_\d{8}$/, '').replace(/_toolset$/, '');
}

function toolNotFoundResult(toolUse: { id: string; name: string }) {
  return {
    type: 'tool_result' as const,
    tool_use_id: toolUse.id,
    content: `Error: Tool '${toolUse.name}' not found`,
    is_error: true,
  };
}

/** The error for a toolset call with malformed actions. None of its actions run. */
function malformedToolsetCallResult(toolUse: BetaToolUseBlock): BetaToolResultBlockParam {
  return {
    type: 'tool_result',
    tool_use_id: toolUse.id,
    content: `Error: the '${quotedName(toolUse.name)}' toolset could not run this call${malformedActions(
      toolUse.input,
    )}; nothing in the batch was executed`,
    is_error: true,
  };
}

/** What is wrong with the call's `actions`. It quotes action names but no other part of the input. */
function malformedActions(input: unknown): string {
  const fields: object = typeof input === 'object' && input !== null ? input : {};
  if (!('actions' in fields)) {
    const action = 'action' in fields ? fields.action : undefined;
    return typeof action === 'string' ?
        `: the call has no 'actions' list (action: '${quotedName(action)}')`
      : ": the call has no 'actions' list";
  }
  const { actions } = fields;
  if (typeof actions === 'string') return ": 'actions' is text, not a list of actions";
  if (!Array.isArray(actions)) return ": 'actions' is not a list of actions";
  if (actions.length === 0) return ": the 'actions' list is empty";
  const names: string[] = [];
  for (const [i, entry] of actions.entries()) {
    const action =
      typeof entry === 'object' && entry !== null && 'action' in entry ? entry.action : undefined;
    if (typeof action !== 'string') return `: action ${i} must be an object with a string 'action' field`;
    names.push(`'${quotedName(action)}'`);
  }
  const more = names.length > 10 ? `, and ${names.length - 10} more` : '';
  return `: its actions could not be run as sent (actions: ${names.slice(0, 10).join(', ')}${more})`;
}

function applyToolChange(block: BetaContentBlockParam, available: Set<string>): void {
  switch (block.type) {
    case 'tool_removal':
    case 'tool_addition':
      applyToolReference(block, available);
      break;
  }
}

function applyToolReference(
  block: BetaRequestToolAdditionBlock | BetaRequestToolRemovalBlock,
  available: Set<string>,
): void {
  const name = changedToolName(block.tool);
  if (name === undefined) return;
  if (block.type === 'tool_removal') {
    available.delete(name);
  } else {
    available.add(name);
  }
}

function changedToolName(tool: BetaRequestToolAdditionBlock['tool']): string | undefined {
  switch (tool.type) {
    case 'tool_reference':
      return tool.name;
    case 'tool_definition':
      // Not every `tools[]` entry has a `name` (e.g. `mcp_toolset`); those are never locally runnable.
      return 'name' in tool.definition ? tool.definition.name : undefined;
    default:
      // mcp_tool_reference / mcp_toolset_reference run server-side; unknown types are ignored
      // rather than rejected.
      return undefined;
  }
}

type NextStep = 'run_tools' | 'resume' | 'stop';

/**
 * Sorts every stop reason into one of three buckets: `run_tools` turns run their client tool
 * calls and continue the loop; `resume` turns are sent back unchanged so the server continues
 * them; `stop` turns end the loop without running any tool calls.
 */
function determineNextStepFromStopReason(stopReason: BetaStopReason | null): NextStep {
  if (stopReason === null) return 'stop';
  if (isUnfinishedStopReason(stopReason)) return 'resume';
  switch (stopReason) {
    case 'tool_use':
      return 'run_tools';
    case 'end_turn':
    case 'stop_sequence':
    case 'max_tokens':
    case 'model_context_window_exceeded':
    case 'refusal':
      return 'stop';
    default:
      // The union is forward-compatible, so a stop reason this SDK doesn't know yet ends the
      // loop rather than throwing; the `never` check makes tsc reject an unclassified member.
      checkNever(stopReason);
      return 'stop';
  }
}

/** The runner's own settings: whether to stream each turn and when to stop. */
export type BetaToolRunnerSettings = {
  /** Whether each turn streams (the runner yields `BetaMessageStream`s) instead of resolving to a `BetaMessage`. */
  stream?: boolean | undefined;
  /**
   * Maximum number of iterations (API requests) to make in the tool execution loop.
   * Each iteration consists of: assistant response → tool execution → tool results.
   * When exceeded, the loop will terminate even if tools are still being requested.
   */
  max_iterations?: number | undefined;
  /**
   * Run each tool as soon as its call is complete, before the reply finishes, instead of once you are done
   * with the reply. This is optimistic: if the reply is interrupted or changes course, the tool may have
   * already run, so use `deferToolCall()` to hold the calls that aren't safe to run twice. Requires
   * `stream: true`.
   *
   * A toolset's call, such as a browser or computer action, starts early too when the toolset's earlier calls
   * have ended. Otherwise it waits for the reply, and so do the toolset's later calls. A toolset's `confirm` is
   * still asked before each call runs, so it may be asked while the reply streams.
   *
   * This will be the default in a future version.
   *
   * @default false
   */
  runToolsEagerly?: boolean | undefined;
};

/**
 * Parameters for creating a ToolRunner, extending MessageCreateParams with runnable tools and the runner's settings.
 *
 * `compaction` is left out because every request in the loop would compact again; call
 * `BetaToolRunner.compactBeforeNextTurn()` instead.
 */
export type BetaToolRunnerParams = Simplify<
  Omit<MessageCreateParams, 'tools' | 'thread' | 'compaction'> &
    Omit<BetaToolRunnerSettings, 'stream'> & {
      tools: (BetaToolUnion | BetaRunnableTool<any> | BetaRunnableToolset)[];
      /**
       * The loop runs over a message thread by default, sending only new messages each turn. `false` sends the full
       * history every turn.
       */
      thread?: false;
    }
>;

export type BetaToolRunnerRequestOptions = Pick<
  RequestOptions,
  'headers' | 'signal' | 'fallbackState' | 'openTelemetry'
>;

type ToolRunnerRequestParams = ThreadState['params'];

type ToolCallState = { status: 'held' } | { status: 'started'; result: Promise<BetaToolResultBlockParam> };

type Compaction =
  | { status: 'idle' }
  | { status: 'scheduled'; config: BetaCompactionConfig }
  | { status: 'in_flight' };

type BetaToolRunnerItem<Stream extends boolean> =
  Stream extends true ? BetaMessageStream
  : Stream extends false ? BetaMessage
  : BetaMessage | BetaMessageStream;
