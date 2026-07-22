// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as VersionsAPI from './versions';
import { VersionListParams, Versions } from './versions';
import * as SessionsAPI from '../sessions/sessions';
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
   *     { description: 'updated' },
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

  /**
   * Resolved coordinator topology with a concrete agent roster.
   */
  multiagent: SessionsAPI.BetaManagedAgentsMultiagent | null;

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
 * A resolved agent reference with a concrete version.
 */
export interface BetaManagedAgentsAgentReference {
  id: string;

  type: 'agent';

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
 * Input payload for the `bash` tool of the `agent_toolset_20260401` toolset. All
 * fields are optional; a normal invocation supplies `command`, while
 * `restart=true` (with no `command`) reboots the runner-side bash session.
 */
export interface BetaManagedAgentsAgentToolset20260401BashInput {
  /**
   * Shell command to execute. Omit only when `restart` is true.
   */
  command?: string;

  /**
   * When true, restart the persistent bash session instead of running a command.
   * Subsequent calls without `restart` will run against the fresh session.
   */
  restart?: boolean;

  /**
   * Per-call timeout in milliseconds. Defaults to the runner-wide tool timeout when
   * omitted or zero.
   */
  timeout_ms?: number;
}

/**
 * Input payload for the `edit` tool. Performs a string replacement in the named
 * file; by default `old_string` must occur exactly once.
 */
export interface BetaManagedAgentsAgentToolset20260401EditInput {
  /**
   * Path of the file to edit.
   */
  file_path: string;

  /**
   * Replacement text.
   */
  new_string: string;

  /**
   * Substring to find and replace.
   */
  old_string: string;

  /**
   * When true, replace every occurrence of `old_string` instead of requiring a
   * unique match.
   */
  replace_all?: boolean;
}

/**
 * Input payload for the `glob` tool. Returns paths matching a doublestar glob
 * pattern, newest first.
 */
export interface BetaManagedAgentsAgentToolset20260401GlobInput {
  /**
   * Doublestar glob pattern (e.g. `** /*.go`). Absolute patterns are only permitted
   * when the runner is configured to allow them.
   */
  pattern: string;

  /**
   * Optional directory root to search under. Defaults to the runner's working
   * directory.
   */
  path?: string;
}

/**
 * Input payload for the `grep` tool. Searches file contents for a regular
 * expression, returning matching lines.
 */
export interface BetaManagedAgentsAgentToolset20260401GrepInput {
  /**
   * Regular expression to search for.
   */
  pattern: string;

  /**
   * Optional directory root to search under. Defaults to the runner's working
   * directory.
   */
  path?: string;
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
 * Input payload for the `read` tool. Reads file contents relative to the runner's
 * working directory (or absolute when the runner permits).
 */
export interface BetaManagedAgentsAgentToolset20260401ReadInput {
  /**
   * Path of the file to read.
   */
  file_path: string;

  /**
   * Optional `[start_line, end_line]` 1-indexed inclusive range. When omitted the
   * entire file is returned. `end_line` of 0 or negative means "to end of file".
   */
  view_range?: Array<number>;
}

/**
 * Input payload for the `write` tool. Writes (overwriting) the entire file
 * contents.
 */
export interface BetaManagedAgentsAgentToolset20260401WriteInput {
  /**
   * Full file contents to write.
   */
  content: string;

  /**
   * Path of the file to write.
   */
  file_path: string;
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
  type: 'object';

  properties?: { [key: string]: unknown } | null;

  required?: Array<string> | null;

