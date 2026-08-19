// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIPromise } from '../../core/api-promise';
import { APIResource } from '../../core/resource';
import { Stream } from '../../core/streaming';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { stainlessHelperHeader } from '../../internal/stainless-helper-header';
import { MessageStream } from '../../lib/MessageStream';
import {
  parseMessage,
  type ExtractParsedContentFromParams,
  type ParseableMessageCreateParams,
  type ParsedMessage,
} from '../../lib/parser';
import * as BatchesAPI from './batches';
import {
  BatchCreateParams,
  BatchListParams,
  Batches,
  DeletedMessageBatch,
  MessageBatch,
  MessageBatchCanceledResult,
  MessageBatchErroredResult,
  MessageBatchExpiredResult,
  MessageBatchIndividualResponse,
  MessageBatchRequestCounts,
  MessageBatchResult,
  MessageBatchSucceededResult,
  MessageBatchesPage,
} from './batches';
import * as MessagesAPI from './messages';

import { MODEL_NONSTREAMING_TOKENS } from '../../internal/constants';

export class Messages extends APIResource {
  batches: BatchesAPI.Batches = new BatchesAPI.Batches(this._client);

  /**
   * Send a structured list of input messages with text and/or image content, and the
   * model will generate the next message in the conversation.
   *
   * The Messages API can be used for either single queries or stateless multi-turn
   * conversations.
   *
   * Learn more about the Messages API in our
   * [user guide](https://platform.claude.com/docs/en/get-started)
   *
   * @example
   * ```ts
   * const message = await client.messages.create({
   *   max_tokens: 1024,
   *   messages: [{ content: 'Hello, world', role: 'user' }],
   *   model: 'claude-opus-5',
   * });
   * ```
   */
  create(params: MessageCreateParamsNonStreaming, options?: RequestOptions): APIPromise<Message>;
  create(
    params: MessageCreateParamsStreaming,
    options?: RequestOptions,
  ): APIPromise<Stream<RawMessageStreamEvent>>;
  create(
    params: MessageCreateParamsBase,
    options?: RequestOptions,
  ): APIPromise<Stream<RawMessageStreamEvent> | Message>;
  create(
    params: MessageCreateParams,
    options?: RequestOptions,
  ): APIPromise<Message> | APIPromise<Stream<RawMessageStreamEvent>> {
    const { user_profile_id, ...body } = params;
    if (body.model in DEPRECATED_MODELS) {
      console.warn(
        `The model '${body.model}' is deprecated and will reach end-of-life on ${
          DEPRECATED_MODELS[body.model]
        }\nPlease migrate to a newer model. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.`,
      );
    }
    if (
      MODELS_TO_WARN_WITH_THINKING_ENABLED.includes(body.model) &&
      body.thinking &&
      body.thinking.type === 'enabled'
    ) {
      console.warn(
        `Using Claude with ${body.model} and 'thinking.type=enabled' is deprecated. Use 'thinking.type=adaptive' instead which results in better model performance in our testing: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking`,
      );
    }

    let timeout = options?.timeout ?? ((this._client as any)._options.timeout as number | null);
    if (!body.stream && timeout == null) {
      const maxNonstreamingTokens = MODEL_NONSTREAMING_TOKENS[body.model] ?? undefined;
      timeout = this._client.calculateNonstreamingTimeout(body.max_tokens, maxNonstreamingTokens);
    }

    // Collect helper info from tools and messages
    const helperHeader = stainlessHelperHeader(body.tools, body.messages);
    return this._client.post('/v1/messages', {
      body,
      timeout: timeout ?? 600000,
      ...options,
      headers: buildHeaders([
        { ...(user_profile_id != null ? { 'anthropic-user-profile-id': user_profile_id } : undefined) },
        helperHeader,
        options?.headers,
      ]),
      stream: params.stream ?? false,
    }) as APIPromise<Message> | APIPromise<Stream<RawMessageStreamEvent>>;
  }

  /**
   * Send a structured list of input messages with text and/or image content, along with an expected `output_config.format` and
   * the response will be automatically parsed and available in the `parsed_output` property of the message.
   *
   * @example
   * ```ts
   * const message = await client.messages.parse({
   *   model: 'claude-sonnet-4-5-20250929',
   *   max_tokens: 1024,
   *   messages: [{ role: 'user', content: 'What is 2+2?' }],
   *   output_config: {
   *     format: zodOutputFormat(z.object({ answer: z.number() })),
   *   },
   * });
   *
   * console.log(message.parsed_output?.answer); // 4
   * ```
   */
  parse<Params extends MessageCreateParamsNonStreaming>(
    params: Params,
    options?: RequestOptions,
  ): APIPromise<ParsedMessage<ExtractParsedContentFromParams<Params>>> {
    return this.create(params, options).then((message) =>
      parseMessage(message, params, { logger: this._client.logger ?? console }),
    ) as APIPromise<ParsedMessage<ExtractParsedContentFromParams<Params>>>;
  }

  /**
   * Create a Message stream.
   *
   * If `output_config.format` is provided with a parseable format (like `zodOutputFormat()`),
   * the final message will include a `parsed_output` property with the parsed content.
   *
   * @example
   * ```ts
   * const stream = client.messages.stream({
   *   model: 'claude-sonnet-4-5-20250929',
   *   max_tokens: 1024,
   *   messages: [{ role: 'user', content: 'What is 2+2?' }],
   *   output_config: {
   *     format: zodOutputFormat(z.object({ answer: z.number() })),
   *   },
   * });
   *
   * const message = await stream.finalMessage();
   * console.log(message.parsed_output?.answer); // 4
   * ```
   */
  stream<Params extends MessageStreamParams>(
    body: Params,
    options?: RequestOptions,
  ): MessageStream<ExtractParsedContentFromParams<Params>> {
    return MessageStream.createMessage<ExtractParsedContentFromParams<Params>>(
      this,
      body as MessageCreateParamsBase,
      options,
      { logger: this._client.logger ?? console },
    );
  }

  /**
   * Count the number of tokens in a Message.
   *
   * The Token Count API can be used to count the number of tokens in a Message,
   * including tools, images, and documents, without creating it.
   *
   * Learn more about token counting in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/token-counting)
   *
   * @example
   * ```ts
   * const messageTokensCount =
   *   await client.messages.countTokens({
   *     messages: [{ content: 'Hello, world', role: 'user' }],
   *     model: 'claude-opus-5',
   *   });
   * ```
   */
  countTokens(params: MessageCountTokensParams, options?: RequestOptions): APIPromise<MessageTokensCount> {
    const { user_profile_id, ...body } = params;
    return this._client.post('/v1/messages/count_tokens', {
      body,
      ...options,
      headers: buildHeaders([
        { ...(user_profile_id != null ? { 'anthropic-user-profile-id': user_profile_id } : undefined) },
        options?.headers,
      ]),
    });
  }
}

export interface Base64ImageSource {
  data: string;

  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  type: 'base64';
}

export interface Base64PDFSource {
  data: string;

  media_type: 'application/pdf';

  type: 'base64';
}

export interface BashCodeExecutionOutputBlock {
  file_id: string;

  type: 'bash_code_execution_output';
}

export interface BashCodeExecutionOutputBlockParam {
  file_id: string;

  type: 'bash_code_execution_output';
}

export interface BashCodeExecutionResultBlock {
  content: Array<BashCodeExecutionOutputBlock>;

  return_code: number;

  stderr: string;

  stdout: string;

  type: 'bash_code_execution_result';
}

export interface BashCodeExecutionResultBlockParam {
  content: Array<BashCodeExecutionOutputBlockParam>;

  return_code: number;

  stderr: string;

  stdout: string;

  type: 'bash_code_execution_result';
}

export interface BashCodeExecutionToolResultBlock {
  content: BashCodeExecutionToolResultError | BashCodeExecutionResultBlock;

  tool_use_id: string;

  type: 'bash_code_execution_tool_result';
}

export interface BashCodeExecutionToolResultBlockParam {
  content: BashCodeExecutionToolResultErrorParam | BashCodeExecutionResultBlockParam;

  tool_use_id: string;

  type: 'bash_code_execution_tool_result';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;
}

export interface BashCodeExecutionToolResultError {
  error_code: BashCodeExecutionToolResultErrorCode;

  type: 'bash_code_execution_tool_result_error';
}

export type BashCodeExecutionToolResultErrorCode =
  | 'invalid_tool_input'
  | 'unavailable'
  | 'too_many_requests'
  | 'execution_time_exceeded'
  | 'output_file_too_large';

export interface BashCodeExecutionToolResultErrorParam {
  error_code: BashCodeExecutionToolResultErrorCode;

  type: 'bash_code_execution_tool_result_error';
}

/**
 * `close_tab`'s config overrides.
 */
export interface BrowserCloseTabConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `double_click`'s config overrides.
 */
export interface BrowserDoubleClickConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `file_upload`'s config overrides.
 */
export interface BrowserFileUploadConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `find`'s config overrides.
 */
export interface BrowserFindConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `form_input`'s config overrides.
 */
export interface BrowserFormInputConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `get_page_text`'s config overrides.
 */
export interface BrowserGetPageTextConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `hold_key`'s config overrides.
 */
export interface BrowserHoldKeyConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `hover`'s config overrides.
 */
export interface BrowserHoverConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `javascript_exec`'s config overrides.
 */
export interface BrowserJavascriptExecConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `key`'s config overrides.
 */
export interface BrowserKeyConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `left_click`'s config overrides.
 */
export interface BrowserLeftClickConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `left_click_drag`'s config overrides.
 */
export interface BrowserLeftClickDragConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `left_mouse_down`'s config overrides.
 */
export interface BrowserLeftMouseDownConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `left_mouse_up`'s config overrides.
 */
export interface BrowserLeftMouseUpConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `list_tabs`'s config overrides.
 */
export interface BrowserListTabsConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `middle_click`'s config overrides.
 */
export interface BrowserMiddleClickConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `mouse_move`'s config overrides.
 */
export interface BrowserMouseMoveConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `navigate`'s config overrides.
 */
export interface BrowserNavigateConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `new_tab`'s config overrides.
 */
export interface BrowserNewTabConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `read_console`'s config overrides.
 */
export interface BrowserReadConsoleConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `read_network`'s config overrides.
 */
export interface BrowserReadNetworkConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `read_page`'s config overrides.
 */
export interface BrowserReadPageConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `right_click`'s config overrides.
 */
export interface BrowserRightClickConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `screenshot`'s config overrides.
 */
export interface BrowserScreenshotConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `scroll`'s config overrides.
 */
export interface BrowserScrollConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `scroll_to`'s config overrides.
 */
export interface BrowserScrollToConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * The caller's browser state after a browser toolset member call — the full
 * inventory of open tabs, which tab is active, and any side effects (tabs opened,
 * download state changes) the call produced.
 *
 * At most one per `tool_result`, only on a non-error result answering a browser
 * toolset member `tool_use`. The server renders the model-visible text from it;
 * the model never sees the raw fields.
 */
export interface BrowserStateBlockParam {
  /**
   * All tabs open in the browser after this call — the full inventory, not a delta.
   * May be empty. Whenever non-empty, exactly one entry carries `active: true`.
   */
  tabs: Array<BrowserStateTabEntry>;

  type: 'browser_state';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Tabs opened and download state changes during this call. "Nothing to report" is
   * expressed by omitting the field, never by an empty list.
   */
  state_changes?: Array<BrowserStateChange> | null;
}

/**
 * A tab this call's execution opened that remains open at its end — the creation
 * delta of the `tabs` inventory, not an event log.
 *
 * Carries only the `tab_id`; the tab's `title` and `url` live on its `tabs` entry,
 * which must include the same `tab_id`. A tab opened during a failed call gets no
 * deferred `tab_opened`; it simply appears in the next result's `tabs` inventory.
 */
export type BrowserStateChange =
  | BrowserStateChangeTabOpened
  | BrowserStateChangeDownloadStarted
  | BrowserStateChangeDownloadCompleted
  | BrowserStateChangeDownloadFailed;

/**
 * A file download that finished during this call, reported with the same
 * `download_id` as its `download_started` — or without a prior `download_started`,
 * when the download finished during the call that started it (at most one state
 * change per `download_id` per result).
 */
export interface BrowserStateChangeDownloadCompleted {
  /**
   * The caller-assigned identifier for this download, stable across the state
   * changes reporting it.
   */
  download_id: string;

  type: 'download_completed';

  /**
   * The final post-redirect URL the download was served from.
   */
  url: string;

  /**
   * Where the executor saved the file, on the executor's filesystem. Only included
   * when another tool in the same environment can read the file at that path.
   */
  path?: string | null;

  /**
   * The completed download's size.
   */
  size_bytes?: number | null;
}

/**
 * A file download that failed — or was cancelled — during this call.
 */
export interface BrowserStateChangeDownloadFailed {
  /**
   * The caller-assigned identifier for this download, stable across the state
   * changes reporting it.
   */
  download_id: string;

  type: 'download_failed';

  /**
   * The final post-redirect URL the download was served from.
   */
  url: string;

  /**
   * The failure or cancellation detail, when known.
   */
  error?: string | null;
}

/**
 * A file download that started during this call.
 */
export interface BrowserStateChangeDownloadStarted {
  /**
   * The caller-assigned identifier for this download, stable across the state
   * changes reporting it.
   */
  download_id: string;

  type: 'download_started';

  /**
   * The final post-redirect URL the download was served from.
   */
  url: string;
}

/**
 * A tab this call's execution opened that remains open at its end — the creation
 * delta of the `tabs` inventory, not an event log.
 *
 * Carries only the `tab_id`; the tab's `title` and `url` live on its `tabs` entry,
 * which must include the same `tab_id`. A tab opened during a failed call gets no
 * deferred `tab_opened`; it simply appears in the next result's `tabs` inventory.
 */
