// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as VersionsAPI from './versions';
import { VersionListParams, Versions } from './versions';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Agents extends APIResource {
  versions: VersionsAPI.Versions = new VersionsAPI.Versions(this._client);

  /**
   * Create Agent
   *
   * @example
   * ```ts
   * const betaManagedAgentsAgent =
   *   await client.beta.agents.create({
   *     model: 'claude-sonnet-4-6',
   *     name: 'My First Agent',
   *   });
   * ```
   */
  create(params: AgentCreateParams, options?: RequestOptions): APIPromise<BetaManagedAgentsAgent> {
    const { betas, ...body } = params;
    return this._client.post('/v1/agents?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Get Agent
   *
   * @example
   * ```ts
   * const betaManagedAgentsAgent =
   *   await client.beta.agents.retrieve(
   *     'agent_011CZkYpogX7uDKUyvBTophP',
   *   );
   * ```
   */
  retrieve(
    agentID: string,
    params: AgentRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsAgent> {
    const { betas, ...query } = params ?? {};
    return this._client.get(path`/v1/agents/${agentID}?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Agent
   *
   * @example
   * ```ts
   * const betaManagedAgentsAgent =
   *   await client.beta.agents.update(
   *     'agent_011CZkYpogX7uDKUyvBTophP',
   *     { version: 1 },
   *   );
   * ```
   */
  update(
    agentID: string,
    params: AgentUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsAgent> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/agents/${agentID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List Agents
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsAgent of client.beta.agents.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: AgentListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsAgentsPageCursor, BetaManagedAgentsAgent> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/agents?beta=true', PageCursor<BetaManagedAgentsAgent>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Archive Agent
   *
   * @example
   * ```ts
   * const betaManagedAgentsAgent =
   *   await client.beta.agents.archive(
   *     'agent_011CZkYpogX7uDKUyvBTophP',
   *   );
   * ```
   */
  archive(
    agentID: string,
    params: AgentArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaManagedAgentsAgent> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/agents/${agentID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaManagedAgentsAgentsPageCursor = PageCursor<BetaManagedAgentsAgent>;

/**
 * A Managed Agents `agent`.
 */
export interface BetaManagedAgentsAgent {
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  archived_at: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  description: string | null;

  mcp_servers: Array<BetaManagedAgentsMCPServerURLDefinition>;

  metadata: { [key: string]: string };

  /**
   * Model identifier and configuration.
   */
  model: BetaManagedAgentsModelConfig;

  name: string;

  skills: Array<BetaManagedAgentsAnthropicSkill | BetaManagedAgentsCustomSkill>;

  system: string | null;

  tools: Array<
    BetaManagedAgentsAgentToolset20260401 | BetaManagedAgentsMCPToolset | BetaManagedAgentsCustomTool
  >;

  type: 'agent';

  /**
   * A timestamp in RFC 3339 format
   */
  updated_at: string;

  /**
   * The agent's current version. Starts at 1 and increments when the agent is
   * modified.
   */
  version: number;
}

/**
 * Configuration for a specific agent tool.
 */
export interface BetaManagedAgentsAgentToolConfig {
  enabled: boolean;

  /**
   * Built-in agent tool identifier.
   */
  name: 'bash' | 'edit' | 'read' | 'write' | 'glob' | 'grep' | 'web_fetch' | 'web_search';

  /**
   * Permission policy for tool execution.
   */
  permission_policy: BetaManagedAgentsAlwaysAllowPolicy | BetaManagedAgentsAlwaysAskPolicy;
}

/**
 * Configuration override for a specific tool within a toolset.
 */
export interface BetaManagedAgentsAgentToolConfigParams {
  /**
   * Built-in agent tool identifier.
   */
  name: 'bash' | 'edit' | 'read' | 'write' | 'glob' | 'grep' | 'web_fetch' | 'web_search';

  /**
   * Whether this tool is enabled and available to Claude. Overrides the
   * default_config setting.
   */
  enabled?: boolean | null;

  /**
   * Permission policy for tool execution.
   */
  permission_policy?: BetaManagedAgentsAlwaysAllowPolicy | BetaManagedAgentsAlwaysAskPolicy | null;
}

/**
 * Resolved default configuration for agent tools.
 */
export interface BetaManagedAgentsAgentToolsetDefaultConfig {
  enabled: boolean;

  /**
   * Permission policy for tool execution.
   */
  permission_policy: BetaManagedAgentsAlwaysAllowPolicy | BetaManagedAgentsAlwaysAskPolicy;
}

/**
 * Default configuration for all tools in a toolset.
 */
export interface BetaManagedAgentsAgentToolsetDefaultConfigParams {
  /**
   * Whether tools are enabled and available to Claude by default. Defaults to true
   * if not specified.
   */
  enabled?: boolean | null;

  /**
   * Permission policy for tool execution.
   */
  permission_policy?: BetaManagedAgentsAlwaysAllowPolicy | BetaManagedAgentsAlwaysAskPolicy | null;
}

export interface BetaManagedAgentsAgentToolset20260401 {
  configs: Array<BetaManagedAgentsAgentToolConfig>;

  /**
   * Resolved default configuration for agent tools.
   */
  default_config: BetaManagedAgentsAgentToolsetDefaultConfig;

  type: 'agent_toolset_20260401';
}

/**
 * Configuration for built-in agent tools. Use this to enable or disable groups of
 * tools available to the agent.
 */
export interface BetaManagedAgentsAgentToolset20260401Params {
  type: 'agent_toolset_20260401';

  /**
   * Per-tool configuration overrides.
   */
  configs?: Array<BetaManagedAgentsAgentToolConfigParams>;

  /**
   * Default configuration for all tools in a toolset.
   */
  default_config?: BetaManagedAgentsAgentToolsetDefaultConfigParams | null;
}

/**
 * Tool calls are automatically approved without user confirmation.
 */
export interface BetaManagedAgentsAlwaysAllowPolicy {
  type: 'always_allow';
}

/**
 * Tool calls require user confirmation before execution.
 */
export interface BetaManagedAgentsAlwaysAskPolicy {
  type: 'always_ask';
}

/**
 * A resolved Anthropic-managed skill.
 */
export interface BetaManagedAgentsAnthropicSkill {
  skill_id: string;

  type: 'anthropic';

  version: string;
}

/**
 * An Anthropic-managed skill.
 */
export interface BetaManagedAgentsAnthropicSkillParams {
  /**
   * Identifier of the Anthropic skill (e.g., "xlsx").
   */
  skill_id: string;

  type: 'anthropic';

  /**
   * Version to pin. Defaults to latest if omitted.
   */
  version?: string | null;
}

/**
 * A resolved user-created custom skill.
 */
export interface BetaManagedAgentsCustomSkill {
  skill_id: string;

  type: 'custom';

  version: string;
}

/**
 * A user-created custom skill.
 */
export interface BetaManagedAgentsCustomSkillParams {
  /**
   * Tagged ID of the custom skill (e.g., "skill_01XJ5...").
   */
  skill_id: string;

  type: 'custom';

  /**
   * Version to pin. Defaults to latest if omitted.
   */
  version?: string | null;
}

/**
 * A custom tool as returned in API responses.
 */
export interface BetaManagedAgentsCustomTool {
  description: string;

  /**
   * JSON Schema for custom tool input parameters.
   */
  input_schema: BetaManagedAgentsCustomToolInputSchema;

  name: string;

  type: 'custom';
}

/**
 * JSON Schema for custom tool input parameters.
 */
export interface BetaManagedAgentsCustomToolInputSchema {
  /**
   * JSON Schema properties defining the tool's input parameters.
   */
  properties?: { [key: string]: unknown } | null;

  /**
   * List of required property names.
   */
  required?: Array<string>;

  /**
   * Must be 'object' for tool input schemas.
   */
  type?: 'object';
}

/**
 * A custom tool that is executed by the API client rather than the agent. When the
 * agent calls this tool, an `agent.custom_tool_use` event is emitted and the
 * session goes idle, waiting for the client to provide the result via a
 * `user.custom_tool_result` event.
 */
export interface BetaManagedAgentsCustomToolParams {
  /**
   * Description of what the tool does, shown to the agent to help it decide when to
   * use the tool. 1-1024 characters.
   */
  description: string;

  /**
   * JSON Schema for custom tool input parameters.
   */
  input_schema: BetaManagedAgentsCustomToolInputSchema;

  /**
   * Unique name for the tool. 1-128 characters; letters, digits, underscores, and
   * hyphens.
   */
  name: string;

  type: 'custom';
}

/**
 * URL-based MCP server connection as returned in API responses.
 */
export interface BetaManagedAgentsMCPServerURLDefinition {
  name: string;

  type: 'url';

  url: string;
}

/**
 * Resolved configuration for a specific MCP tool.
 */
export interface BetaManagedAgentsMCPToolConfig {
  enabled: boolean;

  name: string;

  /**
   * Permission policy for tool execution.
   */
  permission_policy: BetaManagedAgentsAlwaysAllowPolicy | BetaManagedAgentsAlwaysAskPolicy;
}

/**
 * Configuration override for a specific MCP tool.
 */
export interface BetaManagedAgentsMCPToolConfigParams {
  /**
   * Name of the MCP tool to configure. 1-128 characters.
   */
  name: string;

  /**
   * Whether this tool is enabled. Overrides the `default_config` setting.
   */
  enabled?: boolean | null;

  /**
   * Permission policy for tool execution.
   */
  permission_policy?: BetaManagedAgentsAlwaysAllowPolicy | BetaManagedAgentsAlwaysAskPolicy | null;
}

export interface BetaManagedAgentsMCPToolset {
  configs: Array<BetaManagedAgentsMCPToolConfig>;

  /**
   * Resolved default configuration for all tools from an MCP server.
   */
  default_config: BetaManagedAgentsMCPToolsetDefaultConfig;

  mcp_server_name: string;

  type: 'mcp_toolset';
}

/**
 * Resolved default configuration for all tools from an MCP server.
 */
export interface BetaManagedAgentsMCPToolsetDefaultConfig {
  enabled: boolean;

  /**
   * Permission policy for tool execution.
   */
  permission_policy: BetaManagedAgentsAlwaysAllowPolicy | BetaManagedAgentsAlwaysAskPolicy;
}

/**
 * Default configuration for all tools from an MCP server.
 */
export interface BetaManagedAgentsMCPToolsetDefaultConfigParams {
  /**
   * Whether tools are enabled by default. Defaults to true if not specified.
   */
  enabled?: boolean | null;

  /**
   * Permission policy for tool execution.
   */
  permission_policy?: BetaManagedAgentsAlwaysAllowPolicy | BetaManagedAgentsAlwaysAskPolicy | null;
}

/**
 * Configuration for tools from an MCP server defined in `mcp_servers`.
 */
export interface BetaManagedAgentsMCPToolsetParams {
  /**
   * Name of the MCP server. Must match a server name from the mcp_servers array.
   * 1-255 characters.
   */
  mcp_server_name: string;

  type: 'mcp_toolset';

  /**
   * Per-tool configuration overrides.
   */
  configs?: Array<BetaManagedAgentsMCPToolConfigParams>;

  /**
   * Default configuration for all tools from an MCP server.
   */
  default_config?: BetaManagedAgentsMCPToolsetDefaultConfigParams | null;
}

/**
 * The model that will power your agent.\n\nSee
 * [models](https://docs.anthropic.com/en/docs/models-overview) for additional
 * details and options.
 */
export type BetaManagedAgentsModel =
  | 'claude-opus-4-7'
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5'
  | 'claude-haiku-4-5-20251001'
  | 'claude-opus-4-5'
  | 'claude-opus-4-5-20251101'
  | 'claude-sonnet-4-5'
  | 'claude-sonnet-4-5-20250929'
  | (string & {});

/**
 * Model identifier and configuration.
 */
export interface BetaManagedAgentsModelConfig {
  /**
   * The model that will power your agent.\n\nSee
   * [models](https://docs.anthropic.com/en/docs/models-overview) for additional
   * details and options.
   */
  id: BetaManagedAgentsModel;

  /**
   * Inference speed mode. `fast` provides significantly faster output token
   * generation at premium pricing. Not all models support `fast`; invalid
   * combinations are rejected at create time.
   */
  speed?: 'standard' | 'fast';
}

/**
 * An object that defines additional configuration control over model use
 */
export interface BetaManagedAgentsModelConfigParams {
  /**
   * The model that will power your agent.\n\nSee
   * [models](https://docs.anthropic.com/en/docs/models-overview) for additional
   * details and options.
   */
  id: BetaManagedAgentsModel;

  /**
   * Inference speed mode. `fast` provides significantly faster output token
   * generation at premium pricing. Not all models support `fast`; invalid
   * combinations are rejected at create time.
   */
  speed?: 'standard' | 'fast' | null;
}

/**
 * Skill to load in the session container.
 */
export type BetaManagedAgentsSkillParams =
  | BetaManagedAgentsAnthropicSkillParams
  | BetaManagedAgentsCustomSkillParams;

/**
 * URL-based MCP server connection.
 */
export interface BetaManagedAgentsURLMCPServerParams {
  /**
   * Unique name for this server, referenced by mcp_toolset configurations. 1-255
   * characters.
   */
  name: string;

  type: 'url';

  /**
   * Endpoint URL for the MCP server.
   */
  url: string;
}

export interface AgentCreateParams {
  /**
   * Body param: Model identifier. Accepts the
   * [model string](https://platform.claude.com/docs/en/about-claude/models/overview#latest-models-comparison),
   * e.g. `claude-opus-4-6`, or a `model_config` object for additional configuration
   * control
   */
  model: BetaManagedAgentsModel | BetaManagedAgentsModelConfigParams;

  /**
   * Body param: Human-readable name for the agent. 1-256 characters.
   */
  name: string;

  /**
   * Body param: Description of what the agent does. Up to 2048 characters.
   */
  description?: string | null;

  /**
   * Body param: MCP servers this agent connects to. Maximum 20. Names must be unique
   * within the array.
   */
  mcp_servers?: Array<BetaManagedAgentsURLMCPServerParams>;

  /**
   * Body param: Arbitrary key-value metadata. Maximum 16 pairs, keys up to 64 chars,
   * values up to 512 chars.
   */
  metadata?: { [key: string]: string };

  /**
   * Body param: Skills available to the agent. Maximum 20.
   */
  skills?: Array<BetaManagedAgentsSkillParams>;

  /**
   * Body param: System prompt for the agent. Up to 100,000 characters.
   */
  system?: string | null;

  /**
   * Body param: Tool configurations available to the agent. Maximum of 128 tools
   * across all toolsets allowed.
   */
  tools?: Array<
    | BetaManagedAgentsAgentToolset20260401Params
    | BetaManagedAgentsMCPToolsetParams
    | BetaManagedAgentsCustomToolParams
  >;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface AgentRetrieveParams {
  /**
   * Query param: Agent version. Omit for the most recent version. Must be at least 1
   * if specified.
   */
  version?: number;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface AgentUpdateParams {
  /**
   * Body param: The agent's current version, used to prevent concurrent overwrites.
   * Obtain this value from a create or retrieve response. The request fails if this
   * does not match the server's current version.
   */
  version: number;

  /**
   * Body param: Description. Up to 2048 characters. Omit to preserve; send empty
   * string or null to clear.
   */
  description?: string | null;

  /**
   * Body param: MCP servers. Full replacement. Omit to preserve; send empty array or
   * null to clear. Names must be unique. Maximum 20.
   */
  mcp_servers?: Array<BetaManagedAgentsURLMCPServerParams> | null;

  /**
   * Body param: Metadata patch. Set a key to a string to upsert it, or to null to
   * delete it. Omit the field to preserve. The stored bag is limited to 16 keys (up
   * to 64 chars each) with values up to 512 chars.
   */
  metadata?: { [key: string]: string | null } | null;

  /**
   * Body param: Model identifier. Accepts the
   * [model string](https://platform.claude.com/docs/en/about-claude/models/overview#latest-models-comparison),
   * e.g. `claude-opus-4-6`, or a `model_config` object for additional configuration
   * control. Omit to preserve. Cannot be cleared.
   */
  model?: BetaManagedAgentsModel | BetaManagedAgentsModelConfigParams;

  /**
   * Body param: Human-readable name. 1-256 characters. Omit to preserve. Cannot be
   * cleared.
   */
  name?: string;

  /**
   * Body param: Skills. Full replacement. Omit to preserve; send empty array or null
   * to clear. Maximum 20.
   */
  skills?: Array<BetaManagedAgentsSkillParams> | null;

  /**
   * Body param: System prompt. Up to 100,000 characters. Omit to preserve; send
   * empty string or null to clear.
   */
  system?: string | null;

  /**
   * Body param: Tool configurations available to the agent. Full replacement. Omit
   * to preserve; send empty array or null to clear. Maximum of 128 tools across all
   * toolsets allowed.
   */
  tools?: Array<
    | BetaManagedAgentsAgentToolset20260401Params
    | BetaManagedAgentsMCPToolsetParams
    | BetaManagedAgentsCustomToolParams
  > | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface AgentListParams extends PageCursorParams {
  /**
   * Query param: Return agents created at or after this time (inclusive).
   */
  'created_at[gte]'?: string;

  /**
   * Query param: Return agents created at or before this time (inclusive).
   */
  'created_at[lte]'?: string;

  /**
   * Query param: Include archived agents in results. Defaults to false.
   */
  include_archived?: boolean;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface AgentArchiveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

Agents.Versions = Versions;

export declare namespace Agents {
  export {
    type BetaManagedAgentsAgent as BetaManagedAgentsAgent,
    type BetaManagedAgentsAgentToolConfig as BetaManagedAgentsAgentToolConfig,
    type BetaManagedAgentsAgentToolConfigParams as BetaManagedAgentsAgentToolConfigParams,
    type BetaManagedAgentsAgentToolsetDefaultConfig as BetaManagedAgentsAgentToolsetDefaultConfig,
    type BetaManagedAgentsAgentToolsetDefaultConfigParams as BetaManagedAgentsAgentToolsetDefaultConfigParams,
    type BetaManagedAgentsAgentToolset20260401 as BetaManagedAgentsAgentToolset20260401,
    type BetaManagedAgentsAgentToolset20260401Params as BetaManagedAgentsAgentToolset20260401Params,
    type BetaManagedAgentsAlwaysAllowPolicy as BetaManagedAgentsAlwaysAllowPolicy,
    type BetaManagedAgentsAlwaysAskPolicy as BetaManagedAgentsAlwaysAskPolicy,
    type BetaManagedAgentsAnthropicSkill as BetaManagedAgentsAnthropicSkill,
    type BetaManagedAgentsAnthropicSkillParams as BetaManagedAgentsAnthropicSkillParams,
    type BetaManagedAgentsCustomSkill as BetaManagedAgentsCustomSkill,
    type BetaManagedAgentsCustomSkillParams as BetaManagedAgentsCustomSkillParams,
    type BetaManagedAgentsCustomTool as BetaManagedAgentsCustomTool,
    type BetaManagedAgentsCustomToolInputSchema as BetaManagedAgentsCustomToolInputSchema,
    type BetaManagedAgentsCustomToolParams as BetaManagedAgentsCustomToolParams,
    type BetaManagedAgentsMCPServerURLDefinition as BetaManagedAgentsMCPServerURLDefinition,
    type BetaManagedAgentsMCPToolConfig as BetaManagedAgentsMCPToolConfig,
    type BetaManagedAgentsMCPToolConfigParams as BetaManagedAgentsMCPToolConfigParams,
    type BetaManagedAgentsMCPToolset as BetaManagedAgentsMCPToolset,
    type BetaManagedAgentsMCPToolsetDefaultConfig as BetaManagedAgentsMCPToolsetDefaultConfig,
    type BetaManagedAgentsMCPToolsetDefaultConfigParams as BetaManagedAgentsMCPToolsetDefaultConfigParams,
    type BetaManagedAgentsMCPToolsetParams as BetaManagedAgentsMCPToolsetParams,
    type BetaManagedAgentsModel as BetaManagedAgentsModel,
    type BetaManagedAgentsModelConfig as BetaManagedAgentsModelConfig,
    type BetaManagedAgentsModelConfigParams as BetaManagedAgentsModelConfigParams,
    type BetaManagedAgentsSkillParams as BetaManagedAgentsSkillParams,
    type BetaManagedAgentsURLMCPServerParams as BetaManagedAgentsURLMCPServerParams,
    type BetaManagedAgentsAgentsPageCursor as BetaManagedAgentsAgentsPageCursor,
    type AgentCreateParams as AgentCreateParams,
    type AgentRetrieveParams as AgentRetrieveParams,
    type AgentUpdateParams as AgentUpdateParams,
    type AgentListParams as AgentListParams,
    type AgentArchiveParams as AgentArchiveParams,
  };

  export { Versions as Versions, type VersionListParams as VersionListParams };
}