  [k: string]: unknown;
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
   * use the tool. 1-4096 characters.
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
 * High effort. Favors reasoning depth.
 */
export interface BetaManagedAgentsEffortHigh {
  type: 'high';
}

/**
 * Low effort. Favors latency over reasoning depth.
 */
export interface BetaManagedAgentsEffortLow {
  type: 'low';
}

/**
 * Maximum effort. Favors reasoning depth over latency.
 */
export interface BetaManagedAgentsEffortMax {
  type: 'max';
}

/**
 * Medium effort. Balances latency and reasoning depth.
 */
export interface BetaManagedAgentsEffortMedium {
  type: 'medium';
}

/**
 * Extra-high effort. Not all models accept this level.
 */
export interface BetaManagedAgentsEffortXhigh {
  type: 'xhigh';
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
 * The model that will power your agent.
 *
 * See [models](https://docs.anthropic.com/en/docs/models-overview) for additional
 * details and options.
 */
export type BetaManagedAgentsModel =
  | 'claude-sonnet-5'
  | 'claude-fable-5'
  | 'claude-opus-4-8'
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
   * The model that will power your agent.
   *
   * See [models](https://docs.anthropic.com/en/docs/models-overview) for additional
   * details and options.
   */
  id: BetaManagedAgentsModel;

  /**
   * How hard Claude works on each turn. Sets `output_config.effort` on every
   * Messages call the session makes.
   */
  effort?:
    | BetaManagedAgentsEffortLow
    | BetaManagedAgentsEffortMedium
    | BetaManagedAgentsEffortHigh
    | BetaManagedAgentsEffortXhigh
    | BetaManagedAgentsEffortMax;

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
   * The model that will power your agent.
   *
   * See [models](https://docs.anthropic.com/en/docs/models-overview) for additional
   * details and options.
   */
  id: BetaManagedAgentsModel;

  /**
   * How hard Claude works on each inference call. Accepts a bare level string
   * (`"high"`) or `{"type": "high"}`. On create, omitting it resolves the per-model
   * default; on update, omitting it leaves the stored value unchanged.
   */
  effort?:
    | 'low'
    | 'medium'
    | 'high'
    | 'xhigh'
    | 'max'
    | BetaManagedAgentsEffortLow
    | BetaManagedAgentsEffortMedium
    | BetaManagedAgentsEffortHigh
    | BetaManagedAgentsEffortXhigh
    | BetaManagedAgentsEffortMax
    | null;

  /**
   * Inference speed mode. `fast` provides significantly faster output token
   * generation at premium pricing. Not all models support `fast`; invalid
   * combinations are rejected at create time.
   */
  speed?: 'standard' | 'fast' | null;
}

/**
 * Resolved coordinator topology with a concrete agent roster.
 */
export interface BetaManagedAgentsMultiagentCoordinator {
  /**
   * Agents the coordinator may spawn as session threads, each resolved to a specific
   * version.
   */
  agents: Array<BetaManagedAgentsAgentReference>;

  type: 'coordinator';
}

/**
 * A coordinator topology: the session's primary thread orchestrates work by
 * spawning session threads, each running an agent drawn from the `agents` roster.
 */
export interface BetaManagedAgentsMultiagentCoordinatorParams {
  /**
   * Agents the coordinator may spawn as session threads. 1–20 entries. Each entry is
   * an agent ID string, a versioned `{"type":"agent","id","version"}` reference, or
   * `{"type":"self"}` to allow recursive self-invocation. Entries must reference
   * distinct agents (after resolving `self` and string forms); at most one `self`.
   * Referenced agents must exist, must not be archived, and must not themselves have
   * `multiagent` set (depth limit 1).
   */
  agents: Array<SessionsAPI.BetaManagedAgentsMultiagentRosterEntryParams>;

  type: 'coordinator';
}

/**
 * Sentinel roster entry meaning "the agent that owns this configuration". Resolved
 * server-side to a concrete agent reference.
 */
export interface BetaManagedAgentsMultiagentSelfParams {
  type: 'self';
}

/**
 * Resolved `agent` definition for a single `session_thread`. Snapshot of the agent
 * at thread creation time. The multiagent roster is not repeated here; read it
 * from `Session.agent`.
 */
export interface BetaManagedAgentsSessionThreadAgent {
  id: string;

  description: string | null;

  mcp_servers: Array<BetaManagedAgentsMCPServerURLDefinition>;

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

  version: number;
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
   * Body param: Human-readable name for the agent.
   */
  name: string;

  /**
   * Body param: Description of what the agent does.
   */
  description?: string | null;

  /**
   * Body param: MCP servers this agent connects to. Maximum 20. Names must be unique
   * within the array. Every server must be referenced by an `mcp_toolset` in
   * `tools`; unreferenced servers are rejected. See the
   * [MCP connector guide](https://platform.claude.com/docs/en/managed-agents/mcp-connector).
   */
  mcp_servers?: Array<BetaManagedAgentsURLMCPServerParams>;

  /**
   * Body param: Arbitrary key-value metadata. Maximum 16 pairs, keys up to 64 chars,
   * values up to 512 chars.
   */
  metadata?: { [key: string]: string };

  /**
   * Body param: A coordinator topology: the session's primary thread orchestrates
   * work by spawning session threads, each running an agent drawn from the `agents`
   * roster.
   */
  multiagent?: SessionsAPI.BetaManagedAgentsMultiagentParams | null;

  /**
   * Body param: Skills available to the agent.
   */
  skills?: Array<BetaManagedAgentsSkillParams>;

  /**
   * Body param: System prompt for the agent.
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
   * Body param: Description. Omit to preserve; send empty string or null to clear.
   */
  description?: string | null;

  /**
   * Body param: MCP servers. Full replacement. Omit to preserve; send empty array or
   * `null` to clear. Names must be unique. Maximum 20. Every server must be
   * referenced by an `mcp_toolset` in the agent's resulting `tools`; unreferenced
   * servers are rejected. See the
   * [MCP connector guide](https://platform.claude.com/docs/en/managed-agents/mcp-connector).
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
   * Body param: A coordinator topology: the session's primary thread orchestrates
   * work by spawning session threads, each running an agent drawn from the `agents`
   * roster.
   */
  multiagent?: SessionsAPI.BetaManagedAgentsMultiagentParams | null;

  /**
   * Body param: Human-readable name. Must be non-empty. Omit to preserve. Cannot be
   * cleared.
   */
  name?: string;

  /**
   * Body param: Skills. Full replacement. Omit to preserve; send empty array or null
   * to clear.
   */
  skills?: Array<BetaManagedAgentsSkillParams> | null;

  /**
   * Body param: System prompt. Omit to preserve; send empty string or null to clear.
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
   * Body param: The agent's current version, used to prevent concurrent overwrites.
   * Obtain this value from a create or retrieve response. Must be at least 1 if
   * specified. When supplied, the request fails if it does not match the server's
   * current version; omit to apply the update unconditionally.
   */
  version?: number;

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
    type BetaManagedAgentsAgentReference as BetaManagedAgentsAgentReference,
    type BetaManagedAgentsAgentToolConfig as BetaManagedAgentsAgentToolConfig,
    type BetaManagedAgentsAgentToolConfigParams as BetaManagedAgentsAgentToolConfigParams,
    type BetaManagedAgentsAgentToolsetDefaultConfig as BetaManagedAgentsAgentToolsetDefaultConfig,
    type BetaManagedAgentsAgentToolsetDefaultConfigParams as BetaManagedAgentsAgentToolsetDefaultConfigParams,
    type BetaManagedAgentsAgentToolset20260401 as BetaManagedAgentsAgentToolset20260401,
    type BetaManagedAgentsAgentToolset20260401BashInput as BetaManagedAgentsAgentToolset20260401BashInput,
    type BetaManagedAgentsAgentToolset20260401EditInput as BetaManagedAgentsAgentToolset20260401EditInput,
    type BetaManagedAgentsAgentToolset20260401GlobInput as BetaManagedAgentsAgentToolset20260401GlobInput,
    type BetaManagedAgentsAgentToolset20260401GrepInput as BetaManagedAgentsAgentToolset20260401GrepInput,
    type BetaManagedAgentsAgentToolset20260401Params as BetaManagedAgentsAgentToolset20260401Params,
    type BetaManagedAgentsAgentToolset20260401ReadInput as BetaManagedAgentsAgentToolset20260401ReadInput,
    type BetaManagedAgentsAgentToolset20260401WriteInput as BetaManagedAgentsAgentToolset20260401WriteInput,
    type BetaManagedAgentsAlwaysAllowPolicy as BetaManagedAgentsAlwaysAllowPolicy,
    type BetaManagedAgentsAlwaysAskPolicy as BetaManagedAgentsAlwaysAskPolicy,
    type BetaManagedAgentsAnthropicSkill as BetaManagedAgentsAnthropicSkill,
    type BetaManagedAgentsAnthropicSkillParams as BetaManagedAgentsAnthropicSkillParams,
    type BetaManagedAgentsCustomSkill as BetaManagedAgentsCustomSkill,
    type BetaManagedAgentsCustomSkillParams as BetaManagedAgentsCustomSkillParams,
    type BetaManagedAgentsCustomTool as BetaManagedAgentsCustomTool,
    type BetaManagedAgentsCustomToolInputSchema as BetaManagedAgentsCustomToolInputSchema,
    type BetaManagedAgentsCustomToolParams as BetaManagedAgentsCustomToolParams,
    type BetaManagedAgentsEffortHigh as BetaManagedAgentsEffortHigh,
    type BetaManagedAgentsEffortLow as BetaManagedAgentsEffortLow,
    type BetaManagedAgentsEffortMax as BetaManagedAgentsEffortMax,
    type BetaManagedAgentsEffortMedium as BetaManagedAgentsEffortMedium,
    type BetaManagedAgentsEffortXhigh as BetaManagedAgentsEffortXhigh,
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
    type BetaManagedAgentsMultiagentCoordinator as BetaManagedAgentsMultiagentCoordinator,
    type BetaManagedAgentsMultiagentCoordinatorParams as BetaManagedAgentsMultiagentCoordinatorParams,
    type BetaManagedAgentsMultiagentSelfParams as BetaManagedAgentsMultiagentSelfParams,
    type BetaManagedAgentsSessionThreadAgent as BetaManagedAgentsSessionThreadAgent,
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