export interface BrowserStateChangeTabOpened {
  /**
   * The `tab_id` of the opened tab, present in `tabs`.
   */
  tab_id: string;

  type: 'tab_opened';
}

/**
 * One open browser tab reported in a `browser_state` block's `tabs` inventory.
 *
 * `tab_id` is the caller-assigned identifier for the tab; `title` and `url`
 * describe the page the tab is currently showing and may be empty strings (a blank
 * tab legitimately has both empty). `active` marks the tab that is active after
 * this call; whenever `tabs` is non-empty, exactly one entry is marked.
 */
export interface BrowserStateTabEntry {
  /**
   * The caller-assigned identifier for this tab, unique within the inventory.
   */
  tab_id: string;

  /**
   * The title of the page the tab is showing. May be empty.
   */
  title: string;

  /**
   * The URL of the page the tab is showing. May be empty.
   */
  url: string;

  /**
   * Whether this tab is the active tab after this call. Whenever `tabs` is
   * non-empty, exactly one entry is marked `active: true`.
   */
  active?: boolean;
}

/**
 * `switch_tab`'s config overrides.
 */
export interface BrowserSwitchTabConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * The browser toolset: a single `tools[]` entry (carrying no `name`) that declares
 * the browser tool family. The model is served the family's tool with any members
 * disabled via `configs` removed from its schema.
 */
export interface BrowserToolset20260801 {
  type: 'browser_toolset_20260801';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Per-member configuration for `browser_toolset_20260801`: one optional field per
   * member tool, keyed by the member name — the same name the member's `tool_use`
   * blocks carry. Every member is an accepted key, and a member's defaults apply
   * wherever its key is absent. Unknown keys are rejected: the field set is this
   * toolset version's complete member set.
   */
  configs?: BrowserToolsetConfigs | null;
}

/**
 * Per-member configuration for `browser_toolset_20260801`: one optional field per
 * member tool, keyed by the member name — the same name the member's `tool_use`
 * blocks carry. Every member is an accepted key, and a member's defaults apply
 * wherever its key is absent. Unknown keys are rejected: the field set is this
 * toolset version's complete member set.
 */
export interface BrowserToolsetConfigs {
  /**
   * `close_tab`'s config overrides.
   */
  close_tab?: BrowserCloseTabConfig | null;

  /**
   * `double_click`'s config overrides.
   */
  double_click?: BrowserDoubleClickConfig | null;

  /**
   * `file_upload`'s config overrides.
   */
  file_upload?: BrowserFileUploadConfig | null;

  /**
   * `find`'s config overrides.
   */
  find?: BrowserFindConfig | null;

  /**
   * `form_input`'s config overrides.
   */
  form_input?: BrowserFormInputConfig | null;

  /**
   * `get_page_text`'s config overrides.
   */
  get_page_text?: BrowserGetPageTextConfig | null;

  /**
   * `hold_key`'s config overrides.
   */
  hold_key?: BrowserHoldKeyConfig | null;

  /**
   * `hover`'s config overrides.
   */
  hover?: BrowserHoverConfig | null;

  /**
   * `javascript_exec`'s config overrides.
   */
  javascript_exec?: BrowserJavascriptExecConfig | null;

  /**
   * `key`'s config overrides.
   */
  key?: BrowserKeyConfig | null;

  /**
   * `left_click`'s config overrides.
   */
  left_click?: BrowserLeftClickConfig | null;

  /**
   * `left_click_drag`'s config overrides.
   */
  left_click_drag?: BrowserLeftClickDragConfig | null;

  /**
   * `left_mouse_down`'s config overrides.
   */
  left_mouse_down?: BrowserLeftMouseDownConfig | null;

  /**
   * `left_mouse_up`'s config overrides.
   */
  left_mouse_up?: BrowserLeftMouseUpConfig | null;

  /**
   * `list_tabs`'s config overrides.
   */
  list_tabs?: BrowserListTabsConfig | null;

  /**
   * `middle_click`'s config overrides.
   */
  middle_click?: BrowserMiddleClickConfig | null;

  /**
   * `mouse_move`'s config overrides.
   */
  mouse_move?: BrowserMouseMoveConfig | null;

  /**
   * `navigate`'s config overrides.
   */
  navigate?: BrowserNavigateConfig | null;

  /**
   * `new_tab`'s config overrides.
   */
  new_tab?: BrowserNewTabConfig | null;

  /**
   * `read_console`'s config overrides.
   */
  read_console?: BrowserReadConsoleConfig | null;

  /**
   * `read_network`'s config overrides.
   */
  read_network?: BrowserReadNetworkConfig | null;

  /**
   * `read_page`'s config overrides.
   */
  read_page?: BrowserReadPageConfig | null;

  /**
   * `right_click`'s config overrides.
   */
  right_click?: BrowserRightClickConfig | null;

  /**
   * `screenshot`'s config overrides.
   */
  screenshot?: BrowserScreenshotConfig | null;

  /**
   * `scroll`'s config overrides.
   */
  scroll?: BrowserScrollConfig | null;

  /**
   * `scroll_to`'s config overrides.
   */
  scroll_to?: BrowserScrollToConfig | null;

  /**
   * `switch_tab`'s config overrides.
   */
  switch_tab?: BrowserSwitchTabConfig | null;

  /**
   * `triple_click`'s config overrides.
   */
  triple_click?: BrowserTripleClickConfig | null;

  /**
   * `type`'s config overrides.
   */
  type?: BrowserTypeConfig | null;

  /**
   * `wait`'s config overrides.
   */
  wait?: BrowserWaitConfig | null;

  /**
   * `zoom`'s config overrides.
   */
  zoom?: BrowserZoomConfig | null;
}

/**
 * `triple_click`'s config overrides.
 */
export interface BrowserTripleClickConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `type`'s config overrides.
 */
export interface BrowserTypeConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `wait`'s config overrides.
 */
export interface BrowserWaitConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `zoom`'s config overrides.
 */
export interface BrowserZoomConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

export interface CacheControlEphemeral {
  type: 'ephemeral';

  /**
   * The time-to-live for the cache control breakpoint.
   *
   * This may be one the following values:
   *
   * - `5m`: 5 minutes
   * - `1h`: 1 hour
   *
   * Defaults to `5m`. See
   * [prompt caching pricing](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
   * for details.
   */
  ttl?: '5m' | '1h';
}

export interface CacheCreation {
  /**
   * The number of input tokens used to create the 1 hour cache entry.
   */
  ephemeral_1h_input_tokens: number;

  /**
   * The number of input tokens used to create the 5 minute cache entry.
   */
  ephemeral_5m_input_tokens: number;
}

export interface CitationCharLocation {
  cited_text: string;

  document_index: number;

  document_title: string | null;

  end_char_index: number;

  file_id: string | null;

  start_char_index: number;

  type: 'char_location';
}

export interface CitationCharLocationParam {
  cited_text: string;

  document_index: number;

  document_title: string | null;

  end_char_index: number;

  start_char_index: number;

  type: 'char_location';
}

export interface CitationContentBlockLocation {
  /**
   * The full text of the cited block range, concatenated.
   *
   * Always equals the contents of `content[start_block_index:end_block_index]`
   * joined together. The text block is the minimal citable unit; this field is never
   * a substring of a single block. Not counted toward output tokens, and not counted
   * toward input tokens when sent back in subsequent turns.
   */
  cited_text: string;

  document_index: number;

  document_title: string | null;

  /**
   * Exclusive 0-based end index of the cited block range in the source's `content`
   * array.
   *
   * Always greater than `start_block_index`; a single-block citation has
   * `end_block_index = start_block_index + 1`.
   */
  end_block_index: number;

  file_id: string | null;

  /**
   * 0-based index of the first cited block in the source's `content` array.
   */
  start_block_index: number;

  type: 'content_block_location';
}

export interface CitationContentBlockLocationParam {
  /**
   * The full text of the cited block range, concatenated.
   *
   * Always equals the contents of `content[start_block_index:end_block_index]`
   * joined together. The text block is the minimal citable unit; this field is never
   * a substring of a single block. Not counted toward output tokens, and not counted
   * toward input tokens when sent back in subsequent turns.
   */
  cited_text: string;

  document_index: number;

  document_title: string | null;

  /**
   * Exclusive 0-based end index of the cited block range in the source's `content`
   * array.
   *
   * Always greater than `start_block_index`; a single-block citation has
   * `end_block_index = start_block_index + 1`.
   */
  end_block_index: number;

  /**
   * 0-based index of the first cited block in the source's `content` array.
   */
  start_block_index: number;

  type: 'content_block_location';
}

export interface CitationPageLocation {
  cited_text: string;

  document_index: number;

  document_title: string | null;

  end_page_number: number;

  file_id: string | null;

  start_page_number: number;

  type: 'page_location';
}

export interface CitationPageLocationParam {
  cited_text: string;

  document_index: number;

  document_title: string | null;

  end_page_number: number;

  start_page_number: number;

  type: 'page_location';
}

export interface CitationSearchResultLocationParam {
  /**
   * The full text of the cited block range, concatenated.
   *
   * Always equals the contents of `content[start_block_index:end_block_index]`
   * joined together. The text block is the minimal citable unit; this field is never
   * a substring of a single block. Not counted toward output tokens, and not counted
   * toward input tokens when sent back in subsequent turns.
   */
  cited_text: string;

  /**
   * Exclusive 0-based end index of the cited block range in the source's `content`
   * array.
   *
   * Always greater than `start_block_index`; a single-block citation has
   * `end_block_index = start_block_index + 1`.
   */
  end_block_index: number;

  /**
   * 0-based index of the cited search result among all `search_result` content
   * blocks in the request, in the order they appear across messages and tool
   * results.
   *
   * Counted separately from `document_index`; server-side web search results are not
   * included in this count.
   */
  search_result_index: number;

  source: string;

  /**
   * 0-based index of the first cited block in the source's `content` array.
   */
  start_block_index: number;

  title: string | null;

  type: 'search_result_location';
}

export interface CitationWebSearchResultLocationParam {
  cited_text: string;

  encrypted_index: string;

  title: string | null;

  type: 'web_search_result_location';

  url: string;
}

export interface CitationsConfig {
  enabled: boolean;
}

export interface CitationsConfigParam {
  enabled?: boolean;
}

export interface CitationsDelta {
  citation:
    | CitationCharLocation
    | CitationPageLocation
    | CitationContentBlockLocation
    | CitationsWebSearchResultLocation
    | CitationsSearchResultLocation;

  type: 'citations_delta';
}

export interface CitationsSearchResultLocation {
  /**
   * The full text of the cited block range, concatenated.
   *
   * Always equals the contents of `content[start_block_index:end_block_index]`
   * joined together. The text block is the minimal citable unit; this field is never
   * a substring of a single block. Not counted toward output tokens, and not counted
   * toward input tokens when sent back in subsequent turns.
   */
  cited_text: string;

  /**
   * Exclusive 0-based end index of the cited block range in the source's `content`
   * array.
   *
   * Always greater than `start_block_index`; a single-block citation has
   * `end_block_index = start_block_index + 1`.
   */
  end_block_index: number;

  /**
   * 0-based index of the cited search result among all `search_result` content
   * blocks in the request, in the order they appear across messages and tool
   * results.
   *
   * Counted separately from `document_index`; server-side web search results are not
   * included in this count.
   */
  search_result_index: number;

  source: string;

  /**
   * 0-based index of the first cited block in the source's `content` array.
   */
  start_block_index: number;

  title: string | null;

  type: 'search_result_location';
}

export interface CitationsWebSearchResultLocation {
  cited_text: string;

  encrypted_index: string;

  title: string | null;

  type: 'web_search_result_location';

  url: string;
}

export interface CodeExecutionOutputBlock {
  file_id: string;

  type: 'code_execution_output';
}

export interface CodeExecutionOutputBlockParam {
  file_id: string;

  type: 'code_execution_output';
}

export interface CodeExecutionResultBlock {
  content: Array<CodeExecutionOutputBlock>;

  return_code: number;

  stderr: string;

  stdout: string;

  type: 'code_execution_result';
}

export interface CodeExecutionResultBlockParam {
  content: Array<CodeExecutionOutputBlockParam>;

  return_code: number;

  stderr: string;

  stdout: string;

  type: 'code_execution_result';
}

export interface CodeExecutionTool20250522 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'code_execution';

  type: 'code_execution_20250522';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

export interface CodeExecutionTool20250825 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'code_execution';

  type: 'code_execution_20250825';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

/**
 * Code execution tool with REPL state persistence (daemon mode + gVisor
 * checkpoint).
 */
export interface CodeExecutionTool20260120 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'code_execution';

  type: 'code_execution_20260120';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

/**
 * Code execution tool with REPL state persistence.
 */
export interface CodeExecutionTool20260521 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'code_execution';

  type: 'code_execution_20260521';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

export interface CodeExecutionToolResultBlock {
  /**
   * Code execution result with encrypted stdout for PFC + web_search results.
   */
  content: CodeExecutionToolResultBlockContent;

  tool_use_id: string;

  type: 'code_execution_tool_result';
}

/**
 * Code execution result with encrypted stdout for PFC + web_search results.
 */
export type CodeExecutionToolResultBlockContent =
  | CodeExecutionToolResultError
  | CodeExecutionResultBlock
  | EncryptedCodeExecutionResultBlock;

export interface CodeExecutionToolResultBlockParam {
  /**
   * Code execution result with encrypted stdout for PFC + web_search results.
   */
  content: CodeExecutionToolResultBlockParamContent;

  tool_use_id: string;

  type: 'code_execution_tool_result';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;
}

/**
 * Code execution result with encrypted stdout for PFC + web_search results.
 */
export type CodeExecutionToolResultBlockParamContent =
  | CodeExecutionToolResultErrorParam
  | CodeExecutionResultBlockParam
  | EncryptedCodeExecutionResultBlockParam;

export interface CodeExecutionToolResultError {
  error_code: CodeExecutionToolResultErrorCode;

  type: 'code_execution_tool_result_error';
}

