import { APIResource } from '../core/resource';
import * as BetaAPI from './beta/beta';
import { APIPromise } from '../core/api-promise';
import { Page, type PageParams, PagePromise } from '../core/pagination';
import { buildHeaders } from '../internal/headers';
import { RequestOptions } from '../internal/request-options';
import { path } from '../internal/utils/path';

export class Models extends APIResource {
  /**
   * Get a specific model.
   *
   * The Models API response can be used to determine information about a specific
   * model or resolve a model alias to a model ID.
   *
   * @example
   * ```ts
   * const modelInfo = await client.models.retrieve('model_id');
   * ```
   */
  retrieve(
    modelID: string,
    params: ModelRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ModelInfo> {
    const { betas, workspace_id } = params ?? {};
    return this._client.get(path`/v1/models/${modelID}`, {
      ...options,
      headers: buildHeaders([
        {
          ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }

  /**
   * List available models.
   *
   * The Models API response can be used to determine which models are available for
   * use in the API. More recently released models are listed first.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const modelInfo of client.models.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: ModelListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<ModelInfosPage, ModelInfo> {
    const { betas, workspace_id, ...query } = params ?? {};
    return this._client.getAPIList('/v1/models', Page<ModelInfo>, {
      query,
      ...options,
      headers: buildHeaders([
        {
          ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
    });
  }
}

export type ModelInfosPage = Page<ModelInfo>;

/**
 * Indicates whether a capability is supported.
 */
export interface CapabilitySupport {
  /**
   * Whether this capability is supported by the model.
   */
  supported: boolean;
}

/**
 * Context management capability details.
 */
export interface ContextManagementCapability {
  /**
   * Whether the clear_thinking_20251015 strategy is supported.
   */
  clear_thinking_20251015: CapabilitySupport | null;

  /**
   * Whether the clear_tool_uses_20250919 strategy is supported.
   */
  clear_tool_uses_20250919: CapabilitySupport | null;

  /**
   * Whether the compact_20260112 strategy is supported.
   */
  compact_20260112: CapabilitySupport | null;

  /**
   * Whether this capability is supported by the model.
   */
  supported: boolean;
}

/**
 * Effort (reasoning_effort) capability details.
 */
export interface EffortCapability {
  /**
   * Whether the model supports high effort level.
   */
  high: CapabilitySupport;

  /**
   * Whether the model supports low effort level.
   */
  low: CapabilitySupport;

  /**
   * Whether the model supports max effort level.
   */
  max: CapabilitySupport;

  /**
   * Whether the model supports medium effort level.
   */
  medium: CapabilitySupport;

  /**
   * Whether this capability is supported by the model.
   */
  supported: boolean;

  /**
   * Whether the model supports xhigh effort level.
   */
  xhigh: CapabilitySupport | null;
}

/**
 * Model capability information.
 */
export interface ModelCapabilities {
  /**
   * Whether the model supports the Batch API.
   */
  batch: CapabilitySupport;

  /**
   * Whether the model supports citation generation.
   */
  citations: CapabilitySupport;

  /**
   * Whether code that the model runs in the code execution tool can call the
   * request's other tools, as in programmatic tool calling and dynamic filtering for
   * web search and web fetch. Support for the code execution tool itself is in
   * `server_tools.code_execution`.
   */
  code_execution: CapabilitySupport;

  /**
   * Context management support and available strategies.
   */
  context_management: ContextManagementCapability;

  /**
   * Effort (reasoning_effort) support and available levels.
   */
  effort: EffortCapability;

  /**
   * Whether the model accepts image content blocks.
   */
  image_input: CapabilitySupport;

  /**
   * Whether the model accepts PDF content blocks.
   */
  pdf_input: CapabilitySupport;

  /**
   * Whether this model supports the web search and code execution server tools.
   * `supported` is true when the model supports at least one of the tools. A
   * supported tool can still be rejected for your organization, for example when an
   * admin has turned web search off.
   */
  server_tools: ServerToolsCapability;

  /**
   * Whether the model supports structured output / JSON mode / strict tool schemas.
   */
  structured_outputs: CapabilitySupport;

  /**
   * Thinking capability and supported type configurations.
   */
  thinking: ThinkingCapability;
}

export interface ModelInfo {
  /**
   * Unique model identifier.
   */
  id: string;

  /**
   * Object mapping capability names to their support details. Keys are always
   * present for all known capabilities.
   */
  capabilities: ModelCapabilities | null;

  /**
   * RFC 3339 datetime string representing the time at which the model was released.
   * May be set to an epoch value if the release date is unknown.
   */
  created_at: string;

  /**
   * RFC 3339 datetime string representing the time of the model's most recent
   * deprecation. Populated for `deprecated` and `retired` models; `null` while the
   * model is `active`.
   */
  deprecated_at: string | null;

  /**
   * A human-readable name for the model.
   */
  display_name: string;

  /**
   * The model's current lifecycle stage.
   *
   * - `active`: The model is available for use, open to new adopters, and not
   *   scheduled for retirement.
   * - `deprecated`: The model remains callable for organizations with existing
   *   access, but is headed for retirement and closed to new adopters.
   * - `retired`: The model is no longer available for use; inference requests naming
   *   it fail. It remains in the catalogue as the historical record of its
   *   retirement.
   */
  lifecycle: 'active' | 'deprecated' | 'retired';

  /**
   * The model line this model belongs to, such as `opus` for both Claude Opus 4.5
   * and Claude Opus 4.6. More lines may be added. `null` when the model belongs to
   * no line; do not infer a line from the `id`.
   */
  line: ModelLine | null;

  /**
   * Maximum input context window size in tokens for this model.
   */
  max_input_tokens: number | null;

  /**
   * Maximum value for the `max_tokens` parameter when using this model.
   */
  max_tokens: number | null;

  /**
   * RFC 3339 datetime string representing the model's currently scheduled retirement
   * date. The schedule can be revised until retirement occurs; `null` while the
   * model is `active` or while no retirement is scheduled. A past date on a
   * `deprecated` model means retirement is overdue, not that it has occurred:
   * `lifecycle` is the retirement signal.
   */
  retires_at: string | null;

  /**
   * Object type.
   *
   * For Models, this is always `"model"`.
   */
  type: 'model';
}

/**
 * A Claude model line, such as `opus` or `sonnet`. More lines may be added as new
 * values.
 */
export type ModelLine = 'haiku' | 'sonnet' | 'opus' | 'fable' | 'mythos';

/**
 * Web search and code execution tool support, with one entry per tool.
 */
export interface ServerToolsCapability {
  /**
   * Whether the model supports the code execution tool: true when the model supports
   * at least one version of the tool, not necessarily every version.
   */
  code_execution: CapabilitySupport;

  /**
   * Whether this capability is supported by the model.
   */
  supported: boolean;

  /**
   * Whether the model supports the web search tool: true when the model supports at
   * least one version of the tool, not necessarily every version.
   */
  web_search: CapabilitySupport;
}

/**
 * Thinking capability details.
 */
export interface ThinkingCapability {
  /**
   * Whether this capability is supported by the model.
   */
  supported: boolean;

  /**
   * Supported thinking type configurations.
   */
  types: ThinkingTypes;
}

/**
 * Which `thinking.type` values the model accepts on requests. Read each key on its
 * own: for example, `enabled` can be false while `disabled` is true.
 */
export interface ThinkingTypes {
  /**
   * Whether the model accepts thinking with type 'adaptive' (the model decides
   * whether and how much to think).
   */
  adaptive: CapabilitySupport;

  /**
   * Whether the model accepts thinking with type 'disabled' (thinking turned off).
   * False exactly when a request that sends it gets a 400 from this model. True on a
   * model that does not support thinking.
   */
  disabled: CapabilitySupport;

  /**
   * Whether the model accepts thinking with type 'enabled' (extended thinking with a
   * caller-set `budget_tokens`).
   */
  enabled: CapabilitySupport;
}

export interface ModelRetrieveParams {
  /**
   * @deprecated Deprecated. This parameter will be removed from this method in a
   * future release. To use beta features, call the beta models methods
   * (`client.beta.models`) instead.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Optional header to select the Workspace for this request. The value is a
   * Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface ModelListParams extends PageParams {
  /**
   * Query param: Filter the list to models in any of the given lifecycle stages
   * (`active`, `deprecated`, or `retired`). Up to 3 values. When omitted, the list
   * contains the `active` and `deprecated` models; `retired` models appear only when
   * `retired` is requested explicitly.
   */
  lifecycle?: Array<'active' | 'deprecated' | 'retired'>;

  /**
   * @deprecated Deprecated. This parameter will be removed from this method in a
   * future release. To use beta features, call the beta models methods
   * (`client.beta.models`) instead.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export declare namespace Models {
  export {
    type CapabilitySupport as CapabilitySupport,
    type ContextManagementCapability as ContextManagementCapability,
    type EffortCapability as EffortCapability,
    type ModelCapabilities as ModelCapabilities,
    type ModelInfo as ModelInfo,
    type ModelLine as ModelLine,
    type ServerToolsCapability as ServerToolsCapability,
    type ThinkingCapability as ThinkingCapability,
    type ThinkingTypes as ThinkingTypes,
    type ModelInfosPage as ModelInfosPage,
    type ModelRetrieveParams as ModelRetrieveParams,
    type ModelListParams as ModelListParams,
  };
}
