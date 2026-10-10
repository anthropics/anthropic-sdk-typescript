import { BetaRunnableTool, toolErrorContent } from './BetaRunnableTool';
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
  BetaContentBlock,
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
  MessageCreateParams,
} from '../../resources/beta';
import { BetaMessageStream } from '../BetaMessageStream';
import { BetaToolRunnerStream } from '../internal/BetaToolRunnerStream';
import { RequestOptions } from '../../internal/request-options';
import { buildHeaders } from '../../internal/headers';
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
import type { Simplify } from '../internal/types';

const USE_A_NEW_RUNNER =
  "a tool runner's toolsets come only from its tools param; change them with setMessagesParams(), or build a new runner";
const REMOVE_WITH_A_NEW_RUNNER =
  "a tool runner's toolsets come only from its tools param; remove it there with setMessagesParams(), or build a new runner without it";

/**
 * A ToolRunner handles the automatic conversation loop between the assistant and tools.
 *
 * A ToolRunner is an async iterable that yields either BetaMessage or BetaMessageStream objects
 * depending on the streaming configuration. With `runToolsEagerly` it starts each tool call while the
 * reply is still streaming, unless `deferToolCall()` holds the call.
 */
export class BetaToolRunner<Stream extends boolean> {
  /** Whether the async iterator has been consumed */
  #consumed = false;
  /** Whether parameters have been mutated since the last API call */
  #mutated = false;
  /** Current state containing the request parameters */
  #state: { params: BetaToolRunnerParams };
  #options: BetaToolRunnerRequestOptions;
  /** Promise for the last message received from the assistant */
  #message?: Promise<BetaMessage> | undefined;
  /** The stream of the request in progress, when streaming */
  #stream?: BetaMessageStream | undefined;
  /** Cached tool response to avoid redundant executions */
  #toolResponse?: Promise<BetaMessageParam | null> | undefined;
  /** Promise resolvers for waiting on completion */
  #completion: {
    promise: Promise<BetaMessage>;
    resolve: (value: BetaMessage) => void;
    reject: (reason?: any) => void;
  };
  /** Number of iterations (API requests) made so far */
  #iterationCount = 0;
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

  constructor(
    private client: Anthropic,
    params: BetaToolRunnerParams,
    options?: BetaToolRunnerRequestOptions,
  ) {
    rejectCompactionParam(params);
    rejectCompactionControl(params);
    rejectRunToolsEagerlyWithoutStream(params);
    rejectMaxIterations(params);
    this.#state = {
      params: {
        // You can't clone the entire params since there are functions as handlers.
        // You also don't really need to clone params.messages, but it probably will prevent a foot gun
        // somewhere.
        ...params,
        // Not structuredClone(): it throws on a function, and a runnable tool written by value into a
        // `tool_addition` block has `run`. A JSON copy is the messages as they are sent, which drops it.
        messages: JSON.parse(JSON.stringify(withToolDefinitions(params.messages))),
      },
    };

    // Cloning drops symbol-keyed properties, so collect helper marks from the original params here: the
    // create()-side collector won't find them on the cloned messages, nor on a toolset's serialized entry.
    const collected = collectStainlessHelpers(params.tools, params.messages);
    this.#options = {
      ...options,
      headers: buildHeaders([
        helperHeader('BetaToolRunner'),
        collected.length ? { [STAINLESS_HELPER_HEADER]: collected.join(', ') } : undefined,
        options?.headers,
      ]),
    };
    this.#completion = promiseWithResolvers();
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

    try {
      while (true) {
        try {
          if (
            this.#state.params.max_iterations !== undefined &&
            this.#iterationCount >= this.#state.params.max_iterations
          ) {
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

          const { max_iterations, runToolsEagerly, ...params } = this.#state.params;

          yield* this.#send(params);

          if (!this.#mutated) {
            const message = await this.#message!;
            const nextStep = determineNextStepFromStopReason(message.stop_reason);
            this.#lastStopReason = message.stop_reason;
            this.#state.params.messages.push({
              role: message.role,
              content: asContentParam(message.content),
            });

            // Container-bound server tools reject a follow-up request that omits the container the
            // previous turn ran in, so carry its id forward unless the caller pinned one themselves.
            const { container } = this.#state.params;
            if (message.container) {
              if (container == null) {
                this.#state.params.container = message.container.id;
              } else if (typeof container === 'object' && container.id == null) {
                this.#state.params.container = { ...container, id: message.container.id };
              }
            }

            if (nextStep === 'stop') {
              yield* this.#compactAfterFinalTurn();
              break;
            }
            if (nextStep === 'resume') {
              continue;
            }
          } else {
            // The caller has taken over the history, so the last response no longer says how it ends.
            this.#lastStopReason = null;
          }

          const toolMessage = await this.#generateToolResponse(this.#state.params.messages.at(-1)!);
          if (toolMessage) {
            this.#state.params.messages.push(toolMessage);
          } else if (!this.#mutated) {
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
    } catch (error) {
      this.#consumed = false;
      // Silence unhandled promise errors
      this.#completion.promise.catch(() => {});
      this.#completion.reject(error);
      this.#completion = promiseWithResolvers();
      throw error;
    }
  }

  /**
   * Sends one request and yields its message, or its stream when streaming. `#message` and `#stream` are set
   * before the yield, so they are there while the caller handles the item; the loop aborts the stream at the
   * end of the iteration.
   */
  async *#send(params: MessageCreateParams): AsyncGenerator<BetaToolRunnerItem<Stream>, void, undefined> {
    await this.#startedCallsSettled();
    this.#calls = undefined;
    params = {
      ...params,
      ...(params.tools && { tools: params.tools.map(toolDefinition) }),
      messages: withToolDefinitions(params.messages),
    };
    if (params.stream) {
      this.#stream =
        this.#state.params.runToolsEagerly ?
          this.#streamThatStartsTools(params)
        : this.client.beta.messages.stream({ ...params }, this.#options);
      this.#message = this.#stream.finalMessage();
      // Make sure that this promise doesn't throw before we get the option to do something about it.
      // Error will be caught when we call await this.#message ultimately
      this.#message.catch(() => {});
      yield this.#stream as any;
    } else {
      this.#message = this.client.beta.messages.create({ ...params, stream: false }, this.#options);
      yield this.#message as any;
    }
  }

  /** Sends the request as a stream that starts each tool call while the reply streams. See `runToolsEagerly`. */
  #streamThatStartsTools(params: MessageCreateParams): BetaToolRunnerStream {
    const calls = new Map<string, ToolCallState>();
    this.#calls = calls;
    // A toolset runs its calls one at a time, in the model's order. So a toolset's call starts here only while the
    // toolset is idle, and once one of its calls waits for the reply or fails, its later calls wait for the reply too.
    const toolsets = new Map<string, 'running' | 'waiting'>();
    return BetaToolRunnerStream.start(this.client.beta.messages, params, this.#options, (toolUse) => {
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
        const result = runToolsetCall(this.#state.params, family, toolUse, this.#options);
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
      const result = runToolCall(this.#runnableTools(), this.#availableToolNames(), toolUse, this.#options);
      // Marks a rejection as handled until the results are collected.
      result.catch(() => {});
      calls.set(toolUse.id, { status: 'started', result });
    });
  }

  /** Waits for the calls of the last streamed reply that have started, whether or not their results were sent. */
  async #startedCallsSettled(): Promise<void> {
    const started = [...(this.#calls?.values() ?? [])].filter((call) => call.status === 'started');
    await Promise.allSettled(started.map((call) => call.result));
  }

  async *#compact(
    compaction: BetaCompactionConfig,
  ): AsyncGenerator<BetaToolRunnerItem<Stream>, void, undefined> {
    rejectCompactionEdit(this.#state.params);
    const { max_iterations, runToolsEagerly, ...requestParams } = this.#state.params;
    const params = withoutCompactionIncompatibleParams(requestParams);
    this.#compaction = { status: 'in_flight' };
    this.#toolResponse = undefined;
    const lastMessage = this.#message;

    try {
      yield* this.#send({ ...params, compaction });
      const message = await this.#message!;
      if (message.content.some((block) => block.type === 'compaction' && block.content)) {
        this.#recordRemovalsFromHistory();
        // The response has to be sent back as it came, first, replacing the messages it summarizes.
        this.#state.params.messages = [{ role: message.role, content: message.content }];
      } else {
        loggerFor(this.client).warn('Compaction produced no summary; keeping the conversation as it is.');
        // If the run ends here, `done()` resolves to the last real message rather than this response.
        this.#message = lastMessage;
      }
    } finally {
      this.#compaction = { status: 'idle' };
    }
  }

  /** The tools the runner runs, by name: the runnable tools in `params.tools` with the overrides applied */
  #runnableTools(): Map<string, BetaRunnableTool<any>> {
    const runnable = new Map<string, BetaRunnableTool<any>>();
    for (const tool of this.#state.params.tools) {
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

    for (const message of [...this.#state.params.messages, this.#pendingToolChangesMessage()]) {
      if (typeof message.content === 'string') {
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
    const lastContent = this.#state.params.messages.at(-1)?.content;
    if (Array.isArray(lastContent) && lastContent.some((block) => block.type === 'tool_use')) {
      // A turn that was cut short can end with tool calls that are never run, and the API can't
      // compact a conversation whose last turn has an unanswered tool call.
      loggerFor(this.client).warn(
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
   * @param paramsOrMutator - Either new parameters or a function to mutate existing parameters
   *
   * @example
   * // Direct parameter update
   * runner.setMessagesParams({
   *   model: 'claude-haiku-4-5',
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
    const params =
      typeof paramsOrMutator === 'function' ? paramsOrMutator(this.#state.params) : paramsOrMutator;
    rejectCompactionParam(params);
    rejectRunToolsEagerlyWithoutStream(params);
    rejectMaxIterations(params);
    if (this.#compaction.status !== 'idle') {
      rejectCompactionEdit(params);
    }
    if (this.#compaction.status === 'in_flight' && params.messages !== this.#state.params.messages) {
      throw new AnthropicError(
        "Message params can't be changed while the conversation is being compacted, because the compaction " +
          'response is about to replace them. Change them after this iteration instead.',
      );
    }
    this.#state.params = params;
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
   * @returns A promise that resolves to a BetaMessageParam containing tool results, or null if no tools need to be executed
   *
   * @example
   * const toolResponse = await runner.generateToolResponse();
   * if (toolResponse) {
   *   console.log('Tool results:', toolResponse.content);
   * }
   */
  async generateToolResponse(signal: AbortSignal | null | undefined = this.#options.signal) {
    const message = (await this.#message) ?? this.params.messages.at(-1);
    if (!message) {
      return null;
    }
    return this.#generateToolResponse(message, signal);
  }

  async #generateToolResponse(
    lastMessage: BetaMessage | BetaMessageParam,
    signal: AbortSignal | null | undefined = this.#options.signal,
  ) {
    if (this.#toolResponse !== undefined) {
      return this.#toolResponse;
    }
    this.#toolResponse = generateToolResponse(
      this.#state.params,
      this.#runnableTools(),
      this.#availableToolNames(),
      lastMessage,
      { ...this.#options, signal },
      this.#calls,
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
    return this.#state.params as Readonly<BetaToolRunnerParams>;
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
    rejectCompactionEdit(this.#state.params);
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
    return new Set(this.#state.params.tools.filter(isRunnableToolset).map(toolsetFamily));
  }

  #flushPendingToolChanges() {
    // A paused turn has to go back as the last message, so the changes wait for the request after it.
    if (this.#lastStopReason === 'pause_turn' || this.#pendingToolChanges.length === 0) {
      return;
    }
    // Not pushMessages(): that marks the params as changed by the caller, and the runner would then
    // leave this turn's assistant message and tool results for the caller to append.
    this.#state.params.messages.push(this.#pendingToolChangesMessage());
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

function rejectCompactionParam(params: BetaToolRunnerParams): void {
  if ('compaction' in params && params.compaction != null) {
    throw new AnthropicError(
      '`compaction` cannot be set on a tool runner: every request in the loop would compact again. ' +
        'Call `runner.compactBeforeNextTurn()` when the conversation should be compacted instead.',
    );
  }
}

function rejectCompactionControl(params: BetaToolRunnerParams): void {
  // No longer in the params type, so only untyped callers reach this; forwarding it would be an opaque API 400.
  if ('compactionControl' in params && params.compactionControl != null) {
    throw new AnthropicError(
      '`compactionControl` has been removed from the tool runner. Use server-side compaction instead: ' +
        'call `runner.compactBeforeNextTurn()` when the conversation should be compacted.',
    );
  }
}

function rejectRunToolsEagerlyWithoutStream(params: BetaToolRunnerParams): void {
  if (params.runToolsEagerly && !params.stream) {
    throw new TypeError(
      "`runToolsEagerly: true` needs `stream: true` in the tool runner's params, because a reply that " +
        "isn't streamed arrives whole.",
    );
  }
}

/**
 * `max_iterations` is read with a presence check, so it needs a contract for the
 * degenerate values the type allows. Left undefined, the loop is unbounded. `0`
 * is not a way to ask for that: `SessionToolRunner`'s `maxIdleMs` documents and
 * implements its own degenerate value explicitly, and this option's own
 * docstring promises a maximum.
 */
function rejectMaxIterations(params: BetaToolRunnerParams): void {
  const { max_iterations } = params;
  if (max_iterations === undefined) return;
  if (!Number.isInteger(max_iterations) || max_iterations < 1) {
    throw new RangeError(
      `\`max_iterations\` must be an integer of at least 1, or omitted for no limit; got ${max_iterations}. ` +
        'Omit it to leave the loop unbounded.',
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

function withToolDefinitions(messages: BetaMessageParam[]): BetaMessageParam[] {
  return messages.map((message) => {
    if (message.role !== 'system' || typeof message.content === 'string') {
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

async function generateToolResponse(
  params: BetaToolRunnerParams,
  runnable: ReadonlyMap<string, BetaRunnableTool<any>>,
  available: ReadonlySet<string>,
  lastMessage: BetaMessage | BetaMessageParam,
  requestOptions?: BetaToolRunnerRequestOptions,
  calls?: Map<string, ToolCallState>,
): Promise<BetaMessageParam | null> {
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
            : runToolsetCall(params, family, toolUse, requestOptions),
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
      const result = runToolCall(runnable, available, toolUse, requestOptions);
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
): Promise<BetaToolResultBlockParam> {
  const toolset = params.tools.find(
    (t): t is BetaRunnableToolset => isRunnableToolset(t) && toolsetFamily(t) === family,
  );
  return toolset ?
      runToolsetMember(toolset, toolUse, { signal: requestOptions?.signal })
    : toolsetResultBlock(
        toolUse,
        `Error: Toolset '${quotedName(family)}' member '${quotedName(toolUse.name)}' not found`,
        true,
      );
}

async function runToolCall(
  runnable: ReadonlyMap<string, BetaRunnableTool<any>>,
  available: ReadonlySet<string>,
  toolUse: BetaToolUseBlock,
  requestOptions?: BetaToolRunnerRequestOptions,
): Promise<BetaToolResultBlockParam> {
  // A `tool_removal` is only a hint to the model, which may still emit a tool_use for a
  // withdrawn tool — treat those exactly like a tool that was never defined.
  const tool = available.has(toolUse.name) ? runnable.get(toolUse.name) : undefined;
  if (!tool) {
    return toolNotFoundResult(toolUse);
  }

  try {
    let input = toolUse.input;
    if ('parse' in tool && tool.parse) {
      input = tool.parse(input);
    }

    const result = await tool.run(input, {
      toolUse: toolUse,
      toolUseBlock: toolUse,
      signal: requestOptions?.signal,
    });
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUse.id,
      content: result,
    };
  } catch (error) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUse.id,
      content: toolErrorContent(error),
      is_error: true,
    };
  }
}

/**
 * Response content is sent back as request content unchanged. The generated request type of the
 * `tool_listing` block is narrower than its response type, so this needs an assertion until the
 * two agree.
 */
function asContentParam(content: BetaContentBlock[]): BetaContentBlockParam[] {
  return content as BetaContentBlockParam[];
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
  switch (stopReason) {
    case 'tool_use':
      return 'run_tools';
    case 'pause_turn':
    // pause_after_compaction hands the turn back before the model answers; sending it back
    // unchanged continues it.
    case 'compaction':
      return 'resume';
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

/**
 * Parameters for creating a ToolRunner, extending MessageCreateParams with runnable tools.
 *
 * `compaction` is left out because every request in the loop would compact again; call
 * `BetaToolRunner.compactBeforeNextTurn()` instead.
 */
export type BetaToolRunnerParams = Simplify<
  Omit<MessageCreateParams, 'tools' | 'compaction'> & {
    tools: (BetaToolUnion | BetaRunnableTool<any> | BetaRunnableToolset)[];
    /**
     * Maximum number of iterations (API requests) to make in the tool execution loop.
     * Each iteration consists of: assistant response → tool execution → tool results.
     * When exceeded, the loop will terminate even if tools are still being requested.
     * Must be an integer of at least 1. Omit it to leave the loop unbounded.
     */
    max_iterations?: number;
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
    runToolsEagerly?: boolean;
  }
>;

export type BetaToolRunnerRequestOptions = Pick<RequestOptions, 'headers' | 'signal' | 'fallbackState'>;

type ToolRunnerRequestParams = Omit<BetaToolRunnerParams, 'max_iterations' | 'runToolsEagerly'>;

type ToolCallState = { status: 'held' } | { status: 'started'; result: Promise<BetaToolResultBlockParam> };

type Compaction =
  | { status: 'idle' }
  | { status: 'scheduled'; config: BetaCompactionConfig }
  | { status: 'in_flight' };

type BetaToolRunnerItem<Stream extends boolean> =
  Stream extends true ? BetaMessageStream
  : Stream extends false ? BetaMessage
  : BetaMessage | BetaMessageStream;