export type CodeExecutionToolResultErrorCode =
  | 'invalid_tool_input'
  | 'unavailable'
  | 'too_many_requests'
  | 'execution_time_exceeded';

export interface CodeExecutionToolResultErrorParam {
  error_code: CodeExecutionToolResultErrorCode;

  type: 'code_execution_tool_result_error';
}

/**
 * `cursor_position`'s config overrides.
 */
export interface ComputerCursorPositionConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `double_click`'s config overrides.
 */
export interface ComputerDoubleClickConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `hold_key`'s config overrides.
 */
export interface ComputerHoldKeyConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `key`'s config overrides.
 */
export interface ComputerKeyConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `left_click`'s config overrides.
 */
export interface ComputerLeftClickConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `left_click_drag`'s config overrides.
 */
export interface ComputerLeftClickDragConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `left_mouse_down`'s config overrides.
 */
export interface ComputerLeftMouseDownConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `left_mouse_up`'s config overrides.
 */
export interface ComputerLeftMouseUpConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `middle_click`'s config overrides.
 */
export interface ComputerMiddleClickConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `mouse_move`'s config overrides.
 */
export interface ComputerMouseMoveConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `right_click`'s config overrides.
 */
export interface ComputerRightClickConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `screenshot`'s config overrides.
 */
export interface ComputerScreenshotConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `scroll`'s config overrides.
 */
export interface ComputerScrollConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * The computer toolset: a single `tools[]` entry (carrying no `name`) that
 * declares the computer tool family. The model is served the family's tool with
 * any members disabled via `configs` removed from its schema. Every member is
 * enabled by default, zoom included. The single-tool options `display_number` and
 * `enable_zoom` are not fields of a toolset entry — it carries only `type`,
 * `configs`, and `cache_control`; zoom is controlled via `configs.zoom.enabled`.
 */
export interface ComputerToolset20260801 {
  type: 'computer_toolset_20260801';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Per-member configuration for `computer_toolset_20260801`: one optional field per
   * member tool, keyed by the member name — the same name the member's `tool_use`
   * blocks carry. Every member is an accepted key, and a member's defaults apply
   * wherever its key is absent. Unknown keys are rejected: the field set is this
   * toolset version's complete member set.
   */
  configs?: ComputerToolsetConfigs | null;
}

/**
 * Per-member configuration for `computer_toolset_20260801`: one optional field per
 * member tool, keyed by the member name — the same name the member's `tool_use`
 * blocks carry. Every member is an accepted key, and a member's defaults apply
 * wherever its key is absent. Unknown keys are rejected: the field set is this
 * toolset version's complete member set.
 */
export interface ComputerToolsetConfigs {
  /**
   * `cursor_position`'s config overrides.
   */
  cursor_position?: ComputerCursorPositionConfig | null;

  /**
   * `double_click`'s config overrides.
   */
  double_click?: ComputerDoubleClickConfig | null;

  /**
   * `hold_key`'s config overrides.
   */
  hold_key?: ComputerHoldKeyConfig | null;

  /**
   * `key`'s config overrides.
   */
  key?: ComputerKeyConfig | null;

  /**
   * `left_click`'s config overrides.
   */
  left_click?: ComputerLeftClickConfig | null;

  /**
   * `left_click_drag`'s config overrides.
   */
  left_click_drag?: ComputerLeftClickDragConfig | null;

  /**
   * `left_mouse_down`'s config overrides.
   */
  left_mouse_down?: ComputerLeftMouseDownConfig | null;

  /**
   * `left_mouse_up`'s config overrides.
   */
  left_mouse_up?: ComputerLeftMouseUpConfig | null;

  /**
   * `middle_click`'s config overrides.
   */
  middle_click?: ComputerMiddleClickConfig | null;

  /**
   * `mouse_move`'s config overrides.
   */
  mouse_move?: ComputerMouseMoveConfig | null;

  /**
   * `right_click`'s config overrides.
   */
  right_click?: ComputerRightClickConfig | null;

  /**
   * `screenshot`'s config overrides.
   */
  screenshot?: ComputerScreenshotConfig | null;

  /**
   * `scroll`'s config overrides.
   */
  scroll?: ComputerScrollConfig | null;

  /**
   * `triple_click`'s config overrides.
   */
  triple_click?: ComputerTripleClickConfig | null;

  /**
   * `type`'s config overrides.
   */
  type?: ComputerTypeConfig | null;

  /**
   * `wait`'s config overrides.
   */
  wait?: ComputerWaitConfig | null;

  /**
   * `zoom`'s config overrides.
   */
  zoom?: ComputerZoomConfig | null;
}

/**
 * `triple_click`'s config overrides.
 */
export interface ComputerTripleClickConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `type`'s config overrides.
 */
export interface ComputerTypeConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `wait`'s config overrides.
 */
export interface ComputerWaitConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * `zoom`'s config overrides.
 */
export interface ComputerZoomConfig {
  /**
   * Defer loading for this member. Must resolve to the same value on every enabled
   * member of the toolset.
   */
  defer_loading?: boolean | null;

  /**
   * Whether this member is offered to the model. Default is per member, per the
   * toolset's documentation. A member whose enabled resolves false is withheld from
   * the served schema.
   */
  enabled?: boolean | null;
}

/**
 * Information about the container used in the request (for the code execution
 * tool)
 */
export interface Container {
  /**
   * Identifier for the container used in this request
   */
  id: string;

  /**
   * The time at which the container will expire.
   */
  expires_at: string;

  /**
   * Skills loaded in the container
   */
  skills: Array<ContainerSkill> | null;
}

/**
 * Container parameters with skills to be loaded.
 */
export interface ContainerParams {
  /**
   * Container id
   */
  id?: string | null;

  /**
   * List of skills to load in the container
   */
  skills?: Array<SkillParams> | null;
}

/**
 * A skill that was loaded in a container (response model).
 */
export interface ContainerSkill {
  /**
   * Skill ID
   */
  skill_id: string;

  /**
   * Type of skill - either 'anthropic' (built-in) or 'custom' (user-defined)
   */
  type: 'anthropic' | 'custom';

  /**
   * The resolved version: a skill version ID for custom skills.
   */
  version: string;
}

/**
 * Response model for a file uploaded to the container.
 */
export interface ContainerUploadBlock {
  file_id: string;

  type: 'container_upload';
}

/**
 * A content block that represents a file to be uploaded to the container Files
 * uploaded via this block will be available in the container's input directory.
 */
export interface ContainerUploadBlockParam {
  file_id: string;

  type: 'container_upload';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;
}

/**
 * Response model for a file uploaded to the container.
 */
export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | RedactedThinkingBlock
  | ToolUseBlock
  | ServerToolUseBlock
  | WebSearchToolResultBlock
  | WebFetchToolResultBlock
  | CodeExecutionToolResultBlock
  | BashCodeExecutionToolResultBlock
  | TextEditorCodeExecutionToolResultBlock
  | ToolSearchToolResultBlock
  | ContainerUploadBlock;

/**
 * Regular text content.
 */
export type ContentBlockParam =
  | TextBlockParam
  | ImageBlockParam
  | DocumentBlockParam
  | SearchResultBlockParam
  | ThinkingBlockParam
  | RedactedThinkingBlockParam
  | ToolUseBlockParam
  | ToolResultBlockParam
  | ServerToolUseBlockParam
  | WebSearchToolResultBlockParam
  | WebFetchToolResultBlockParam
  | CodeExecutionToolResultBlockParam
  | BashCodeExecutionToolResultBlockParam
  | TextEditorCodeExecutionToolResultBlockParam
  | ToolSearchToolResultBlockParam
  | ContainerUploadBlockParam;

export interface ContentBlockSource {
  content: string | Array<ContentBlockSourceContent>;

  type: 'content';
}

export type ContentBlockSourceContent = TextBlockParam | ImageBlockParam;

/**
 * Tool invocation directly from the model.
 */
export interface DirectCaller {
  type: 'direct';
}

export interface DocumentBlock {
  /**
   * Citation configuration for the document
   */
  citations: CitationsConfig | null;

  source: Base64PDFSource | PlainTextSource;

  /**
   * The title of the document
   */
  title: string | null;

  type: 'document';
}

export interface DocumentBlockParam {
  source: Base64PDFSource | PlainTextSource | ContentBlockSource | URLPDFSource | FileDocumentSource;

  type: 'document';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  citations?: CitationsConfigParam | null;

  context?: string | null;

  title?: string | null;
}

/**
 * Code execution result with encrypted stdout for PFC + web_search results.
 */
export interface EncryptedCodeExecutionResultBlock {
  content: Array<CodeExecutionOutputBlock>;

  encrypted_stdout: string;

  return_code: number;

  stderr: string;

  type: 'encrypted_code_execution_result';
}

/**
 * Code execution result with encrypted stdout for PFC + web_search results.
 */
export interface EncryptedCodeExecutionResultBlockParam {
  content: Array<CodeExecutionOutputBlockParam>;

  encrypted_stdout: string;

  return_code: number;

  stderr: string;

  type: 'encrypted_code_execution_result';
}

export interface FileDocumentSource {
  file_id: string;

  type: 'file';
}

export interface FileImageSource {
  file_id: string;

  type: 'file';
}

export interface ImageBlockParam {
  source: Base64ImageSource | URLImageSource | FileImageSource;

  type: 'image';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Configures the transformations the server applies to this image before the model
   * observes it. Each key names a condition the server transforms images for; its
   * value selects the transformation applied. Omitted keys keep their default
   * behavior, and an empty object is equivalent to omitting the field.
   */
  transformations?: ImageTransformationsParam | null;
}

/**
 * Configures the transformations the server applies to this image before the model
 * observes it. Each key names a condition the server transforms images for; its
 * value selects the transformation applied. Omitted keys keep their default
 * behavior, and an empty object is equivalent to omitting the field.
 */
export interface ImageTransformationsParam {
  /**
   * What the server does when this image exceeds the model's maximum image size.
   * `"downsize"` (the default) scales the image down to fit, which changes the
   * dimensions the model observes without telling you. `"error"` instead rejects the
   * request with a 400 error naming the image's dimensions and the largest
   * dimensions that fit, so you can scale the image deliberately — your image is
   * never silently scaled down.
   */
  oversized_image?: 'downsize' | 'error';
}

export interface InputJSONDelta {
  partial_json: string;

  type: 'input_json_delta';
}

export interface JSONOutputFormat {
  /**
   * The JSON schema of the format
   */
  schema: { [key: string]: unknown };

  type: 'json_schema';
}

export interface MemoryTool20250818 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'memory';

  type: 'memory_20250818';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  input_examples?: Array<{ [key: string]: unknown }>;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

export interface Message {
  /**
   * Unique object identifier.
   *
   * The format and length of IDs may change over time.
   */
  id: string;

  /**
   * Information about the container used in the request (for the code execution
   * tool)
   */
  container: Container | null;

  /**
   * Content generated by the model.
   *
   * This is an array of content blocks, each of which has a `type` that determines
   * its shape.
   *
   * Example:
   *
   * ```json
   * [{ "type": "text", "text": "Hi, I'm Claude." }]
   * ```
   *
   * If the request input `messages` ended with an `assistant` turn, then the
   * response `content` will continue directly from that last turn. You can use this
   * to constrain the model's output.
   *
   * For example, if the input `messages` were:
   *
   * ```json
   * [
   *   {
   *     "role": "user",
   *     "content": "What's the Greek name for Sun? (A) Sol (B) Helios (C) Sun"
   *   },
   *   { "role": "assistant", "content": "The best answer is (" }
   * ]
   * ```
   *
   * Then the response `content` might be:
   *
   * ```json
   * [{ "type": "text", "text": "B)" }]
   * ```
   */
  content: Array<ContentBlock>;

  /**
   * The model that will complete your prompt.
   *
   * See [models](https://docs.anthropic.com/en/docs/models-overview) for additional
   * details and options.
   */
  model: Model;

  /**
   * Conversational role of the generated message.
   *
   * This will always be `"assistant"`.
   */
  role: 'assistant';

  /**
   * Structured information about a refusal.
   */
  stop_details: RefusalStopDetails | null;

  /**
   * The reason that we stopped.
   *
   * This may be one the following values:
   *
   * - `"end_turn"`: the model reached a natural stopping point
   * - `"max_tokens"`: we exceeded the requested `max_tokens` or the model's maximum
   * - `"stop_sequence"`: one of your provided custom `stop_sequences` was generated
   * - `"tool_use"`: the model invoked one or more tools
   * - `"pause_turn"`: we paused a long-running turn. You may provide the response
   *   back as-is in a subsequent request to let the model continue.
   * - `"refusal"`: when streaming classifiers intervene to handle potential policy
   *   violations
   * - `"model_context_window_exceeded"`: we exceeded the model's context window
   *
   * In non-streaming mode this value is always non-null. In streaming mode, it is
   * null in the `message_start` event and non-null otherwise.
   */
  stop_reason: StopReason | null;

  /**
   * Which custom stop sequence was generated, if any.
   *
   * This value will be a non-null string if one of your custom stop sequences was
   * generated.
   */
  stop_sequence: string | null;

  /**
   * Object type.
   *
   * For Messages, this is always `"message"`.
   */
  type: 'message';

  /**
   * Billing and rate-limit usage.
   *
   * Anthropic's API bills and rate-limits by token counts, as tokens represent the
   * underlying cost to our systems.
   *
   * Under the hood, the API transforms requests into a format suitable for the
   * model. The model's output then goes through a parsing stage before becoming an
   * API response. As a result, the token counts in `usage` will not match one-to-one
   * with the exact visible content of an API request or response.
   *
   * For example, `output_tokens` will be non-zero, even for an empty string response
   * from Claude.
   *
   * Total input tokens in a request is the summation of `input_tokens`,
   * `cache_creation_input_tokens`, and `cache_read_input_tokens`.
   */
  usage: Usage;
}

/**
 * Code execution tool with REPL state persistence (daemon mode + gVisor
 * checkpoint).
 */
export type MessageCountTokensTool =
  | Tool
  | ToolBash20250124
  | CodeExecutionTool20250522
  | CodeExecutionTool20250825
  | CodeExecutionTool20260120
  | CodeExecutionTool20260521
  | BrowserToolset20260801
  | MemoryTool20250818
  | ComputerToolset20260801
  | ToolTextEditor20250124
  | ToolTextEditor20250429
  | ToolTextEditor20250728
  | WebSearchTool20250305
  | WebFetchTool20250910
  | WebSearchTool20260209
  | WebFetchTool20260209
  | WebFetchTool20260309
  | WebSearchTool20260318
  | WebFetchTool20260318
  | ToolSearchToolBm25_20251119
  | ToolSearchToolRegex20251119;

/**
 * Container identifier for reuse across requests.
 */
export type MessageCreateParamsContainer = ContainerParams | string;

export interface MessageDeltaUsage {
  /**
   * The cumulative number of input tokens used to create the cache entry.
   */
  cache_creation_input_tokens: number | null;

  /**
   * The cumulative number of input tokens read from the cache.
   */
  cache_read_input_tokens: number | null;

  /**
   * The cumulative number of input tokens which were used.
   */
  input_tokens: number | null;

  /**
   * The cumulative number of output tokens which were used.
   */
  output_tokens: number;

  /**
   * Breakdown of output tokens by category.
   *
   * `output_tokens` remains the inclusive, authoritative total used for billing.
   * This object provides a read-only decomposition for observability — for example,
   * how many of the billed output tokens were spent on internal reasoning that may
   * have been summarized before being returned to you.
   */
  output_tokens_details: OutputTokensDetails | null;

  /**
   * The number of server tool requests.
   */
  server_tool_use: ServerToolUsage | null;
}

export interface MessageParam {
  content: string | Array<ContentBlockParam>;

  role: 'user' | 'assistant' | 'system';
}

export interface MessageTokensCount {
  /**
   * The total number of tokens across the provided list of messages, system prompt,
   * and tools.
   */
  input_tokens: number;
}

export interface Metadata {
  /**
   * An external identifier for the user who is associated with the request.
   *
   * This should be a uuid, hash value, or other opaque identifier. Anthropic may use
   * this id to help detect abuse. Do not include any identifying information such as
   * name, email address, or phone number.
   */
  user_id?: string | null;
}

/**
 * The model that will complete your prompt.
 *
 * See [models](https://docs.anthropic.com/en/docs/models-overview) for additional
 * details and options.
 */
export type Model =
  | 'claude-sonnet-5'
  | 'claude-fable-5'
  | 'claude-mythos-5'
  | 'claude-opus-5'
  | 'claude-opus-4-8'
  | 'claude-opus-4-7'
  | 'claude-mythos-preview'
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5'
  | 'claude-haiku-4-5-20251001'
  | 'claude-opus-4-5'
  | 'claude-opus-4-5-20251101'
  | 'claude-sonnet-4-5'
  | 'claude-sonnet-4-5-20250929'
  | (string & {});

export interface OutputConfig {
  /**
   * All possible effort levels.
   */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null;

  /**
   * A schema to specify Claude's output format in responses. See
   * [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
   */
  format?: JSONOutputFormat | null;
}

export interface OutputTokensDetails {
  /**
   * Number of output tokens the model generated as internal reasoning, including the
   * thinking-block delimiter tokens.
   *
   * Reflects the raw reasoning the model produced, not the (possibly shorter)
   * summarized thinking text returned in the response body. Computed by
   * re-tokenizing the raw reasoning text, so it may differ from the model's exact
   * generation count by a small number of tokens. Always ≤ `output_tokens`;
   * `output_tokens - thinking_tokens` approximates the non-reasoning output.
   */
  thinking_tokens: number;
}
const DEPRECATED_MODELS: {
  [K in Model]?: string;
} = {};

const MODELS_TO_WARN_WITH_THINKING_ENABLED: Model[] = ['claude-mythos-preview', 'claude-opus-4-6'];

export interface PlainTextSource {
  data: string;

  media_type: 'text/plain';

  type: 'text';
}

export type RawContentBlockDelta =
  | TextDelta
  | InputJSONDelta
  | CitationsDelta
  | ThinkingDelta
  | SignatureDelta;

export interface RawContentBlockDeltaEvent {
  delta: RawContentBlockDelta;

  index: number;

  type: 'content_block_delta';
}

export interface RawContentBlockStartEvent {
  /**
   * Response model for a file uploaded to the container.
   */
  content_block:
    | TextBlock
    | ThinkingBlock
    | RedactedThinkingBlock
    | ToolUseBlock
    | ServerToolUseBlock
    | WebSearchToolResultBlock
    | WebFetchToolResultBlock
    | CodeExecutionToolResultBlock
    | BashCodeExecutionToolResultBlock
    | TextEditorCodeExecutionToolResultBlock
    | ToolSearchToolResultBlock
    | ContainerUploadBlock;

  index: number;

  type: 'content_block_start';
}

export interface RawContentBlockStopEvent {
  index: number;

  type: 'content_block_stop';
}

export interface RawMessageDeltaEvent {
  delta: RawMessageDeltaEvent.Delta;

  type: 'message_delta';

  /**
   * Billing and rate-limit usage.
   *
   * Anthropic's API bills and rate-limits by token counts, as tokens represent the
   * underlying cost to our systems.
   *
   * Under the hood, the API transforms requests into a format suitable for the
   * model. The model's output then goes through a parsing stage before becoming an
   * API response. As a result, the token counts in `usage` will not match one-to-one
   * with the exact visible content of an API request or response.
   *
   * For example, `output_tokens` will be non-zero, even for an empty string response
   * from Claude.
   *
   * Total input tokens in a request is the summation of `input_tokens`,
   * `cache_creation_input_tokens`, and `cache_read_input_tokens`.
   */
  usage: MessageDeltaUsage;
}

export namespace RawMessageDeltaEvent {
  export interface Delta {
    /**
     * Information about the container used in the request (for the code execution
     * tool)
     */
    container: MessagesAPI.Container | null;

    /**
     * Structured information about a refusal.
     */
    stop_details: MessagesAPI.RefusalStopDetails | null;

    stop_reason: MessagesAPI.StopReason | null;

    stop_sequence: string | null;
  }
}

export interface RawMessageStartEvent {
  message: Message;

  type: 'message_start';
}

export interface RawMessageStopEvent {
  type: 'message_stop';
}

export type RawMessageStreamEvent =
  | RawMessageStartEvent
  | RawMessageDeltaEvent
  | RawMessageStopEvent
  | RawContentBlockStartEvent
  | RawContentBlockDeltaEvent
  | RawContentBlockStopEvent;

export interface RedactedThinkingBlock {
  /**
   * The contents of this redacted thinking block, returned when portions of the
   * model's thinking were safety-redacted. This field is opaque and encrypted, with
   * no readable content.
   *
   * Pass `redacted_thinking` blocks back to the API unchanged when continuing a
   * multi-turn conversation.
   *
   * See
   * [extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking#redacted-thinking-blocks)
   * for details.
   */
  data: string;

  type: 'redacted_thinking';
}

export interface RedactedThinkingBlockParam {
  /**
   * The `data` value of this redacted thinking block, exactly as returned by the API
   * in a previous response. Opaque and encrypted; pass it back unchanged.
   */
  data: string;

  type: 'redacted_thinking';
}

/**
 * Structured information about a refusal.
 */
export interface RefusalStopDetails {
  /**
   * The policy category that triggered a refusal.
   *
   * - `cyber` - The request could enable cyber harm, such as malware or exploit
   *   development. Benign cybersecurity work can also trigger this category.
   * - `bio` - The request could enable biological harm, such as dangerous lab
   *   methods. Beneficial life sciences work can also trigger this category.
   * - `frontier_llm` - The request could assist the development of competing AI
   *   models, which is restricted under
   *   [Anthropic's commercial terms](https://www.anthropic.com/legal/commercial-terms).
   *   Benign machine learning work can also trigger this category.
   * - `reasoning_extraction` - The request asks the model to reproduce its internal
   *   reasoning in the response text. To get reasoning in a structured form instead,
   *   use
   *   [adaptive thinking](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking).
   * - `general_harms` - The request could be related to an area that was determined
   *   as harmful. Benign work might sometimes trigger this category.
   */
  category: 'cyber' | 'bio' | 'frontier_llm' | 'reasoning_extraction' | 'general_harms' | null;

  /**
   * Human-readable explanation of the refusal.
   *
   * This text is not guaranteed to be stable. `null` when no explanation is
   * available for the category.
   */
  explanation: string | null;

  type: 'refusal';
}

export interface SearchResultBlockParam {
  content: Array<TextBlockParam>;

  source: string;

  title: string;

  type: 'search_result';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  citations?: CitationsConfigParam;
}

/**
 * Tool invocation generated by a server-side tool.
 */
export interface ServerToolCaller {
  tool_id: string;

  type: 'code_execution_20250825';
}

export interface ServerToolCaller20260120 {
  tool_id: string;

  type: 'code_execution_20260120';
}

export interface ServerToolUsage {
  /**
   * The number of web fetch tool requests.
   */
  web_fetch_requests: number;

  /**
   * The number of web search tool requests.
   */
  web_search_requests: number;
}

export interface ServerToolUseBlock {
  id: string;

  /**
   * Tool invocation directly from the model.
   */
  caller: DirectCaller | ServerToolCaller | ServerToolCaller20260120;

  input: unknown;

  name:
    | 'web_search'
    | 'web_fetch'
    | 'code_execution'
    | 'bash_code_execution'
    | 'text_editor_code_execution'
    | 'tool_search_tool_regex'
    | 'tool_search_tool_bm25';

  type: 'server_tool_use';
}

export interface ServerToolUseBlockParam {
  id: string;

  input: unknown;

  name:
    | 'web_search'
    | 'web_fetch'
    | 'code_execution'
    | 'bash_code_execution'
    | 'text_editor_code_execution'
    | 'tool_search_tool_regex'
    | 'tool_search_tool_bm25';

  type: 'server_tool_use';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Tool invocation directly from the model.
   */
  caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export interface SignatureDelta {
  /**
   * The `signature` for this thinking block: an opaque value used to verify that the
   * block was generated by Claude when it is passed back to the API. Delivered in a
   * `signature_delta` event just before the block's `content_block_stop` event.
   */
  signature: string;

  type: 'signature_delta';
}

/**
 * Specification for a skill to be loaded in a container (request model).
 */
export interface SkillParams {
  /**
   * Skill ID
   */
  skill_id: string;

  /**
   * Type of skill - either 'anthropic' (built-in) or 'custom' (user-defined)
   */
  type: 'anthropic' | 'custom';

  /**
   * Skill version or 'latest' for most recent version
   */
  version?: string;
}

export type StopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'tool_use'
  | 'pause_turn'
  | 'refusal'
  | 'model_context_window_exceeded';

export interface TextBlock {
  /**
   * Citations supporting the text block.
   *
   * The type of citation returned will depend on the type of document being cited.
   * Citing a PDF results in `page_location`, plain text results in `char_location`,
   * and content document results in `content_block_location`.
   */
  citations: Array<TextCitation> | null;

  text: string;

  type: 'text';
}

export interface TextBlockParam {
  text: string;

  type: 'text';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  citations?: Array<TextCitationParam> | null;
}

export type TextCitation =
  | CitationCharLocation
  | CitationPageLocation
  | CitationContentBlockLocation
  | CitationsWebSearchResultLocation
  | CitationsSearchResultLocation;

export type TextCitationParam =
  | CitationCharLocationParam
  | CitationPageLocationParam
  | CitationContentBlockLocationParam
  | CitationWebSearchResultLocationParam
  | CitationSearchResultLocationParam;

export interface TextDelta {
  text: string;

  type: 'text_delta';
}

export interface TextEditorCodeExecutionCreateResultBlock {
  is_file_update: boolean;

  type: 'text_editor_code_execution_create_result';
}

export interface TextEditorCodeExecutionCreateResultBlockParam {
  is_file_update: boolean;

  type: 'text_editor_code_execution_create_result';
}

export interface TextEditorCodeExecutionStrReplaceResultBlock {
  lines: Array<string> | null;

  new_lines: number | null;

  new_start: number | null;

  old_lines: number | null;

  old_start: number | null;

  type: 'text_editor_code_execution_str_replace_result';
}

export interface TextEditorCodeExecutionStrReplaceResultBlockParam {
  type: 'text_editor_code_execution_str_replace_result';

  lines?: Array<string> | null;

  new_lines?: number | null;

  new_start?: number | null;

  old_lines?: number | null;

  old_start?: number | null;
}

export interface TextEditorCodeExecutionToolResultBlock {
  content:
    | TextEditorCodeExecutionToolResultError
    | TextEditorCodeExecutionViewResultBlock
    | TextEditorCodeExecutionCreateResultBlock
    | TextEditorCodeExecutionStrReplaceResultBlock;

  tool_use_id: string;

  type: 'text_editor_code_execution_tool_result';
}

export interface TextEditorCodeExecutionToolResultBlockParam {
  content:
    | TextEditorCodeExecutionToolResultErrorParam
    | TextEditorCodeExecutionViewResultBlockParam
    | TextEditorCodeExecutionCreateResultBlockParam
    | TextEditorCodeExecutionStrReplaceResultBlockParam;

  tool_use_id: string;

  type: 'text_editor_code_execution_tool_result';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;
}

export interface TextEditorCodeExecutionToolResultError {
  error_code: TextEditorCodeExecutionToolResultErrorCode;

  error_message: string | null;

  type: 'text_editor_code_execution_tool_result_error';
}

export type TextEditorCodeExecutionToolResultErrorCode =
  | 'invalid_tool_input'
  | 'unavailable'
  | 'too_many_requests'
  | 'execution_time_exceeded'
  | 'file_not_found';

export interface TextEditorCodeExecutionToolResultErrorParam {
  error_code: TextEditorCodeExecutionToolResultErrorCode;

  type: 'text_editor_code_execution_tool_result_error';

  error_message?: string | null;
}

export interface TextEditorCodeExecutionViewResultBlock {
  content: string;

  file_type: 'text' | 'image' | 'pdf';

  num_lines: number | null;

  start_line: number | null;

  total_lines: number | null;

  type: 'text_editor_code_execution_view_result';
}

export interface TextEditorCodeExecutionViewResultBlockParam {
  content: string;

  file_type: 'text' | 'image' | 'pdf';

  type: 'text_editor_code_execution_view_result';

  num_lines?: number | null;

  start_line?: number | null;

  total_lines?: number | null;
}

export interface ThinkingBlock {
  /**
   * A value used to verify that this thinking block was generated by Claude when it
   * is passed back to the API.
   *
   * This is an opaque field and should not be interpreted or parsed. When passing
   * thinking blocks back to the API (required when using tools with extended
   * thinking), pass them back exactly as received, with this field intact.
   *
   * See
   * [extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
   * for details.
   */
  signature: string;

  /**
   * The text of Claude's thinking process for this block.
   */
  thinking: string;

  type: 'thinking';
}

export interface ThinkingBlockParam {
  /**
   * The `signature` value of this thinking block, exactly as returned by the API in
   * a previous response. Used to verify that the block was generated by Claude.
   *
   * Thinking blocks must be passed back unmodified and in their original order; a
   * modified block results in a 400 `invalid_request_error`.
   */
  signature: string;

  /**
   * The `thinking` text of this block as returned by the API.
   */
  thinking: string;

  type: 'thinking';
}

export interface ThinkingConfigAdaptive {
  type: 'adaptive';

  /**
   * Controls how thinking content appears in the response. When set to `summarized`,
   * thinking is returned normally. When set to `omitted`, thinking content is
   * redacted but a signature is returned for multi-turn continuity. Defaults to
   * `summarized`.
   */
  display?: 'summarized' | 'omitted' | null;
}

export interface ThinkingConfigDisabled {
  type: 'disabled';
}

export interface ThinkingConfigEnabled {
  /**
   * Determines how many tokens Claude can use for its internal reasoning process.
   * Larger budgets can enable more thorough analysis for complex problems, improving
   * response quality.
   *
   * Must be ≥1024 and less than `max_tokens`.
   *
   * See
   * [extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
   * for details.
   */
  budget_tokens: number;

  type: 'enabled';

  /**
   * Controls how thinking content appears in the response. When set to `summarized`,
   * thinking is returned normally. When set to `omitted`, thinking content is
   * redacted but a signature is returned for multi-turn continuity. Defaults to
   * `summarized`.
   */
  display?: 'summarized' | 'omitted' | null;
}

/**
 * Configuration for enabling Claude's extended thinking.
 *
 * When enabled, responses include `thinking` content blocks showing Claude's
 * thinking process before the final answer. Requires a minimum budget of 1,024
 * tokens and counts towards your `max_tokens` limit.
 *
 * See
 * [extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
 * for details.
 */
export type ThinkingConfigParam = ThinkingConfigEnabled | ThinkingConfigDisabled | ThinkingConfigAdaptive;

export interface ThinkingDelta {
  /**
   * The incremental `thinking` text for this content block. Concatenate the
   * `thinking` values of successive `thinking_delta` events to assemble the block's
   * full `thinking` value.
   */
  thinking: string;

  type: 'thinking_delta';
}

export interface Tool {
  /**
   * [JSON schema](https://json-schema.org/draft/2020-12) for this tool's input.
   *
   * This defines the shape of the `input` that your tool accepts and that the model
   * will produce.
   */
  input_schema: Tool.InputSchema;

  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: string;

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * Description of what this tool does.
   *
   * Tool descriptions should be as detailed as possible. The more information that
   * the model has about what the tool is and how to use it, the better it will
   * perform. You can use natural language descriptions to reinforce important
   * aspects of the tool input JSON schema.
   */
  description?: string;

  /**
   * Enable eager input streaming for this tool. When true, tool input parameters
   * will be streamed incrementally as they are generated, and types will be inferred
   * on-the-fly rather than buffering the full JSON output. When false, streaming is
   * disabled for this tool even if the fine-grained-tool-streaming beta is active.
   * When null (default), uses the default behavior based on beta headers.
   */
  eager_input_streaming?: boolean | null;

  input_examples?: Array<{ [key: string]: unknown }>;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;

  type?: 'custom' | null;
}

export namespace Tool {
  /**
   * [JSON schema](https://json-schema.org/draft/2020-12) for this tool's input.
   *
   * This defines the shape of the `input` that your tool accepts and that the model
   * will produce.
   */
  export interface InputSchema {
    type: 'object';

    properties?: unknown | null;

    required?: Array<string> | null;

    [k: string]: unknown;
  }
}

export interface ToolBash20250124 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'bash';

  type: 'bash_20250124';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  input_examples?: Array<{ [key: string]: unknown }>;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

/**
 * How the model should use the provided tools. The model can use a specific tool,
 * any available tool, decide by itself, or not use tools at all.
 */
export type ToolChoice = ToolChoiceAuto | ToolChoiceAny | ToolChoiceTool | ToolChoiceNone;

/**
 * The model will use any available tools.
 */
export interface ToolChoiceAny {
  type: 'any';

  /**
   * Whether to disable parallel tool use.
   *
   * Defaults to `false`. If set to `true`, the model will output exactly one tool
   * use.
   */
  disable_parallel_tool_use?: boolean;
}

/**
 * The model will automatically decide whether to use tools.
 */
export interface ToolChoiceAuto {
  type: 'auto';

  /**
   * Whether to disable parallel tool use.
   *
   * Defaults to `false`. If set to `true`, the model will output at most one tool
   * use.
   */
  disable_parallel_tool_use?: boolean;
}

/**
 * The model will not be allowed to use tools.
 */
export interface ToolChoiceNone {
  type: 'none';
}

/**
 * The model will use the specified tool with `tool_choice.name`.
 */
export interface ToolChoiceTool {
  /**
   * The name of the tool to use.
   */
  name: string;

  type: 'tool';

  /**
   * Whether to disable parallel tool use.
   *
   * Defaults to `false`. If set to `true`, the model will output exactly one tool
   * use.
   */
  disable_parallel_tool_use?: boolean;
}

export interface ToolReferenceBlock {
  tool_name: string;

  type: 'tool_reference';
}

/**
 * Tool reference block that can be included in tool_result content.
 */
export interface ToolReferenceBlockParam {
  tool_name: string;

  type: 'tool_reference';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;
}

export interface ToolResultBlockParam {
  tool_use_id: string;

  type: 'tool_result';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  content?:
    | string
    | Array<
        | TextBlockParam
        | ImageBlockParam
        | SearchResultBlockParam
        | DocumentBlockParam
        | ToolReferenceBlockParam
        | BrowserStateBlockParam
      >;

  is_error?: boolean;

  /**
   * For a toolset member tool_result, the toolset family of the paired tool_use.
   */
  toolset_name?: string | null;
}

export interface ToolSearchToolBm25_20251119 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'tool_search_tool_bm25';

  type: 'tool_search_tool_bm25_20251119' | 'tool_search_tool_bm25';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

export interface ToolSearchToolRegex20251119 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'tool_search_tool_regex';

  type: 'tool_search_tool_regex_20251119' | 'tool_search_tool_regex';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

export interface ToolSearchToolResultBlock {
  content: ToolSearchToolResultError | ToolSearchToolSearchResultBlock;

  tool_use_id: string;

  type: 'tool_search_tool_result';
}

export interface ToolSearchToolResultBlockParam {
  content: ToolSearchToolResultErrorParam | ToolSearchToolSearchResultBlockParam;

  tool_use_id: string;

  type: 'tool_search_tool_result';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;
}

export interface ToolSearchToolResultError {
  error_code: ToolSearchToolResultErrorCode;

  error_message: string | null;

  type: 'tool_search_tool_result_error';
}

export type ToolSearchToolResultErrorCode =
  | 'invalid_tool_input'
  | 'unavailable'
  | 'too_many_requests'
  | 'execution_time_exceeded';

export interface ToolSearchToolResultErrorParam {
  error_code: ToolSearchToolResultErrorCode;

  type: 'tool_search_tool_result_error';

  error_message?: string | null;
}

export interface ToolSearchToolSearchResultBlock {
  tool_references: Array<ToolReferenceBlock>;

  type: 'tool_search_tool_search_result';
}

export interface ToolSearchToolSearchResultBlockParam {
  tool_references: Array<ToolReferenceBlockParam>;

  type: 'tool_search_tool_search_result';
}

export interface ToolTextEditor20250124 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'str_replace_editor';

  type: 'text_editor_20250124';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  input_examples?: Array<{ [key: string]: unknown }>;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

export interface ToolTextEditor20250429 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'str_replace_based_edit_tool';

  type: 'text_editor_20250429';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  input_examples?: Array<{ [key: string]: unknown }>;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

export interface ToolTextEditor20250728 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'str_replace_based_edit_tool';

  type: 'text_editor_20250728';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  input_examples?: Array<{ [key: string]: unknown }>;

  /**
   * Maximum number of characters to display when viewing a file. If not specified,
   * defaults to displaying the full file.
   */
  max_characters?: number | null;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

/**
 * Code execution tool with REPL state persistence (daemon mode + gVisor
 * checkpoint).
 */
export type ToolUnion =
  | Tool
  | ToolBash20250124
  | CodeExecutionTool20250522
  | CodeExecutionTool20250825
  | CodeExecutionTool20260120
  | CodeExecutionTool20260521
  | BrowserToolset20260801
  | MemoryTool20250818
  | ComputerToolset20260801
  | ToolTextEditor20250124
  | ToolTextEditor20250429
  | ToolTextEditor20250728
  | WebSearchTool20250305
  | WebFetchTool20250910
  | WebSearchTool20260209
  | WebFetchTool20260209
  | WebFetchTool20260309
  | WebSearchTool20260318
  | WebFetchTool20260318
  | ToolSearchToolBm25_20251119
  | ToolSearchToolRegex20251119;

export interface ToolUseBlock {
  id: string;

  /**
   * Tool invocation directly from the model.
   */
  caller: DirectCaller | ServerToolCaller | ServerToolCaller20260120;

  input: unknown;

  name: string;

  type: 'tool_use';

  /**
   * For a toolset member tool_use, the toolset family.
   */
  toolset_name?: string | null;
}

export interface ToolUseBlockParam {
  id: string;

  input: unknown;

  name: string;

  type: 'tool_use';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Tool invocation directly from the model.
   */
  caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;

  /**
   * For a toolset member tool_use, the toolset family this member belongs to.
   */
  toolset_name?: string | null;
}

export interface URLImageSource {
  type: 'url';

  url: string;
}

export interface URLPDFSource {
  type: 'url';

  url: string;
}

export interface Usage {
  /**
   * Breakdown of cached tokens by TTL
   */
  cache_creation: CacheCreation | null;

  /**
   * The number of input tokens used to create the cache entry.
   */
  cache_creation_input_tokens: number | null;

  /**
   * The number of input tokens read from the cache.
   */
  cache_read_input_tokens: number | null;

  /**
   * The geographic region where inference was performed for this request.
   */
  inference_geo: string | null;

  /**
   * The number of input tokens which were used.
   */
  input_tokens: number;

  /**
   * The number of output tokens which were used.
   */
  output_tokens: number;

  /**
   * Breakdown of output tokens by category.
   *
   * `output_tokens` remains the inclusive, authoritative total used for billing.
   * This object provides a read-only decomposition for observability — for example,
   * how many of the billed output tokens were spent on internal reasoning that may
   * have been summarized before being returned to you.
   */
  output_tokens_details: OutputTokensDetails | null;

  /**
   * The number of server tool requests.
   */
  server_tool_use: ServerToolUsage | null;

  /**
   * If the request used the priority, standard, or batch tier.
   */
  service_tier: 'standard' | 'priority' | 'batch' | null;
}

export interface UserLocation {
  type: 'approximate';

  /**
   * The city of the user.
   */
  city?: string | null;

  /**
   * The two letter
   * [ISO country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) of the
   * user.
   */
  country?: string | null;

  /**
   * The region of the user.
   */
  region?: string | null;

  /**
   * The [IANA timezone](https://nodatime.org/TimeZones) of the user.
   */
  timezone?: string | null;
}

export interface WebFetchBlock {
  content: DocumentBlock;

  /**
   * ISO 8601 timestamp when the content was retrieved
   */
  retrieved_at: string | null;

  type: 'web_fetch_result';

  /**
   * Fetched content URL
   */
  url: string;
}

export interface WebFetchBlockParam {
  content: DocumentBlockParam;

  type: 'web_fetch_result';

  /**
   * Fetched content URL
   */
  url: string;

  /**
   * ISO 8601 timestamp when the content was retrieved
   */
  retrieved_at?: string | null;
}

export interface WebFetchTool20250910 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'web_fetch';

  type: 'web_fetch_20250910';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * List of domains to allow fetching from
   */
  allowed_domains?: Array<string> | null;

  /**
   * List of domains to block fetching from
   */
  blocked_domains?: Array<string> | null;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Citations configuration for fetched documents. Citations are disabled by
   * default.
   */
  citations?: CitationsConfigParam | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * Maximum number of tokens used by including web page text content in the context.
   * The limit is approximate and does not apply to binary content such as PDFs.
   */
  max_content_tokens?: number | null;

  /**
   * Maximum number of times the tool can be used in the API request.
   */
  max_uses?: number | null;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

export interface WebFetchTool20260209 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'web_fetch';

  type: 'web_fetch_20260209';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * List of domains to allow fetching from
   */
  allowed_domains?: Array<string> | null;

  /**
   * List of domains to block fetching from
   */
  blocked_domains?: Array<string> | null;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Citations configuration for fetched documents. Citations are disabled by
   * default.
   */
  citations?: CitationsConfigParam | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * Maximum number of tokens used by including web page text content in the context.
   * The limit is approximate and does not apply to binary content such as PDFs.
   */
  max_content_tokens?: number | null;

  /**
   * Maximum number of times the tool can be used in the API request.
   */
  max_uses?: number | null;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;
}

/**
 * Web fetch tool with use_cache parameter for bypassing cached content.
 */
export interface WebFetchTool20260309 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'web_fetch';

  type: 'web_fetch_20260309';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * List of domains to allow fetching from
   */
  allowed_domains?: Array<string> | null;

  /**
   * List of domains to block fetching from
   */
  blocked_domains?: Array<string> | null;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Citations configuration for fetched documents. Citations are disabled by
   * default.
   */
  citations?: CitationsConfigParam | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * Maximum number of tokens used by including web page text content in the context.
   * The limit is approximate and does not apply to binary content such as PDFs.
   */
  max_content_tokens?: number | null;

  /**
   * Maximum number of times the tool can be used in the API request.
   */
  max_uses?: number | null;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;

  /**
   * Whether to use cached content. Set to false to bypass the cache and fetch fresh
   * content. Only set to false when the user explicitly requests fresh content or
   * when fetching rapidly-changing sources.
   */
  use_cache?: boolean;
}

export interface WebFetchTool20260318 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'web_fetch';

  type: 'web_fetch_20260318';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * List of domains to allow fetching from
   */
  allowed_domains?: Array<string> | null;

  /**
   * List of domains to block fetching from
   */
  blocked_domains?: Array<string> | null;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Citations configuration for fetched documents. Citations are disabled by
   * default.
   */
  citations?: CitationsConfigParam | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * Maximum number of tokens used by including web page text content in the context.
   * The limit is approximate and does not apply to binary content such as PDFs.
   */
  max_content_tokens?: number | null;

  /**
   * Maximum number of times the tool can be used in the API request.
   */
  max_uses?: number | null;

  /**
   * How this tool's result blocks appear in the API response when the result was
   * consumed by a completed code_execution call in the same turn. 'full' returns the
   * complete content (default). 'excluded' drops the nested server_tool_use and
   * result block pair entirely. Results from direct calls, or from code_execution
   * calls that paused before completing, are always returned in full so they can be
   * sent back on the next turn.
   */
  response_inclusion?: 'full' | 'excluded';

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;

  /**
   * Whether to use cached content. Set to false to bypass the cache and fetch fresh
   * content. Only set to false when the user explicitly requests fresh content or
   * when fetching rapidly-changing sources.
   */
  use_cache?: boolean;
}

export interface WebFetchToolResultBlock {
  /**
   * Tool invocation directly from the model.
   */
  caller: DirectCaller | ServerToolCaller | ServerToolCaller20260120;

  content: WebFetchToolResultErrorBlock | WebFetchBlock;

  tool_use_id: string;

  type: 'web_fetch_tool_result';
}

export interface WebFetchToolResultBlockParam {
  content: WebFetchToolResultErrorBlockParam | WebFetchBlockParam;

  tool_use_id: string;

  type: 'web_fetch_tool_result';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Tool invocation directly from the model.
   */
  caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export interface WebFetchToolResultErrorBlock {
  error_code: WebFetchToolResultErrorCode;

  type: 'web_fetch_tool_result_error';
}

export interface WebFetchToolResultErrorBlockParam {
  error_code: WebFetchToolResultErrorCode;

  type: 'web_fetch_tool_result_error';
}

export type WebFetchToolResultErrorCode =
  | 'invalid_tool_input'
  | 'url_too_long'
  | 'url_not_allowed'
  | 'url_not_in_prior_context'
  | 'url_not_accessible'
  | 'unsupported_content_type'
  | 'too_many_requests'
  | 'max_uses_exceeded'
  | 'unavailable';

export interface WebSearchResultBlock {
  encrypted_content: string;

  page_age: string | null;

  title: string;

  type: 'web_search_result';

  url: string;
}

export interface WebSearchResultBlockParam {
  encrypted_content: string;

  title: string;

  type: 'web_search_result';

  url: string;

  page_age?: string | null;
}

export interface WebSearchTool20250305 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'web_search';

  type: 'web_search_20250305';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * If provided, only these domains will be included in results. Cannot be used
   * alongside `blocked_domains`.
   */
  allowed_domains?: Array<string> | null;

  /**
   * If provided, these domains will never appear in results. Cannot be used
   * alongside `allowed_domains`.
   */
  blocked_domains?: Array<string> | null;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * Maximum number of times the tool can be used in the API request.
   */
  max_uses?: number | null;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;

  /**
   * Parameters for the user's location. Used to provide more relevant search
   * results.
   */
  user_location?: UserLocation | null;
}

// backward compat
export namespace WebSearchTool20250305 {
  /**
   * @deprecated Import `UserLocation` from `anthropic` directly instead of using
   *   `WebSearchTool20250305.UserLocation`.
   */
  export type UserLocation = Messages.UserLocation;
}

export interface WebSearchTool20260209 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'web_search';

  type: 'web_search_20260209';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * If provided, only these domains will be included in results. Cannot be used
   * alongside `blocked_domains`.
   */
  allowed_domains?: Array<string> | null;

  /**
   * If provided, these domains will never appear in results. Cannot be used
   * alongside `allowed_domains`.
   */
  blocked_domains?: Array<string> | null;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * Maximum number of times the tool can be used in the API request.
   */
  max_uses?: number | null;

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;

  /**
   * Parameters for the user's location. Used to provide more relevant search
   * results.
   */
  user_location?: UserLocation | null;
}

// backward compat
export namespace WebSearchTool20260209 {
  /**
   * @deprecated Import `UserLocation` from `anthropic` directly instead of using
   *   `WebSearchTool20260209.UserLocation`.
   */
  export type UserLocation = Messages.UserLocation;
}

export interface WebSearchTool20260318 {
  /**
   * Name of the tool.
   *
   * This is how the tool will be called by the model and in `tool_use` blocks.
   */
  name: 'web_search';

  type: 'web_search_20260318';

  allowed_callers?: Array<
    'direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521'
  >;

  /**
   * If provided, only these domains will be included in results. Cannot be used
   * alongside `blocked_domains`.
   */
  allowed_domains?: Array<string> | null;

  /**
   * If provided, these domains will never appear in results. Cannot be used
   * alongside `allowed_domains`.
   */
  blocked_domains?: Array<string> | null;

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  defer_loading?: boolean;

  /**
   * Maximum number of times the tool can be used in the API request.
   */
  max_uses?: number | null;

  /**
   * How this tool's result blocks appear in the API response when the result was
   * consumed by a completed code_execution call in the same turn. 'full' returns the
   * complete content (default). 'excluded' drops the nested server_tool_use and
   * result block pair entirely. Results from direct calls, or from code_execution
   * calls that paused before completing, are always returned in full so they can be
   * sent back on the next turn.
   */
  response_inclusion?: 'full' | 'excluded';

  /**
   * When true, guarantees schema validation on tool names and inputs
   */
  strict?: boolean;

  /**
   * Parameters for the user's location. Used to provide more relevant search
   * results.
   */
  user_location?: UserLocation | null;
}

export interface WebSearchToolRequestError {
  error_code: WebSearchToolResultErrorCode;

  type: 'web_search_tool_result_error';
}

export interface WebSearchToolResultBlock {
  /**
   * Tool invocation directly from the model.
   */
  caller: DirectCaller | ServerToolCaller | ServerToolCaller20260120;

  content: WebSearchToolResultBlockContent;

  tool_use_id: string;

  type: 'web_search_tool_result';
}

export type WebSearchToolResultBlockContent = WebSearchToolResultError | Array<WebSearchResultBlock>;

export interface WebSearchToolResultBlockParam {
  content: WebSearchToolResultBlockParamContent;

  tool_use_id: string;

  type: 'web_search_tool_result';

  /**
   * Create a cache control breakpoint at this content block.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Tool invocation directly from the model.
   */
  caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export type WebSearchToolResultBlockParamContent =
  | Array<WebSearchResultBlockParam>
  | WebSearchToolRequestError;

export interface WebSearchToolResultError {
  error_code: WebSearchToolResultErrorCode;

  type: 'web_search_tool_result_error';
}

export type WebSearchToolResultErrorCode =
  | 'invalid_tool_input'
  | 'unavailable'
  | 'max_uses_exceeded'
  | 'too_many_requests'
  | 'query_too_long'
  | 'request_too_large';

export type MessageStreamEvent = RawMessageStreamEvent;

export type MessageStartEvent = RawMessageStartEvent;

export type MessageDeltaEvent = RawMessageDeltaEvent;

export type MessageStopEvent = RawMessageStopEvent;

export type ContentBlockStartEvent = RawContentBlockStartEvent;

export type ContentBlockDeltaEvent = RawContentBlockDeltaEvent;

export type ContentBlockStopEvent = RawContentBlockStopEvent;

export type MessageCreateParams = MessageCreateParamsNonStreaming | MessageCreateParamsStreaming;

export interface MessageCreateParamsBase {
  /**
   * Body param: The maximum number of tokens to generate before stopping.
   *
   * Note that our models may stop _before_ reaching this maximum. This parameter
   * only specifies the absolute maximum number of tokens to generate.
   *
   * Set to `0` to populate the
   * [prompt cache](https://platform.claude.com/docs/en/build-with-claude/prompt-caching#pre-warming-the-cache)
   * without generating a response.
   *
   * Different models have different maximum values for this parameter. See
   * [models](https://platform.claude.com/docs/en/about-claude/models/overview) for
   * details.
   */
  max_tokens: number;

  /**
   * Body param: Input messages.
   *
   * Our models are trained to operate on alternating `user` and `assistant`
   * conversational turns. When creating a new `Message`, you specify the prior
   * conversational turns with the `messages` parameter, and the model then generates
   * the next `Message` in the conversation. Consecutive `user` or `assistant` turns
   * in your request will be combined into a single turn.
   *
   * Each input message must be an object with a `role` and `content`. You can
   * specify a single `user`-role message, or you can include multiple `user` and
   * `assistant` messages.
   *
   * If the final message uses the `assistant` role, the response content will
   * continue immediately from the content in that message. This can be used to
   * constrain part of the model's response.
   *
   * Example with a single `user` message:
   *
   * ```json
   * [{ "role": "user", "content": "Hello, Claude" }]
   * ```
   *
   * Example with multiple conversational turns:
   *
   * ```json
   * [
   *   { "role": "user", "content": "Hello there." },
   *   { "role": "assistant", "content": "Hi, I'm Claude. How can I help you?" },
   *   { "role": "user", "content": "Can you explain LLMs in plain English?" }
   * ]
   * ```
   *
   * Example with a partially-filled response from Claude:
   *
   * ```json
   * [
   *   {
   *     "role": "user",
   *     "content": "What's the Greek name for Sun? (A) Sol (B) Helios (C) Sun"
   *   },
   *   { "role": "assistant", "content": "The best answer is (" }
   * ]
   * ```
   *
   * Each input message `content` may be either a single `string` or an array of
   * content blocks, where each block has a specific `type`. Using a `string` for
   * `content` is shorthand for an array of one content block of type `"text"`. The
   * following input messages are equivalent:
   *
   * ```json
   * { "role": "user", "content": "Hello, Claude" }
   * ```
   *
   * ```json
   * { "role": "user", "content": [{ "type": "text", "text": "Hello, Claude" }] }
   * ```
   *
   * See
   * [input examples](https://platform.claude.com/docs/en/build-with-claude/working-with-messages).
   *
   * Note that if you want to include a
   * [system prompt](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#give-claude-a-role),
   * you can use the top-level `system` parameter — there is no `"system"` role for
   * input messages in the Messages API.
   *
   * There is a limit of 100,000 messages in a single request.
   */
  messages: Array<MessageParam>;

  /**
   * Body param: The model that will complete your prompt.
   *
   * See [models](https://docs.anthropic.com/en/docs/models-overview) for additional
   * details and options.
   */
  model: Model;

  /**
   * Body param: Top-level cache control automatically applies a cache_control marker
   * to the last cacheable block in the request.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Body param: Container identifier for reuse across requests.
   */
  container?: MessageCreateParamsContainer | null;

  /**
   * Body param: Specifies the geographic region for inference processing. If not
   * specified, the workspace's `default_inference_geo` is used.
   */
  inference_geo?: string | null;

  /**
   * Body param: An object describing metadata about the request.
   */
  metadata?: Metadata;

  /**
   * Body param: Configuration options for the model's output, such as the output
   * format.
   */
  output_config?: OutputConfig;

  /**
   * Body param: Determines whether to use priority capacity (if available) or
   * standard capacity for this request.
   *
   * Anthropic offers different levels of service for your API requests. See
   * [service-tiers](https://platform.claude.com/docs/en/api/service-tiers) for
   * details.
   */
  service_tier?: 'auto' | 'standard_only';

  /**
   * Body param: Custom text sequences that will cause the model to stop generating.
   *
   * Our models will normally stop when they have naturally completed their turn,
   * which will result in a response `stop_reason` of `"end_turn"`.
   *
   * If you want the model to stop generating when it encounters custom strings of
   * text, you can use the `stop_sequences` parameter. If the model encounters one of
   * the custom sequences, the response `stop_reason` value will be `"stop_sequence"`
   * and the response `stop_sequence` value will contain the matched stop sequence.
   */
  stop_sequences?: Array<string>;

  /**
   * Body param: Whether to incrementally stream the response using server-sent
   * events.
   *
   * See [streaming](https://platform.claude.com/docs/en/build-with-claude/streaming)
   * for details.
   */
  stream?: boolean;

  /**
   * Body param: System prompt.
   *
   * A system prompt is a way of providing context and instructions to Claude, such
   * as specifying a particular goal or role. See our
   * [guide to system prompts](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#give-claude-a-role).
   */
  system?: string | Array<TextBlockParam>;

  /**
   * @deprecated Deprecated. Models released after Claude Opus 4.6 do not support
   * setting temperature. A value of 1.0 of will be accepted for backwards
   * compatibility, all other values will be rejected with a 400 error.
   */
  temperature?: number;

  /**
   * Body param: Configuration for enabling Claude's extended thinking.
   *
   * When enabled, responses include `thinking` content blocks showing Claude's
   * thinking process before the final answer. Requires a minimum budget of 1,024
   * tokens and counts towards your `max_tokens` limit.
   *
   * See
   * [extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
   * for details.
   */
  thinking?: ThinkingConfigParam;

  /**
   * Body param: How the model should use the provided tools. The model can use a
   * specific tool, any available tool, decide by itself, or not use tools at all.
   */
  tool_choice?: ToolChoice;

  /**
   * Body param: Definitions of tools that the model may use.
   *
   * If you include `tools` in your API request, the model may return `tool_use`
   * content blocks that represent the model's use of those tools. You can then run
   * those tools using the tool input generated by the model and then optionally
   * return results back to the model using `tool_result` content blocks.
   *
   * There are two types of tools: **client tools** and **server tools**. The
   * behavior described below applies to client tools. For
   * [server tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools),
   * see their individual documentation as each has its own behavior (e.g., the
   * [web search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)).
   *
   * Each tool definition includes:
   *
   * - `name`: Name of the tool.
   * - `description`: Optional, but strongly-recommended description of the tool.
   * - `input_schema`: [JSON schema](https://json-schema.org/draft/2020-12) for the
   *   tool `input` shape that the model will produce in `tool_use` output content
   *   blocks.
   *
   * For example, if you defined `tools` as:
   *
   * ```json
   * [
   *   {
   *     "name": "get_stock_price",
   *     "description": "Get the current stock price for a given ticker symbol.",
   *     "input_schema": {
   *       "type": "object",
   *       "properties": {
   *         "ticker": {
   *           "type": "string",
   *           "description": "The stock ticker symbol, e.g. AAPL for Apple Inc."
   *         }
   *       },
   *       "required": ["ticker"]
   *     }
   *   }
   * ]
   * ```
   *
   * And then asked the model "What's the S&P 500 at today?", the model might produce
   * `tool_use` content blocks in the response like this:
   *
   * ```json
   * [
   *   {
   *     "type": "tool_use",
   *     "id": "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
   *     "name": "get_stock_price",
   *     "input": { "ticker": "^GSPC" }
   *   }
   * ]
   * ```
   *
   * You might then run your `get_stock_price` tool with `{"ticker": "^GSPC"}` as an
   * input, and return the following back to the model in a subsequent `user`
   * message:
   *
   * ```json
   * [
   *   {
   *     "type": "tool_result",
   *     "tool_use_id": "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
   *     "content": "259.75 USD"
   *   }
   * ]
   * ```
   *
   * Tools can be used for workflows that include running client-side tools and
   * functions, or more generally whenever you want the model to produce a particular
   * JSON structure of output.
   *
   * See our
   * [guide](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
   * for more details.
   */
  tools?: Array<ToolUnion>;

  /**
   * @deprecated Deprecated. Models released after Claude Opus 4.6 do not accept
   * top_k; any value will be rejected with a 400 error.
   */
  top_k?: number;

  /**
   * @deprecated Deprecated. Models released after Claude Opus 4.6 do not support
   * setting top_p. A value >= 0.99 will be accepted for backwards compatibility, all
   * other values will be rejected with a 400 error.
   */
  top_p?: number;

  /**
   * Header param: The user profile ID to attribute this request to. Use when acting
   * on behalf of a party other than your organization. Requires the `user-profiles`
   * beta header.
   */
  user_profile_id?: string;
}

export namespace MessageCreateParams {
  export type MessageCreateParamsNonStreaming = MessagesAPI.MessageCreateParamsNonStreaming;
  export type MessageCreateParamsStreaming = MessagesAPI.MessageCreateParamsStreaming;
}

export interface MessageCreateParamsNonStreaming extends MessageCreateParamsBase {
  /**
   * Body param: Whether to incrementally stream the response using server-sent
   * events.
   *
   * See [streaming](https://platform.claude.com/docs/en/build-with-claude/streaming)
   * for details.
   */
  stream?: false;
}

export interface MessageCreateParamsStreaming extends MessageCreateParamsBase {
  /**
   * Body param: Whether to incrementally stream the response using server-sent
   * events.
   *
   * See [streaming](https://platform.claude.com/docs/en/build-with-claude/streaming)
   * for details.
   */
  stream: true;
}

export type MessageStreamParams = ParseableMessageCreateParams;

export interface MessageCountTokensParams {
  /**
   * Body param: Input messages.
   *
   * Our models are trained to operate on alternating `user` and `assistant`
   * conversational turns. When creating a new `Message`, you specify the prior
   * conversational turns with the `messages` parameter, and the model then generates
   * the next `Message` in the conversation. Consecutive `user` or `assistant` turns
   * in your request will be combined into a single turn.
   *
   * Each input message must be an object with a `role` and `content`. You can
   * specify a single `user`-role message, or you can include multiple `user` and
   * `assistant` messages.
   *
   * If the final message uses the `assistant` role, the response content will
   * continue immediately from the content in that message. This can be used to
   * constrain part of the model's response.
   *
   * Example with a single `user` message:
   *
   * ```json
   * [{ "role": "user", "content": "Hello, Claude" }]
   * ```
   *
   * Example with multiple conversational turns:
   *
   * ```json
   * [
   *   { "role": "user", "content": "Hello there." },
   *   { "role": "assistant", "content": "Hi, I'm Claude. How can I help you?" },
   *   { "role": "user", "content": "Can you explain LLMs in plain English?" }
   * ]
   * ```
   *
   * Example with a partially-filled response from Claude:
   *
   * ```json
   * [
   *   {
   *     "role": "user",
   *     "content": "What's the Greek name for Sun? (A) Sol (B) Helios (C) Sun"
   *   },
   *   { "role": "assistant", "content": "The best answer is (" }
   * ]
   * ```
   *
   * Each input message `content` may be either a single `string` or an array of
   * content blocks, where each block has a specific `type`. Using a `string` for
   * `content` is shorthand for an array of one content block of type `"text"`. The
   * following input messages are equivalent:
   *
   * ```json
   * { "role": "user", "content": "Hello, Claude" }
   * ```
   *
   * ```json
   * { "role": "user", "content": [{ "type": "text", "text": "Hello, Claude" }] }
   * ```
   *
   * See
   * [input examples](https://platform.claude.com/docs/en/build-with-claude/working-with-messages).
   *
   * Note that if you want to include a
   * [system prompt](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#give-claude-a-role),
   * you can use the top-level `system` parameter — there is no `"system"` role for
   * input messages in the Messages API.
   *
   * There is a limit of 100,000 messages in a single request.
   */
  messages: Array<MessageParam>;

  /**
   * Body param: The model that will complete your prompt.
   *
   * See [models](https://docs.anthropic.com/en/docs/models-overview) for additional
   * details and options.
   */
  model: Model;

  /**
   * Body param: Top-level cache control automatically applies a cache_control marker
   * to the last cacheable block in the request.
   */
  cache_control?: CacheControlEphemeral | null;

  /**
   * Body param: Configuration options for the model's output, such as the output
   * format.
   */
  output_config?: OutputConfig;

  /**
   * Body param: System prompt.
   *
   * A system prompt is a way of providing context and instructions to Claude, such
   * as specifying a particular goal or role. See our
   * [guide to system prompts](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#give-claude-a-role).
   */
  system?: string | Array<TextBlockParam>;

  /**
   * Body param: Configuration for enabling Claude's extended thinking.
   *
   * When enabled, responses include `thinking` content blocks showing Claude's
   * thinking process before the final answer. Requires a minimum budget of 1,024
   * tokens and counts towards your `max_tokens` limit.
   *
   * See
   * [extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
   * for details.
   */
  thinking?: ThinkingConfigParam;

  /**
   * Body param: How the model should use the provided tools. The model can use a
   * specific tool, any available tool, decide by itself, or not use tools at all.
   */
  tool_choice?: ToolChoice;

  /**
   * Body param: Definitions of tools that the model may use.
   *
   * If you include `tools` in your API request, the model may return `tool_use`
   * content blocks that represent the model's use of those tools. You can then run
   * those tools using the tool input generated by the model and then optionally
   * return results back to the model using `tool_result` content blocks.
   *
   * There are two types of tools: **client tools** and **server tools**. The
   * behavior described below applies to client tools. For
   * [server tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools),
   * see their individual documentation as each has its own behavior (e.g., the
   * [web search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)).
   *
   * Each tool definition includes:
   *
   * - `name`: Name of the tool.
   * - `description`: Optional, but strongly-recommended description of the tool.
   * - `input_schema`: [JSON schema](https://json-schema.org/draft/2020-12) for the
   *   tool `input` shape that the model will produce in `tool_use` output content
   *   blocks.
   *
   * For example, if you defined `tools` as:
   *
   * ```json
   * [
   *   {
   *     "name": "get_stock_price",
   *     "description": "Get the current stock price for a given ticker symbol.",
   *     "input_schema": {
   *       "type": "object",
   *       "properties": {
   *         "ticker": {
   *           "type": "string",
   *           "description": "The stock ticker symbol, e.g. AAPL for Apple Inc."
   *         }
   *       },
   *       "required": ["ticker"]
   *     }
   *   }
   * ]
   * ```
   *
   * And then asked the model "What's the S&P 500 at today?", the model might produce
   * `tool_use` content blocks in the response like this:
   *
   * ```json
   * [
   *   {
   *     "type": "tool_use",
   *     "id": "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
   *     "name": "get_stock_price",
   *     "input": { "ticker": "^GSPC" }
   *   }
   * ]
   * ```
   *
   * You might then run your `get_stock_price` tool with `{"ticker": "^GSPC"}` as an
   * input, and return the following back to the model in a subsequent `user`
   * message:
   *
   * ```json
   * [
   *   {
   *     "type": "tool_result",
   *     "tool_use_id": "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
   *     "content": "259.75 USD"
   *   }
   * ]
   * ```
   *
   * Tools can be used for workflows that include running client-side tools and
   * functions, or more generally whenever you want the model to produce a particular
   * JSON structure of output.
   *
   * See our
   * [guide](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
   * for more details.
   */
  tools?: Array<MessageCountTokensTool>;

  /**
   * Header param: The user profile ID to attribute this request to. Use when acting
   * on behalf of a party other than your organization. Requires the `user-profiles`
   * beta header.
   */
  user_profile_id?: string;
}

Messages.Batches = Batches;

export declare namespace Messages {
  export {
    type Base64ImageSource as Base64ImageSource,
    type Base64PDFSource as Base64PDFSource,
    type BashCodeExecutionOutputBlock as BashCodeExecutionOutputBlock,
    type BashCodeExecutionOutputBlockParam as BashCodeExecutionOutputBlockParam,
    type BashCodeExecutionResultBlock as BashCodeExecutionResultBlock,
    type BashCodeExecutionResultBlockParam as BashCodeExecutionResultBlockParam,
    type BashCodeExecutionToolResultBlock as BashCodeExecutionToolResultBlock,
    type BashCodeExecutionToolResultBlockParam as BashCodeExecutionToolResultBlockParam,
    type BashCodeExecutionToolResultError as BashCodeExecutionToolResultError,
    type BashCodeExecutionToolResultErrorCode as BashCodeExecutionToolResultErrorCode,
    type BashCodeExecutionToolResultErrorParam as BashCodeExecutionToolResultErrorParam,
    type BrowserCloseTabConfig as BrowserCloseTabConfig,
    type BrowserDoubleClickConfig as BrowserDoubleClickConfig,
    type BrowserFileUploadConfig as BrowserFileUploadConfig,
    type BrowserFindConfig as BrowserFindConfig,
    type BrowserFormInputConfig as BrowserFormInputConfig,
    type BrowserGetPageTextConfig as BrowserGetPageTextConfig,
    type BrowserHoldKeyConfig as BrowserHoldKeyConfig,
    type BrowserHoverConfig as BrowserHoverConfig,
    type BrowserJavascriptExecConfig as BrowserJavascriptExecConfig,
    type BrowserKeyConfig as BrowserKeyConfig,
    type BrowserLeftClickConfig as BrowserLeftClickConfig,
    type BrowserLeftClickDragConfig as BrowserLeftClickDragConfig,
    type BrowserLeftMouseDownConfig as BrowserLeftMouseDownConfig,
    type BrowserLeftMouseUpConfig as BrowserLeftMouseUpConfig,
    type BrowserListTabsConfig as BrowserListTabsConfig,
    type BrowserMiddleClickConfig as BrowserMiddleClickConfig,
    type BrowserMouseMoveConfig as BrowserMouseMoveConfig,
    type BrowserNavigateConfig as BrowserNavigateConfig,
    type BrowserNewTabConfig as BrowserNewTabConfig,
    type BrowserReadConsoleConfig as BrowserReadConsoleConfig,
    type BrowserReadNetworkConfig as BrowserReadNetworkConfig,
    type BrowserReadPageConfig as BrowserReadPageConfig,
    type BrowserRightClickConfig as BrowserRightClickConfig,
    type BrowserScreenshotConfig as BrowserScreenshotConfig,
    type BrowserScrollConfig as BrowserScrollConfig,
    type BrowserScrollToConfig as BrowserScrollToConfig,
    type BrowserStateBlockParam as BrowserStateBlockParam,
    type BrowserStateChange as BrowserStateChange,
    type BrowserStateChangeDownloadCompleted as BrowserStateChangeDownloadCompleted,
    type BrowserStateChangeDownloadFailed as BrowserStateChangeDownloadFailed,
    type BrowserStateChangeDownloadStarted as BrowserStateChangeDownloadStarted,
    type BrowserStateChangeTabOpened as BrowserStateChangeTabOpened,
    type BrowserStateTabEntry as BrowserStateTabEntry,
    type BrowserSwitchTabConfig as BrowserSwitchTabConfig,
    type BrowserToolset20260801 as BrowserToolset20260801,
    type BrowserToolsetConfigs as BrowserToolsetConfigs,
    type BrowserTripleClickConfig as BrowserTripleClickConfig,
    type BrowserTypeConfig as BrowserTypeConfig,
    type BrowserWaitConfig as BrowserWaitConfig,
    type BrowserZoomConfig as BrowserZoomConfig,
    type CacheControlEphemeral as CacheControlEphemeral,
    type CacheCreation as CacheCreation,
    type CitationCharLocation as CitationCharLocation,
    type CitationCharLocationParam as CitationCharLocationParam,
    type CitationContentBlockLocation as CitationContentBlockLocation,
    type CitationContentBlockLocationParam as CitationContentBlockLocationParam,
    type CitationPageLocation as CitationPageLocation,
    type CitationPageLocationParam as CitationPageLocationParam,
    type CitationSearchResultLocationParam as CitationSearchResultLocationParam,
    type CitationWebSearchResultLocationParam as CitationWebSearchResultLocationParam,
    type CitationsConfig as CitationsConfig,
    type CitationsConfigParam as CitationsConfigParam,
    type CitationsDelta as CitationsDelta,
    type CitationsSearchResultLocation as CitationsSearchResultLocation,
    type CitationsWebSearchResultLocation as CitationsWebSearchResultLocation,
    type CodeExecutionOutputBlock as CodeExecutionOutputBlock,
    type CodeExecutionOutputBlockParam as CodeExecutionOutputBlockParam,
    type CodeExecutionResultBlock as CodeExecutionResultBlock,
    type CodeExecutionResultBlockParam as CodeExecutionResultBlockParam,
    type CodeExecutionTool20250522 as CodeExecutionTool20250522,
    type CodeExecutionTool20250825 as CodeExecutionTool20250825,
    type CodeExecutionTool20260120 as CodeExecutionTool20260120,
    type CodeExecutionTool20260521 as CodeExecutionTool20260521,
    type CodeExecutionToolResultBlock as CodeExecutionToolResultBlock,
    type CodeExecutionToolResultBlockContent as CodeExecutionToolResultBlockContent,
    type CodeExecutionToolResultBlockParam as CodeExecutionToolResultBlockParam,
    type CodeExecutionToolResultBlockParamContent as CodeExecutionToolResultBlockParamContent,
    type CodeExecutionToolResultError as CodeExecutionToolResultError,
    type CodeExecutionToolResultErrorCode as CodeExecutionToolResultErrorCode,
    type CodeExecutionToolResultErrorParam as CodeExecutionToolResultErrorParam,
    type ComputerCursorPositionConfig as ComputerCursorPositionConfig,
    type ComputerDoubleClickConfig as ComputerDoubleClickConfig,
    type ComputerHoldKeyConfig as ComputerHoldKeyConfig,
    type ComputerKeyConfig as ComputerKeyConfig,
    type ComputerLeftClickConfig as ComputerLeftClickConfig,
    type ComputerLeftClickDragConfig as ComputerLeftClickDragConfig,
    type ComputerLeftMouseDownConfig as ComputerLeftMouseDownConfig,
    type ComputerLeftMouseUpConfig as ComputerLeftMouseUpConfig,
    type ComputerMiddleClickConfig as ComputerMiddleClickConfig,
    type ComputerMouseMoveConfig as ComputerMouseMoveConfig,
    type ComputerRightClickConfig as ComputerRightClickConfig,
    type ComputerScreenshotConfig as ComputerScreenshotConfig,
    type ComputerScrollConfig as ComputerScrollConfig,
    type ComputerToolset20260801 as ComputerToolset20260801,
    type ComputerToolsetConfigs as ComputerToolsetConfigs,
    type ComputerTripleClickConfig as ComputerTripleClickConfig,
    type ComputerTypeConfig as ComputerTypeConfig,
    type ComputerWaitConfig as ComputerWaitConfig,
    type ComputerZoomConfig as ComputerZoomConfig,
    type Container as Container,
    type ContainerParams as ContainerParams,
    type ContainerSkill as ContainerSkill,
    type ContainerUploadBlock as ContainerUploadBlock,
    type ContainerUploadBlockParam as ContainerUploadBlockParam,
    type ContentBlock as ContentBlock,
    type ContentBlockParam as ContentBlockParam,
    type ContentBlockStartEvent as ContentBlockStartEvent,
    type ContentBlockStopEvent as ContentBlockStopEvent,
    type ContentBlockSource as ContentBlockSource,
    type ContentBlockSourceContent as ContentBlockSourceContent,
    type DirectCaller as DirectCaller,
    type DocumentBlock as DocumentBlock,
    type DocumentBlockParam as DocumentBlockParam,
    type EncryptedCodeExecutionResultBlock as EncryptedCodeExecutionResultBlock,
    type EncryptedCodeExecutionResultBlockParam as EncryptedCodeExecutionResultBlockParam,
    type FileDocumentSource as FileDocumentSource,
    type FileImageSource as FileImageSource,
    type ImageBlockParam as ImageBlockParam,
    type ImageTransformationsParam as ImageTransformationsParam,
    type InputJSONDelta as InputJSONDelta,
    type JSONOutputFormat as JSONOutputFormat,
    type MemoryTool20250818 as MemoryTool20250818,
    type Message as Message,
    type MessageCountTokensTool as MessageCountTokensTool,
    type MessageCreateParamsContainer as MessageCreateParamsContainer,
    type MessageDeltaEvent as MessageDeltaEvent,
    type MessageDeltaUsage as MessageDeltaUsage,
    type MessageParam as MessageParam,
    type MessageTokensCount as MessageTokensCount,
    type Metadata as Metadata,
    type Model as Model,
    type OutputConfig as OutputConfig,
    type OutputTokensDetails as OutputTokensDetails,
    type PlainTextSource as PlainTextSource,
    type RawContentBlockDelta as RawContentBlockDelta,
    type RawContentBlockDeltaEvent as RawContentBlockDeltaEvent,
    type RawContentBlockStartEvent as RawContentBlockStartEvent,
    type RawContentBlockStopEvent as RawContentBlockStopEvent,
    type RawMessageDeltaEvent as RawMessageDeltaEvent,
    type RawMessageStartEvent as RawMessageStartEvent,
    type RawMessageStopEvent as RawMessageStopEvent,
    type RawMessageStreamEvent as RawMessageStreamEvent,
    type RedactedThinkingBlock as RedactedThinkingBlock,
    type RedactedThinkingBlockParam as RedactedThinkingBlockParam,
    type RefusalStopDetails as RefusalStopDetails,
    type SearchResultBlockParam as SearchResultBlockParam,
    type ServerToolCaller as ServerToolCaller,
    type ServerToolCaller20260120 as ServerToolCaller20260120,
    type ServerToolUsage as ServerToolUsage,
    type ServerToolUseBlock as ServerToolUseBlock,
    type ServerToolUseBlockParam as ServerToolUseBlockParam,
    type SignatureDelta as SignatureDelta,
    type SkillParams as SkillParams,
    type StopReason as StopReason,
    type TextBlock as TextBlock,
    type TextBlockParam as TextBlockParam,
    type TextCitation as TextCitation,
    type TextCitationParam as TextCitationParam,
    type TextDelta as TextDelta,
    type TextEditorCodeExecutionCreateResultBlock as TextEditorCodeExecutionCreateResultBlock,
    type TextEditorCodeExecutionCreateResultBlockParam as TextEditorCodeExecutionCreateResultBlockParam,
    type TextEditorCodeExecutionStrReplaceResultBlock as TextEditorCodeExecutionStrReplaceResultBlock,
    type TextEditorCodeExecutionStrReplaceResultBlockParam as TextEditorCodeExecutionStrReplaceResultBlockParam,
    type TextEditorCodeExecutionToolResultBlock as TextEditorCodeExecutionToolResultBlock,
    type TextEditorCodeExecutionToolResultBlockParam as TextEditorCodeExecutionToolResultBlockParam,
    type TextEditorCodeExecutionToolResultError as TextEditorCodeExecutionToolResultError,
    type TextEditorCodeExecutionToolResultErrorCode as TextEditorCodeExecutionToolResultErrorCode,
    type TextEditorCodeExecutionToolResultErrorParam as TextEditorCodeExecutionToolResultErrorParam,
    type TextEditorCodeExecutionViewResultBlock as TextEditorCodeExecutionViewResultBlock,
    type TextEditorCodeExecutionViewResultBlockParam as TextEditorCodeExecutionViewResultBlockParam,
    type ThinkingBlock as ThinkingBlock,
    type ThinkingBlockParam as ThinkingBlockParam,
    type ThinkingConfigAdaptive as ThinkingConfigAdaptive,
    type ThinkingConfigDisabled as ThinkingConfigDisabled,
    type ThinkingConfigEnabled as ThinkingConfigEnabled,
    type ThinkingConfigParam as ThinkingConfigParam,
    type ThinkingDelta as ThinkingDelta,
    type Tool as Tool,
    type ToolBash20250124 as ToolBash20250124,
    type ToolChoice as ToolChoice,
    type ToolChoiceAny as ToolChoiceAny,
    type ToolChoiceAuto as ToolChoiceAuto,
    type ToolChoiceNone as ToolChoiceNone,
    type ToolChoiceTool as ToolChoiceTool,
    type ToolReferenceBlock as ToolReferenceBlock,
    type ToolReferenceBlockParam as ToolReferenceBlockParam,
    type ToolResultBlockParam as ToolResultBlockParam,
    type ToolSearchToolBm25_20251119 as ToolSearchToolBm25_20251119,
    type ToolSearchToolRegex20251119 as ToolSearchToolRegex20251119,
    type ToolSearchToolResultBlock as ToolSearchToolResultBlock,
    type ToolSearchToolResultBlockParam as ToolSearchToolResultBlockParam,
    type ToolSearchToolResultError as ToolSearchToolResultError,
    type ToolSearchToolResultErrorCode as ToolSearchToolResultErrorCode,
    type ToolSearchToolResultErrorParam as ToolSearchToolResultErrorParam,
    type ToolSearchToolSearchResultBlock as ToolSearchToolSearchResultBlock,
    type ToolSearchToolSearchResultBlockParam as ToolSearchToolSearchResultBlockParam,
    type ToolTextEditor20250124 as ToolTextEditor20250124,
    type ToolTextEditor20250429 as ToolTextEditor20250429,
    type ToolTextEditor20250728 as ToolTextEditor20250728,
    type ToolUnion as ToolUnion,
    type ToolUseBlock as ToolUseBlock,
    type ToolUseBlockParam as ToolUseBlockParam,
    type URLImageSource as URLImageSource,
    type URLPDFSource as URLPDFSource,
    type Usage as Usage,
    type UserLocation as UserLocation,
    type WebFetchBlock as WebFetchBlock,
    type WebFetchBlockParam as WebFetchBlockParam,
    type WebFetchTool20250910 as WebFetchTool20250910,
    type WebFetchTool20260209 as WebFetchTool20260209,
    type WebFetchTool20260309 as WebFetchTool20260309,
    type WebFetchTool20260318 as WebFetchTool20260318,
    type WebFetchToolResultBlock as WebFetchToolResultBlock,
    type WebFetchToolResultBlockParam as WebFetchToolResultBlockParam,
    type WebFetchToolResultErrorBlock as WebFetchToolResultErrorBlock,
    type WebFetchToolResultErrorBlockParam as WebFetchToolResultErrorBlockParam,
    type WebFetchToolResultErrorCode as WebFetchToolResultErrorCode,
    type WebSearchResultBlock as WebSearchResultBlock,
    type WebSearchResultBlockParam as WebSearchResultBlockParam,
    type WebSearchTool20250305 as WebSearchTool20250305,
    type WebSearchTool20260209 as WebSearchTool20260209,
    type WebSearchTool20260318 as WebSearchTool20260318,
    type WebSearchToolRequestError as WebSearchToolRequestError,
    type WebSearchToolResultBlock as WebSearchToolResultBlock,
    type WebSearchToolResultBlockContent as WebSearchToolResultBlockContent,
    type WebSearchToolResultBlockParam as WebSearchToolResultBlockParam,
    type WebSearchToolResultBlockParamContent as WebSearchToolResultBlockParamContent,
    type WebSearchToolResultError as WebSearchToolResultError,
    type MessageStreamEvent as MessageStreamEvent,
    type MessageStartEvent as MessageStartEvent,
    type MessageStopEvent as MessageStopEvent,
    type ContentBlockDeltaEvent as ContentBlockDeltaEvent,
    type MessageCreateParams as MessageCreateParams,
    type MessageCreateParamsNonStreaming as MessageCreateParamsNonStreaming,
    type MessageCreateParamsStreaming as MessageCreateParamsStreaming,
    type MessageStreamParams as MessageStreamParams,
    type MessageCountTokensParams as MessageCountTokensParams,
  };

  export {
    Batches as Batches,
    type DeletedMessageBatch as DeletedMessageBatch,
    type MessageBatch as MessageBatch,
    type MessageBatchCanceledResult as MessageBatchCanceledResult,
    type MessageBatchErroredResult as MessageBatchErroredResult,
    type MessageBatchExpiredResult as MessageBatchExpiredResult,
    type MessageBatchIndividualResponse as MessageBatchIndividualResponse,
    type MessageBatchRequestCounts as MessageBatchRequestCounts,
    type MessageBatchResult as MessageBatchResult,
    type MessageBatchSucceededResult as MessageBatchSucceededResult,
    type MessageBatchesPage as MessageBatchesPage,
    type BatchCreateParams as BatchCreateParams,
    type BatchListParams as BatchListParams,
  };
}
