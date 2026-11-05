import { APIResource } from '../../../core/resource';
import * as ArtifactsAPI from './artifacts';
import { ArtifactListParams, Artifacts } from './artifacts';
import * as ConnectorsAPI from './connectors';
import { ConnectorListParams, Connectors } from './connectors';
import * as PluginsAPI from './plugins';
import { PluginListParams, Plugins } from './plugins';
import * as SkillsAPI from './skills';
import { SkillListParams, Skills } from './skills';
import * as SummariesAPI from './summaries';
import { Summaries, SummaryListParams } from './summaries';
import * as UsersAPI from './users';
import { UserListParams, Users } from './users';
import * as AppsAPI from './apps/apps';
import { Apps } from './apps/apps';
import { PageCursor } from '../../../core/pagination';

export class Analytics extends APIResource {
  summaries: SummariesAPI.Summaries = new SummariesAPI.Summaries(this._client);
  users: UsersAPI.Users = new UsersAPI.Users(this._client);
  apps: AppsAPI.Apps = new AppsAPI.Apps(this._client);
  connectors: ConnectorsAPI.Connectors = new ConnectorsAPI.Connectors(this._client);
  plugins: PluginsAPI.Plugins = new PluginsAPI.Plugins(this._client);
  skills: SkillsAPI.Skills = new SkillsAPI.Skills(this._client);
  artifacts: ArtifactsAPI.Artifacts = new ArtifactsAPI.Artifacts(this._client);
}

export type AnalyticsSingleDayActivitySummariesPageCursor = PageCursor<AnalyticsSingleDayActivitySummary>;

export type AnalyticsUserActivitiesPageCursor = PageCursor<AnalyticsUserActivity>;

export type AnalyticsProjectActivitiesPageCursor = PageCursor<AnalyticsProjectActivity>;

export type AnalyticsConnectorActivitiesPageCursor = PageCursor<AnalyticsConnectorActivity>;

export type AnalyticsPluginActivitiesPageCursor = PageCursor<AnalyticsPluginActivity>;

export type AnalyticsSkillActivitiesPageCursor = PageCursor<AnalyticsSkillActivity>;

export type AnalyticsArtifactActivitiesPageCursor = PageCursor<AnalyticsArtifactActivity>;

/**
 * Artifact-creation activity for one (`artifact_type`, `is_shared`) bucket on a
 * given day.
 *
 * Artifacts form a small finite cube — the canonical MIME type (8 values incl.
 * `other`) crossed with shared-vs-private — so the response is the full set of
 * non-empty buckets, not a ranked/paginated list. Claude Code and Cowork artifacts
 * report under `text/html` and are counted from 2026-08-17 onward; earlier days
 * contain claude.ai chat artifacts only. With `group_by[]=product` / `user_id` /
 * `rbac_group_id` each row is further split by the flat group keys and counts are
 * scoped to that cut.
 */
export interface AnalyticsArtifactActivity {
  /**
   * Canonical artifact MIME type (e.g. `text/markdown`, `application/vnd.ant.react`,
   * `image/svg+xml`), or `other`. Claude Code and Cowork artifacts report as
   * `text/html`.
   */
  artifact_type: string;

  /**
   * Number of artifacts created in this bucket on the requested day
   */
  artifacts_created_count: number;

  /**
   * Number of distinct users who created artifacts in this bucket on the requested
   * day
   */
  distinct_user_count: number;

  /**
   * Whether the artifacts in this bucket have ever been shared (a Claude Code /
   * Cowork artifact is shared once anyone beyond its creator may open it: named
   * members, the whole organization, or anyone with the link).
   */
  is_shared: boolean;

  /**
   * Number of those artifacts that have been published (for Claude Code / Cowork
   * artifacts: open to anyone with the link); never exceeds
   * `artifacts_created_count`
   */
  published_artifacts_created_count: number;

  /**
   * Product that produced this row's activity: one of `chat`, `claude_code`,
   * `cowork`, `office_agent`, or `chat_cowork_unified` (Chat and Cowork unified).
   * These are the canonical Cost & Usage product names; an `office_agent` row's
   * per-surface breakdown is in its `office_metrics`. On `/plugins` only `cowork`,
   * `claude_code` and `chat_cowork_unified` occur (the only surfaces with plugin
   * attribution); on `/artifacts` only `chat`, `claude_code`, `cowork` and
   * `chat_cowork_unified` occur (the surfaces that create artifacts);
   * `/apps/chat/projects` does not support the product dimension (a `product` entry
   * in `group_by[]` or `filter[]` there is rejected). Present only when the request
   * grouped by `product`.
   */
  product?: string | null;

  /**
   * Tagged RBAC group identifier (`rbac_group_...`), matching the spend-limits API
   * spelling. Present only when the request grouped by `rbac_group_id`.
   */
  rbac_group_id?: string | null;

  /**
   * Resolved RBAC group display name, alongside `rbac_group_id` when name resolution
   * is available. Null if the group has been deleted or its name could not be
   * resolved; `rbac_group_id` remains the stable key.
   */
  rbac_group_name?: string | null;

  /**
   * Tagged user identifier (e.g. `user_...`). Present only when the request grouped
   * by `user_id`.
   */
  user_id?: string | null;
}

/**
 * A dimension to group artifact activity by.
 */
export type AnalyticsArtifactGroupBy = 'product' | 'rbac_group_id' | 'user_id';

/**
 * Chat activity recorded while members had Chat and Cowork unified turned on.
 */
export interface AnalyticsChatCoworkUnifiedChatMetrics {
  /**
   * Same measure as `chat_metrics.connectors_used_count`, for activity recorded
   * while members had Chat and Cowork unified turned on.
   */
  connectors_used_count: number;

  /**
   * Same measure as `chat_metrics.distinct_artifacts_created_count`, for activity
   * recorded while members had Chat and Cowork unified turned on. Exact in
   * date-range mode: a creation belongs to exactly one day, so the per-day counts
   * never overlap and their sum over the window is the exact count of distinct
   * creations in it.
   */
  distinct_artifacts_created_count: number;

  /**
   * Same measure as `chat_metrics.distinct_connectors_used_count`, for activity
   * recorded while members had Chat and Cowork unified turned on. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  distinct_connectors_used_count: number | null;

  /**
   * Same measure as `chat_metrics.distinct_conversation_count`, for activity
   * recorded while members had Chat and Cowork unified turned on. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  distinct_conversation_count: number | null;

  /**
   * Same measure as `chat_metrics.distinct_files_uploaded_count`, for activity
   * recorded while members had Chat and Cowork unified turned on. It counts uploaded
   * files as well as files Claude created and images returned by Claude's tools,
   * such as screenshots. Approximate (HLL, typical error <2%) in date-range mode.
   * Null on aggregated rows where a distinct count cannot be computed.
   */
  distinct_files_uploaded_count: number | null;

  /**
   * Same measure as `chat_metrics.distinct_projects_created_count`, for activity
   * recorded while members had Chat and Cowork unified turned on. Exact in
   * date-range mode: a creation belongs to exactly one day, so the per-day counts
   * never overlap and their sum over the window is the exact count of distinct
   * creations in it.
   */
  distinct_projects_created_count: number;

  /**
   * Same measure as `chat_metrics.distinct_projects_used_count`, for activity
   * recorded while members had Chat and Cowork unified turned on. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  distinct_projects_used_count: number | null;

  /**
   * Always null: shared-artifact views are not currently measured.
   */
  distinct_shared_artifacts_viewed_count: number | null;

  /**
   * Same measure as `chat_metrics.distinct_skills_used_count`, for activity recorded
   * while members had Chat and Cowork unified turned on. Approximate (HLL, typical
   * error <2%) in date-range mode. Null on aggregated rows where a distinct count
   * cannot be computed.
   */
  distinct_skills_used_count: number | null;

  /**
   * Same measure as `chat_metrics.message_count`, for activity recorded while
   * members had Chat and Cowork unified turned on.
   */
  message_count: number;

  /**
   * Same measure as `chat_metrics.shared_conversations_viewed_count`, for activity
   * recorded while members had Chat and Cowork unified turned on.
   */
  shared_conversations_viewed_count: number;

  /**
   * Same measure as `chat_metrics.thinking_message_count`, for activity recorded
   * while members had Chat and Cowork unified turned on.
   */
  thinking_message_count: number;
}

/**
 * Activity in Chat and Cowork unified for one user on one day: `chat` holds chat
 * activity and `sessions` holds Cowork session activity.
 */
export interface AnalyticsChatCoworkUnifiedMetrics {
  /**
   * Chat activity recorded while members had Chat and Cowork unified turned on.
   */
  chat: AnalyticsChatCoworkUnifiedChatMetrics;

  /**
   * Cowork session activity recorded while members had Chat and Cowork unified
   * turned on.
   */
  sessions: AnalyticsChatCoworkUnifiedSessionsMetrics;
}

/**
 * Cowork session activity recorded while members had Chat and Cowork unified
 * turned on.
 */
export interface AnalyticsChatCoworkUnifiedSessionsMetrics {
  /**
   * Same measure as `cowork_metrics.action_count`, for activity recorded while
   * members had Chat and Cowork unified turned on.
   */
  action_count: number;

  /**
   * Same measure as `cowork_metrics.artifacts_created_count`, for activity recorded
   * while members had Chat and Cowork unified turned on. Exact in date-range mode: a
   * creation belongs to exactly one day, so the per-day counts never overlap and
   * their sum over the window is the exact count of distinct creations in it.
   */
  artifacts_created_count: number;

  /**
   * Same measure as `cowork_metrics.connectors_used_count`, for activity recorded
   * while members had Chat and Cowork unified turned on.
   */
  connectors_used_count: number;

  /**
   * Same measure as `cowork_metrics.dispatch_turn_count`, for activity recorded
   * while members had Chat and Cowork unified turned on.
   */
  dispatch_turn_count: number;

  /**
   * Same measure as `cowork_metrics.distinct_connectors_used_count`, for activity
   * recorded while members had Chat and Cowork unified turned on. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  distinct_connectors_used_count: number | null;

  /**
   * Same measure as `cowork_metrics.distinct_plugins_used_count`, for activity
   * recorded while members had Chat and Cowork unified turned on. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  distinct_plugins_used_count: number | null;

  /**
   * Same measure as `cowork_metrics.distinct_session_count`, for activity recorded
   * while members had Chat and Cowork unified turned on. Approximate (HLL, typical
   * error <2%) in date-range mode. Null on aggregated rows where a distinct count
   * cannot be computed.
   */
  distinct_session_count: number | null;

  /**
   * Same measure as `cowork_metrics.distinct_skills_used_count`, for activity
   * recorded while members had Chat and Cowork unified turned on. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  distinct_skills_used_count: number | null;

  /**
   * Same measure as `cowork_metrics.edit_tool_count`, for activity recorded while
   * members had Chat and Cowork unified turned on.
   */
  edit_tool_count: number | null;

  /**
   * Same measure as `cowork_metrics.file_edit_count`, for activity recorded while
   * members had Chat and Cowork unified turned on.
   */
  file_edit_count: number | null;

  /**
   * Same measure as `cowork_metrics.message_count`, for activity recorded while
   * members had Chat and Cowork unified turned on.
   */
  message_count: number;

  /**
   * Same measure as `cowork_metrics.multi_edit_tool_count`, for activity recorded
   * while members had Chat and Cowork unified turned on. Claude no longer has a
   * multi-edit tool, so expect 0 when not null; each edit is now a separate Edit
   * tool call, counted in `edit_tool_count` and `file_edit_count`.
   */
  multi_edit_tool_count: number | null;

  /**
   * Same measure as `cowork_metrics.notebook_edit_tool_count`, for activity recorded
   * while members had Chat and Cowork unified turned on.
   */
  notebook_edit_tool_count: number | null;

  /**
   * Same measure as `cowork_metrics.plugins_used_count`, for activity recorded while
   * members had Chat and Cowork unified turned on.
   */
  plugins_used_count: number | null;

  /**
   * Same measure as `cowork_metrics.sessions_with_file_edits_count`, for activity
   * recorded while members had Chat and Cowork unified turned on. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  sessions_with_file_edits_count: number | null;

  /**
   * Same measure as `cowork_metrics.skills_used_count`, for activity recorded while
   * members had Chat and Cowork unified turned on.
   */
  skills_used_count: number;

  /**
   * Same measure as `cowork_metrics.write_tool_count`, for activity recorded while
   * members had Chat and Cowork unified turned on.
   */
  write_tool_count: number | null;
}

/**
 * Claude.ai activity metrics for a single user on a given day.
 */
export interface AnalyticsChatMetrics {
  /**
   * Number of MCP connector invocations.
   */
  connectors_used_count: number;

  /**
   * Number of distinct artifacts created. Exact in date-range mode: a creation
   * belongs to exactly one day, so the per-day counts never overlap and their sum
   * over the window is the exact count of distinct creations in it.
   */
  distinct_artifacts_created_count: number;

  /**
   * Distinct claude.ai connectors this user used. Excludes calls whose connector
   * could not be identified and all calls from organizations with zero data
   * retention. Approximate (HLL, typical error <2%) in date-range mode. Null on
   * aggregated rows where a distinct count cannot be computed.
   */
  distinct_connectors_used_count: number | null;

  /**
   * Number of distinct conversations the user participated in. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  distinct_conversation_count: number | null;

  /**
   * Number of distinct files uploaded. Approximate (HLL, typical error <2%) in
   * date-range mode. Null on aggregated rows where a distinct count cannot be
   * computed.
   */
  distinct_files_uploaded_count: number | null;

  /**
   * Number of distinct projects created. Exact in date-range mode: a creation
   * belongs to exactly one day, so the per-day counts never overlap and their sum
   * over the window is the exact count of distinct creations in it.
   */
  distinct_projects_created_count: number;

  /**
   * Number of distinct projects used. Approximate (HLL, typical error <2%) in
   * date-range mode. Null on aggregated rows where a distinct count cannot be
   * computed.
   */
  distinct_projects_used_count: number | null;

  /**
   * Number of distinct shared artifacts the user viewed. Approximate (HLL, typical
   * error <2%) in date-range mode. Null on aggregated rows where a distinct count
   * cannot be computed.
   */
  distinct_shared_artifacts_viewed_count: number | null;

  /**
   * Number of distinct skills used. Approximate (HLL, typical error <2%) in
   * date-range mode. Null on aggregated rows where a distinct count cannot be
   * computed.
   */
  distinct_skills_used_count: number | null;

  /**
   * Number of messages sent
   */
  message_count: number;

  /**
   * Number of times the user opened a shared conversation in a project
   */
  shared_conversations_viewed_count: number;

  /**
   * Number of messages that used extended thinking
   */
  thinking_message_count: number;
}

/**
 * Claude Code activity metrics for a single user on a given day.
 */
export interface AnalyticsClaudeCodeMetrics {
  /**
   * Core Claude Code activity metrics for a single user on a given day.
   */
  core_metrics: AnalyticsCoreCodeMetrics;

  /**
   * Per-tool accepted/rejected counts for Claude Code file modification tools.
   */
  tool_actions: AnalyticsToolActions;
}

/**
 * Per-connector activity data for a given day.
 */
export interface AnalyticsConnectorActivity {
  /**
   * Claude.ai activity metrics for a single connector on a given day.
   */
  chat_metrics: AnalyticsConnectorChatMetrics;

  /**
   * Claude Code activity metrics for a single connector on a given day.
   */
  claude_code_metrics: AnalyticsConnectorClaudeCodeMetrics;

  /**
   * Human-readable display name for rows whose `connector_name` is an opaque
   * connector id rather than a readable name, resolved at request time from the
   * organization's connectors (including connectors that have since been removed).
   * `connector_name` remains the row's stable key for sorting and pagination, and
   * `filter[]=connector_name:{value}` also matches these rows by display name.
   * Display names are not unique, and the same connector's claude.ai usage can
   * appear under a separate row with a readable `connector_name`. Null when
   * `connector_name` is already a readable name, when the id cannot be resolved to
   * one of the organization's connectors, or when display-name resolution is not
   * enabled for this organization.
   */
  connector_display_name: string | null;

  /**
   * Name of the connector. Some rows carry an opaque connector id here instead of a
   * readable name; `connector_display_name` holds the resolved name for those rows.
   */
  connector_name: string;

  /**
   * Cowork activity metrics for a single connector on a given day.
   */
  cowork_metrics: AnalyticsConnectorCoworkMetrics;

  /**
   * Number of distinct users who used the connector on the requested day, or, in
   * date-range mode, over the requested window — recomputed as an exact distinct
   * count over the window's per-member daily rows, never a sum of per-day values.
   */
  distinct_user_count: number;

  /**
   * Number of distinct users whose use of this connector on the requested day ran on
   * their own individual credential, connected through their own consent flow.
   * Companion bucket to `managed_auth_distinct_user_count`, which carries the
   * measurement, attribution, and null rules. Users whose requests used no stored
   * credential count in neither bucket.
   */
  individual_auth_distinct_user_count: number | null;

  /**
   * Number of distinct users whose use of this connector on the requested day ran on
   * Enterprise Managed Auth (an organization-managed credential provisioned through
   * the organization's identity provider), read from the token record each request
   * used. Null, never 0, when managed-auth reporting is not enabled for the
   * organization, the value cannot be attributed to the row, no credentialed
   * requests and no managed-token mint events (a managed credential being
   * provisioned for a user's use of the connector) were observed that day, or the
   * day predates 2026-07-01, the first day the backing data exists (forward-only
   * data, no backfill). When credentialed requests or mint events were observed and
   * attributed, both managed-auth fields populate, reporting 0 for a bucket with no
   * users; the two counts are independent, not a partition — a user whose requests
   * that day used both kinds of credential counts in both. Mint events carry user
   * but not surface attribution, so they count as observed auth activity on
   * `user_id` and `rbac_group_id` cuts — attributed to the user the credential was
   * provisioned for — but never on a cut that references `product` (group or
   * filter). Date-range rollup mode (`starting_date`/`ending_date`) computes both
   * fields exactly over the window — distinct users with at least one qualifying day
   * — when the whole window starts on or after 2026-07-01, with the null-versus-0
   * and mint-event rules applying with the window in place of the day; a range
   * starting earlier reports every managed-auth field as null, never a
   * partial-window value.
   */
  managed_auth_distinct_user_count: number | null;

  /**
   * Office Agent activity metrics for a single connector on a given day, broken out
   * by Office product.
   */
  office_metrics: AnalyticsConnectorOfficeMetrics;

  /**
   * Number of connector tool calls on the requested day whose trusted read-only
   * annotation marked them read-only. Call count, not distinct users. Every call
   * recorded on a classified surface lands in exactly one of `read_call_count`,
   * `write_call_count`, or `unclassified_call_count`, so the three sum to the day's
   * classified calls. Classification is forward-only per surface: claude.ai from
   * 2026-06-01, Claude Code from 2026-05-30, Claude in Office from 2026-05-29,
   * Cowork from 2026-06-02 (Cowork clients predating annotation forwarding land in
   * `unclassified_call_count`). Null, never 0, when the value cannot be stated: the
   * read/write split is not enabled for this organization, or the day predates
   * 2026-05-29. For a date-range total, sum the per-day values, but treat a window
   * that extends before 2026-05-29 as null rather than summing only its covered days
   * — date-range rollup mode (`starting_date`/`ending_date`) applies both rules
   * server-side.
   */
  read_call_count: number | null;

  /**
   * Number of connector tool calls on the requested day with no trusted read-only
   * annotation — the annotation is optional in the MCP spec and is discarded when
   * connector access controls are active, so unclassified calls are common. This
   * field shows how much of the day's classified activity the read/write split
   * actually covers. Call count, not distinct users. One of the three
   * call-classification buckets; see `read_call_count` for the per-surface
   * data-start dates, null conditions, and date-range guidance.
   */
  unclassified_call_count: number | null;

  /**
   * Number of connector tool calls on the requested day whose trusted read-only
   * annotation marked them not read-only. Call count, not distinct users. One of the
   * three call-classification buckets; see `read_call_count` for the per-surface
   * data-start dates, null conditions, and date-range guidance.
   */
  write_call_count: number | null;

  /**
   * Connector use recorded while members had Chat and Cowork unified (Cowork's
   * features inside claude.ai chat) turned on, split into chat conversations and
   * Cowork sessions. A count is null in date-range mode where it cannot be computed.
   * Omitted from the response where Chat and Cowork unified is not available.
   */
  chat_cowork_unified_metrics?: AnalyticsConnectorChatCoworkUnifiedMetrics | null;

  /**
   * Product that produced this row's activity: one of `chat`, `claude_code`,
   * `cowork`, `office_agent`, or `chat_cowork_unified` (Chat and Cowork unified).
   * These are the canonical Cost & Usage product names; an `office_agent` row's
   * per-surface breakdown is in its `office_metrics`. On `/plugins` only `cowork`,
   * `claude_code` and `chat_cowork_unified` occur (the only surfaces with plugin
   * attribution); on `/artifacts` only `chat`, `claude_code`, `cowork` and
   * `chat_cowork_unified` occur (the surfaces that create artifacts);
   * `/apps/chat/projects` does not support the product dimension (a `product` entry
   * in `group_by[]` or `filter[]` there is rejected). Present only when the request
   * grouped by `product`.
   */
  product?: string | null;

  /**
   * Tagged RBAC group identifier (`rbac_group_...`), matching the spend-limits API
   * spelling. Present only when the request grouped by `rbac_group_id`.
   */
  rbac_group_id?: string | null;

  /**
   * Resolved RBAC group display name, alongside `rbac_group_id` when name resolution
   * is available. Null if the group has been deleted or its name could not be
   * resolved; `rbac_group_id` remains the stable key.
   */
  rbac_group_name?: string | null;

  /**
   * Tagged user identifier (e.g. `user_...`). Present only when the request grouped
   * by `user_id`.
   */
  user_id?: string | null;
}

/**
 * A connector's use in chat conversations recorded while members had Chat and
 * Cowork unified turned on.
 */
export interface AnalyticsConnectorChatCoworkUnifiedChatMetrics {
  /**
   * Same measure as `chat_metrics.distinct_conversation_connector_used_count`, for
   * activity recorded while members had Chat and Cowork unified turned on.
   * Approximate (HLL, typical error <2%) in date-range mode. Null on aggregated rows
   * where a distinct count cannot be computed.
   */
  distinct_conversation_connector_used_count: number | null;
}

/**
 * A connector's use in Chat and Cowork unified on one day: `chat` holds its use in
 * chat conversations and `sessions` its use in Cowork sessions.
 */
export interface AnalyticsConnectorChatCoworkUnifiedMetrics {
  /**
   * A connector's use in chat conversations recorded while members had Chat and
   * Cowork unified turned on.
   */
  chat: AnalyticsConnectorChatCoworkUnifiedChatMetrics;

  /**
   * A connector's use in Cowork sessions recorded while members had Chat and Cowork
   * unified turned on.
   */
  sessions: AnalyticsConnectorChatCoworkUnifiedSessionsMetrics;
}

/**
 * A connector's use in Cowork sessions recorded while members had Chat and Cowork
 * unified turned on.
 */
export interface AnalyticsConnectorChatCoworkUnifiedSessionsMetrics {
  /**
   * Same measure as `cowork_metrics.distinct_session_connector_used_count`, for
   * activity recorded while members had Chat and Cowork unified turned on.
   * Approximate (HLL, typical error <2%) in date-range mode. Null on aggregated rows
   * where a distinct count cannot be computed.
   */
  distinct_session_connector_used_count: number | null;
}

/**
 * Claude.ai activity metrics for a single connector on a given day.
 */
export interface AnalyticsConnectorChatMetrics {
  /**
   * Number of distinct conversations in which the connector was used. Approximate
   * (HLL, typical error <2%) in date-range mode. Null on aggregated rows where a
   * distinct count cannot be computed.
   */
  distinct_conversation_connector_used_count: number | null;
}

/**
 * Claude Code activity metrics for a single connector on a given day.
 */
export interface AnalyticsConnectorClaudeCodeMetrics {
  /**
   * Number of distinct Claude Code sessions in which the connector was used.
   * Approximate (HLL, typical error <2%) in date-range mode. Null on aggregated rows
   * where a distinct count cannot be computed.
   */
  distinct_session_connector_used_count: number | null;
}

/**
 * Cowork activity metrics for a single connector on a given day.
 */
export interface AnalyticsConnectorCoworkMetrics {
  /**
   * Number of distinct Cowork sessions in which the connector was used. Approximate
   * (HLL, typical error <2%) in date-range mode. Null on aggregated rows where a
   * distinct count cannot be computed.
   */
  distinct_session_connector_used_count: number | null;
}

/**
 * A dimension to group connector activity by.
 */
export type AnalyticsConnectorGroupBy = 'product' | 'rbac_group_id' | 'user_id';

/**
 * Office Agent activity metrics for a single connector on a given day, broken out
 * by Office product.
 */
export interface AnalyticsConnectorOfficeMetrics {
  /**
   * Office Agent activity metrics for a single connector on a given day within one
   * Office product.
   */
  excel: AnalyticsConnectorOfficeProductMetrics;

  /**
   * Office Agent activity metrics for a single connector on a given day within one
   * Office product.
   */
  outlook: AnalyticsConnectorOfficeProductMetrics;

  /**
   * Office Agent activity metrics for a single connector on a given day within one
   * Office product.
   */
  powerpoint: AnalyticsConnectorOfficeProductMetrics;

  /**
   * Office Agent activity metrics for a single connector on a given day within one
   * Office product.
   */
  word: AnalyticsConnectorOfficeProductMetrics;
}

/**
 * Office Agent activity metrics for a single connector on a given day within one
 * Office product.
 */
export interface AnalyticsConnectorOfficeProductMetrics {
  /**
   * Number of distinct Office Agent sessions in which the connector was used.
   * Approximate (HLL, typical error <2%) in date-range mode. Null on aggregated rows
   * where a distinct count cannot be computed.
   */
  distinct_session_connector_used_count: number | null;
}

/**
 * Core Claude Code activity metrics for a single user on a given day.
 */
export interface AnalyticsCoreCodeMetrics {
  /**
   * Number of artifacts created in Claude Code sessions: an artifact counts once, on
   * the day a session first saves it. Counted from 2026-08-17; 0 on earlier days.
   * Exact in date-range mode: a creation belongs to exactly one day, so the per-day
   * counts never overlap and their sum over the window is the exact count of
   * distinct creations in it.
   */
  artifacts_created_count: number;

  /**
   * Number of commits made via Claude Code
   */
  commit_count: number;

  /**
   * Number of distinct Claude Code sessions. On aggregated rows and in date-range
   * mode: summed per-day distinct counts. A session essentially never spans a UTC
   * day, so the sum is in practice the true distinct count.
   */
  distinct_session_count: number | null;

  /**
   * Lines of code added and removed via Claude Code.
   */
  lines_of_code: AnalyticsLinesOfCode;

  /**
   * Number of pull requests created via Claude Code
   */
  pull_request_count: number;
}

/**
 * Cowork activity metrics for a single user on a given day.
 */
export interface AnalyticsCoworkMetrics {
  /**
   * Number of tool actions completed in Cowork sessions
   */
  action_count: number;

  /**
   * Number of artifacts created in Cowork sessions: an artifact counts once, on the
   * day a session first saves it. Counted from 2026-08-17; 0 on earlier days. Exact
   * in date-range mode: a creation belongs to exactly one day, so the per-day counts
   * never overlap and their sum over the window is the exact count of distinct
   * creations in it.
   */
  artifacts_created_count: number;

  /**
   * Total number of connector invocations in Cowork sessions
   */
  connectors_used_count: number;

  /**
   * Number of Dispatch (background agent) turns completed
   */
  dispatch_turn_count: number;

  /**
   * Number of distinct connectors used in Cowork sessions. Approximate (HLL, typical
   * error <2%) in date-range mode. Null on aggregated rows where a distinct count
   * cannot be computed.
   */
  distinct_connectors_used_count: number | null;

  /**
   * Number of distinct plugins used in Cowork sessions. Null while Cowork plugin-use
   * metrics are not enabled for this organization. Approximate (HLL, typical error
   * <2%) in date-range mode. Null on aggregated rows where a distinct count cannot
   * be computed.
   */
  distinct_plugins_used_count: number | null;

  /**
   * Number of distinct Cowork sessions. Approximate (HLL, typical error <2%) in
   * date-range mode. Null on aggregated rows where a distinct count cannot be
   * computed.
   */
  distinct_session_count: number | null;

  /**
   * Number of distinct skills used in Cowork sessions. Approximate (HLL, typical
   * error <2%) in date-range mode. Null on aggregated rows where a distinct count
   * cannot be computed.
   */
  distinct_skills_used_count: number | null;

  /**
   * Number of successful Edit tool calls in Cowork sessions. Null while the
   * file-edit metrics are not enabled for this organization.
   */
  edit_tool_count: number | null;

  /**
   * Number of successful file-edit tool calls (Edit, MultiEdit, Write, NotebookEdit)
   * in Cowork sessions. Null, never 0, while the file-edit metrics are not enabled
   * for this organization.
   */
  file_edit_count: number | null;

  /**
   * Number of messages sent in Cowork sessions
   */
  message_count: number;

  /**
   * Number of successful MultiEdit tool calls in Cowork sessions. Null while the
   * file-edit metrics are not enabled for this organization.
   */
  multi_edit_tool_count: number | null;

  /**
   * Number of successful NotebookEdit tool calls in Cowork sessions. Null while the
   * file-edit metrics are not enabled for this organization.
   */
  notebook_edit_tool_count: number | null;

  /**
   * Total number of plugin invocations in Cowork sessions. Null while Cowork
   * plugin-use metrics are not enabled for this organization.
   */
  plugins_used_count: number | null;

  /**
   * Number of distinct Cowork sessions with at least one successful file-edit tool
   * call. Null while the file-edit metrics are not enabled for this organization.
   * Approximate (HLL, typical error <2%) in date-range mode. Null on aggregated rows
   * where a distinct count cannot be computed.
   */
  sessions_with_file_edits_count: number | null;

  /**
   * Total number of skill invocations in Cowork sessions
   */
  skills_used_count: number;

  /**
   * Number of successful Write tool calls in Cowork sessions. Null while the
   * file-edit metrics are not enabled for this organization.
   */
  write_tool_count: number | null;
}

/**
 * Claude Design activity metrics for a single user on a given day.
 */
export interface AnalyticsDesignMetrics {
  /**
   * Number of distinct Claude Design projects created. Exact in date-range mode: a
   * creation belongs to exactly one day, so the per-day counts never overlap and
   * their sum over the window is the exact count of distinct creations in it.
   */
  distinct_projects_created_count: number;

  /**
   * Number of distinct Claude Design projects the user worked in. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  distinct_projects_used_count: number | null;

  /**
   * Number of distinct Claude Design sessions. Approximate (HLL, typical error <2%)
   * in date-range mode. Null on aggregated rows where a distinct count cannot be
   * computed.
   */
  distinct_session_count: number | null;

  /**
   * Number of messages sent in Claude Design sessions
   */
  message_count: number;
}

/**
 * Lines of code added and removed via Claude Code.
 */
export interface AnalyticsLinesOfCode {
  /**
   * Lines of code added
   */
  added_count: number;

  /**
   * Lines of code removed
   */
  removed_count: number;
}

/**
 * Office Agent activity metrics for a single user on a given day, broken out by
 * Office product.
 */
export interface AnalyticsOfficeMetrics {
  /**
   * Office Agent activity metrics for a single user on a given day within one Office
   * product.
   */
  excel: AnalyticsOfficeProductMetrics;

  /**
   * Office Agent activity metrics for a single user on a given day within one Office
   * product.
   */
  outlook: AnalyticsOfficeProductMetrics;

  /**
   * Office Agent activity metrics for a single user on a given day within one Office
   * product.
   */
  powerpoint: AnalyticsOfficeProductMetrics;

  /**
   * Office Agent activity metrics for a single user on a given day within one Office
   * product.
   */
  word: AnalyticsOfficeProductMetrics;
}

/**
 * Office Agent activity metrics for a single user on a given day within one Office
 * product.
 */
export interface AnalyticsOfficeProductMetrics {
  /**
   * Number of MCP connector invocations
   */
  connectors_used_count: number;

  /**
   * Number of distinct MCP connectors used. Approximate (HLL, typical error <2%) in
   * date-range mode. Null on aggregated rows where a distinct count cannot be
   * computed.
   */
  distinct_connectors_used_count: number | null;

  /**
   * Number of distinct Office Agent sessions. Approximate (HLL, typical error <2%)
   * in date-range mode. Null on aggregated rows where a distinct count cannot be
   * computed.
   */
  distinct_session_count: number | null;

  /**
   * Number of distinct skills used. Approximate (HLL, typical error <2%) in
   * date-range mode. Null on aggregated rows where a distinct count cannot be
   * computed.
   */
  distinct_skills_used_count: number | null;

  /**
   * Number of messages sent
   */
  message_count: number;

  /**
   * Number of skill invocations
   */
  skills_used_count: number;
}

/**
 * Sort direction: `asc` or `desc`. Defaults to `asc` for the endpoint's sort
 * column and to `desc` when `order_by` names a metric (a top-N ranking). Applies
 * to `order_by`, or to the endpoint's default sort field when `order_by` is
 * omitted.
 */
export type AnalyticsOrder = 'asc' | 'desc';

/**
 * Per-plugin install + invocation activity for a given day.
 *
 * With `group_by[]=user_id` / `rbac_group_id` / `product` (`cowork`, `claude_code`
 * and `chat_cowork_unified` only on this endpoint) each row is one (plugin, user),
 * (plugin, group), or (plugin, product) cut: the flat `user_id` / `rbac_group_id`
 * / `product` keys carry the cut and the counts are scoped to it.
 */
export interface AnalyticsPluginActivity {
  /**
   * Claude Code activity metrics for a single plugin on a given day.
   */
  claude_code_metrics: AnalyticsPluginClaudeCodeMetrics;

  /**
   * Cowork activity metrics for a single plugin on a given day.
   */
  cowork_metrics: AnalyticsPluginCoworkMetrics;

  /**
   * Number of distinct users with recorded install or invocation activity for the
   * plugin on the requested day (install-only users count), or, in date-range mode,
   * over the requested window — recomputed as an exact distinct count over the
   * window's per-member daily rows, never a sum of per-day values.
   */
  distinct_user_count: number;

  /**
   * Number of distinct users who installed the plugin on the requested day, or, in
   * date-range mode, over the requested window — recomputed as an exact distinct
   * count over the window's per-member daily rows, never a sum of per-day values.
   */
  install_count: number | null;

  /**
   * Number of plugin invocations on the requested day
   */
  invocation_count: number;

  /**
   * Stable plugin identifier when available (e.g. `serena@claude-plugins-official`).
   * Null for third-party Claude Code plugins (redacted at the source) and Cowork
   * slash commands that carry only a hashed id.
   */
  plugin_id: string | null;

  /**
   * Name of the plugin
   */
  plugin_name: string;

  /**
   * Plugin use recorded while members had Chat and Cowork unified (Cowork's features
   * inside claude.ai chat) turned on. A count is null in date-range mode where it
   * cannot be computed. Omitted from the response where Chat and Cowork unified is
   * not available.
   */
  chat_cowork_unified_metrics?: AnalyticsPluginChatCoworkUnifiedMetrics | null;

  /**
   * Product that produced this row's activity: one of `chat`, `claude_code`,
   * `cowork`, `office_agent`, or `chat_cowork_unified` (Chat and Cowork unified).
   * These are the canonical Cost & Usage product names; an `office_agent` row's
   * per-surface breakdown is in its `office_metrics`. On `/plugins` only `cowork`,
   * `claude_code` and `chat_cowork_unified` occur (the only surfaces with plugin
   * attribution); on `/artifacts` only `chat`, `claude_code`, `cowork` and
   * `chat_cowork_unified` occur (the surfaces that create artifacts);
   * `/apps/chat/projects` does not support the product dimension (a `product` entry
   * in `group_by[]` or `filter[]` there is rejected). Present only when the request
   * grouped by `product`.
   */
  product?: string | null;

  /**
   * Tagged RBAC group identifier (`rbac_group_...`), matching the spend-limits API
   * spelling. Present only when the request grouped by `rbac_group_id`.
   */
  rbac_group_id?: string | null;

  /**
   * Resolved RBAC group display name, alongside `rbac_group_id` when name resolution
   * is available. Null if the group has been deleted or its name could not be
   * resolved; `rbac_group_id` remains the stable key.
   */
  rbac_group_name?: string | null;

  /**
   * Tagged user identifier (e.g. `user_...`). Present only when the request grouped
   * by `user_id`.
   */
  user_id?: string | null;
}

/**
 * A plugin's use in Cowork sessions recorded while members had Chat and Cowork
 * unified turned on.
 */
export interface AnalyticsPluginChatCoworkUnifiedMetrics {
  /**
   * Same measure as `cowork_metrics.distinct_session_plugin_used_count`, for
   * activity recorded while members had Chat and Cowork unified turned on. Null on
   * aggregated rows where a distinct count cannot be computed.
   */
  distinct_session_plugin_used_count: number | null;
}

/**
 * Claude Code activity metrics for a single plugin on a given day.
 */
export interface AnalyticsPluginClaudeCodeMetrics {
  /**
   * Number of distinct Claude Code sessions in which the plugin was invoked. Null on
   * aggregated rows where a distinct count cannot be computed.
   */
  distinct_session_plugin_used_count: number | null;
}

/**
 * Cowork activity metrics for a single plugin on a given day.
 */
export interface AnalyticsPluginCoworkMetrics {
  /**
   * Number of distinct Cowork sessions in which the plugin was invoked. Null on
   * aggregated rows where a distinct count cannot be computed.
   */
  distinct_session_plugin_used_count: number | null;
}

/**
 * A dimension to group plugin activity by.
 */
export type AnalyticsPluginGroupBy = 'product' | 'rbac_group_id' | 'user_id';

/**
 * Per-project activity data for a given day.
 */
export interface AnalyticsProjectActivity {
  /**
   * Project creation timestamp in RFC 3339 format. Null if the project was deleted
   * before attribution was recorded.
   */
  created_at: string | null;

  /**
   * User who created the project. Null if the project was deleted before attribution
   * was recorded, or if the creator's account no longer exists.
   */
  created_by: AnalyticsUser | null;

  /**
   * Number of distinct conversations in the project. Null on aggregated rows where a
   * distinct count cannot be computed.
   */
  distinct_conversation_count: number | null;

  /**
   * Number of distinct users who used the project on the requested day, or, in
   * date-range mode, over the requested window — recomputed as an exact distinct
   * count over the window's per-member daily rows, never a sum of per-day values.
   */
  distinct_user_count: number;

  /**
   * Number of messages sent in the project on the requested day
   */
  message_count: number;

  /**
   * Tagged project identifier (e.g. `claude_proj_...`)
   */
  project_id: string;

  /**
   * Name of the project
   */
  project_name: string;

  /**
   * Tagged RBAC group identifier (`rbac_group_...`), matching the spend-limits API
   * spelling. Present only when the request grouped by `rbac_group_id`.
   */
  rbac_group_id?: string | null;

  /**
   * Resolved RBAC group display name, alongside `rbac_group_id` when name resolution
   * is available. Null if the group has been deleted or its name could not be
   * resolved; `rbac_group_id` remains the stable key.
   */
  rbac_group_name?: string | null;

  /**
   * Tagged user identifier (e.g. `user_...`). Present only when the request grouped
   * by `user_id`.
   */
  user_id?: string | null;
}

/**
 * A dimension to group chat project activity by.
 */
export type AnalyticsProjectGroupBy = 'rbac_group_id' | 'user_id';

/**
 * Claude Science activity metrics for a single user on a given day.
 */
export interface AnalyticsScienceMetrics {
  /**
   * Number of delegations (handoffs to a specialized agent) in Claude Science
   * sessions
   */
  delegation_count: number;

  /**
   * Number of distinct Claude Science sessions. Approximate (HLL, typical error <2%)
   * in date-range mode. Null on aggregated rows where a distinct count cannot be
   * computed.
   */
  distinct_session_count: number | null;

  /**
   * Number of messages sent in Claude Science sessions
   */
  message_count: number;

  /**
   * Number of remote compute jobs launched from Claude Science sessions
   */
  remote_compute_job_count: number;

  /**
   * Total number of skill invocations in Claude Science sessions
   */
  skills_used_count: number;
}

/**
 * Per-day entry in the /summaries response.
 */
export interface AnalyticsSingleDayActivitySummary {
  /**
   * Number of seats currently assigned to members. Null when the response is scoped
   * to an RBAC group — seat assignment is org-wide and has no per-group analogue.
   */
  assigned_seat_count: number | null;

  /**
   * Number of users with Cowork activity on the requested day
   */
  cowork_daily_active_user_count: number;

  /**
   * Number of users with Cowork activity in the 30-day rolling window
   */
  cowork_monthly_active_user_count: number;

  /**
   * Number of users with Cowork activity in the 7-day rolling window
   */
  cowork_weekly_active_user_count: number;

  /**
   * Number of users with token consumption on the requested day
   */
  daily_active_user_count: number;

  /**
   * Percentage of assigned seats with activity on the requested day
   * (`DAU / assigned_seat_count * 100`). Null when the response is scoped to an RBAC
   * group.
   */
  daily_adoption_rate: number | null;

  /**
   * End of the aggregation period (exclusive), UTC midnight in RFC 3339 format (e.g.
   * `2026-01-16T00:00:00Z`).
   */
  ending_at: string;

  /**
   * Number of users with token consumption in the 30-day rolling window
   */
  monthly_active_user_count: number;

  /**
   * Percentage of assigned seats with activity in the 30-day rolling window
   * (`MAU / assigned_seat_count * 100`). Null when the response is scoped to an RBAC
   * group.
   */
  monthly_adoption_rate: number | null;

  /**
   * Number of pending invitations to join the organization. Null when the response
   * is scoped to an RBAC group.
   */
  pending_invite_count: number | null;

  /**
   * Start of the aggregation period (inclusive), UTC midnight in RFC 3339 format
   * (e.g. `2026-01-15T00:00:00Z`).
   */
  starting_at: string;

  /**
   * Number of users with token consumption in the 7-day rolling window
   */
  weekly_active_user_count: number;

  /**
   * Percentage of assigned seats with activity in the 7-day rolling window
   * (`WAU / assigned_seat_count * 100`). Null when the response is scoped to an RBAC
   * group.
   */
  weekly_adoption_rate: number | null;

  /**
   * Number of users with activity in Chat and Cowork unified on the requested day.
   * Omitted from the response where Chat and Cowork unified is not available.
   */
  chat_cowork_unified_daily_active_user_count?: number | null;

  /**
   * Number of users with activity in Chat and Cowork unified in the 28-day rolling
   * window (30 days when the request filters by `rbac_group_id`). Omitted from the
   * response where Chat and Cowork unified is not available.
   */
  chat_cowork_unified_monthly_active_user_count?: number | null;

  /**
   * Number of users with activity in Chat and Cowork unified in the 7-day rolling
   * window. Omitted from the response where Chat and Cowork unified is not
   * available.
   */
  chat_cowork_unified_weekly_active_user_count?: number | null;

  /**
   * Number of users with claude.ai (chat) activity on the requested day. Omitted
   * from the response while the per-product breakdown is not enabled for this
   * organization.
   */
  chat_daily_active_user_count?: number | null;

  /**
   * Number of users with claude.ai (chat) activity in the 30-day rolling window.
   * Omitted from the response while the per-product breakdown is not enabled for
   * this organization.
   */
  chat_monthly_active_user_count?: number | null;

  /**
   * Number of users with claude.ai (chat) activity in the 7-day rolling window.
   * Omitted from the response while the per-product breakdown is not enabled for
   * this organization.
   */
  chat_weekly_active_user_count?: number | null;

  /**
   * Number of users with Claude Code activity on the requested day. Omitted from the
   * response while the per-product breakdown is not enabled for this organization.
   */
  claude_code_daily_active_user_count?: number | null;

  /**
   * Number of users with Claude Code activity in the 30-day rolling window. Omitted
   * from the response while the per-product breakdown is not enabled for this
   * organization.
   */
  claude_code_monthly_active_user_count?: number | null;

  /**
   * Number of users with Claude Code activity in the 7-day rolling window. Omitted
   * from the response while the per-product breakdown is not enabled for this
   * organization.
   */
  claude_code_weekly_active_user_count?: number | null;

  /**
   * Number of users with Claude Design activity on the requested day. Omitted from
   * the response while the per-product breakdown is not enabled for this
   * organization.
   */
  claude_design_daily_active_user_count?: number | null;

  /**
   * Number of users with Claude Design activity in the 30-day rolling window.
   * Omitted from the response while the per-product breakdown is not enabled for
   * this organization.
   */
  claude_design_monthly_active_user_count?: number | null;

  /**
   * Number of users with Claude Design activity in the 7-day rolling window. Omitted
   * from the response while the per-product breakdown is not enabled for this
   * organization.
   */
  claude_design_weekly_active_user_count?: number | null;

  /**
   * Number of users with Claude in Office activity on the requested day. Omitted
   * from the response while the per-product breakdown is not enabled for this
   * organization.
   */
  office_agent_daily_active_user_count?: number | null;

  /**
   * Number of users with Claude in Office activity in the 30-day rolling window.
   * Omitted from the response while the per-product breakdown is not enabled for
   * this organization.
   */
  office_agent_monthly_active_user_count?: number | null;

  /**
   * Number of users with Claude in Office activity in the 7-day rolling window.
   * Omitted from the response while the per-product breakdown is not enabled for
   * this organization.
   */
  office_agent_weekly_active_user_count?: number | null;

  /**
   * Number of users with Claude Science activity on the requested day. Omitted from
   * the response while the per-product breakdown is not enabled for this
   * organization.
   */
  science_daily_active_user_count?: number | null;

  /**
   * Number of users with a Claude Science seat entitlement (per-seat RBAC) at the
   * time of the daily snapshot. The funnel top; independent of the org-level Claude
   * Science toggle. Null when the response is scoped to an RBAC group — entitlement
   * is org-wide and has no per-group analogue. Omitted from the response while the
   * per-product breakdown is not enabled for this organization.
   */
  science_entitled_user_count?: number | null;

  /**
   * Number of users with Claude Science activity in the 30-day rolling window.
   * Omitted from the response while the per-product breakdown is not enabled for
   * this organization.
   */
  science_monthly_active_user_count?: number | null;

  /**
   * Number of users with Claude Science activity in the 7-day rolling window.
   * Omitted from the response while the per-product breakdown is not enabled for
   * this organization.
   */
  science_weekly_active_user_count?: number | null;
}

/**
 * Per-skill activity data for a given day.
 */
export interface AnalyticsSkillActivity {
  /**
   * List-price (rate-card) value of the member requests attributed to this skill, as
   * a decimal string in the minor unit of `currency` (cents for USD), from Claude
   * Code, Cowork, and Office Agent request-level attribution — the value of requests
   * that involved the skill, not the skill's incremental cost. Unlike
   * `estimated_overage_spend` this reflects usage value regardless of how it was
   * funded — seat-covered usage counts — but it is undiscounted and does not tie to
   * billed spend or the organization's spend reporting. claude.ai chat usage carries
   * no request-level attribution and contributes nothing: the field is null on
   * `chat` product rows and on `office_agent` product cuts dated before 2026-06-18
   * (the Office Agent attribution data-start), and on ungrouped rows it covers the
   * Claude Code + Cowork + Office Agent share only (null when no attributable usage
   * exists). Also null under the same conditions as `estimated_overage_spend` (spend
   * reporting not enabled for this organization, `office_agent` product cuts before
   * the 2026-06-18 data-start). "0" means attributable usage existed but none was
   * attributed to this skill. Addable across days: date-range rollup mode returns
   * the window's sum. On `group_by[]` and `filter[]` shapes both amounts can total
   * below the ungrouped value for the same skill over the same date or range: spend
   * attributed to a member–skill pair with no counted usage on that day is excluded
   * from those cuts.
   */
  attributed_list_price: string | null;

  /**
   * Claude.ai activity metrics for a single skill on a given day.
   */
  chat_metrics: AnalyticsSkillChatMetrics;

  /**
   * Claude Code activity metrics for a single skill on a given day.
   */
  claude_code_metrics: AnalyticsSkillClaudeCodeMetrics;

  /**
   * Cowork activity metrics for a single skill on a given day.
   */
  cowork_metrics: AnalyticsSkillCoworkMetrics;

  /**
   * Currency for this row's monetary fields (`estimated_overage_spend` and
   * `attributed_list_price`), as an uppercase ISO-4217 code. Always "USD" when
   * either amount is populated; null whenever both amounts are null.
   */
  currency: string | null;

  /**
   * Number of distinct users who used the skill on the requested day, or, in
   * date-range mode, over the requested window — recomputed as an exact distinct
   * count over the window's per-member daily rows, never a sum of per-day values. A
   * skill counts as used only when it is explicitly activated — the model (or the
   * user, via the skill's slash command) invokes it, reading its instructions into
   * context as part of that activation. Skills that are merely installed or listed
   * as available, or whose content reaches the context without an activation
   * (preloaded, hook-injected, or read as a plain file), are not counted.
   */
  distinct_user_count: number;

  /**
   * Distinct accounts that enabled this skill on the requested day (claude.ai only —
   * the skill analog of plugin `install_count`). The count is org-wide: null when
   * enable reporting is not enabled for this organization, or when the request
   * scopes to `user_id` / `rbac_group_id` / `product` via `group_by[]` or `filter[]`
   * (an org-wide count would be misleading on per-cut rows). A distinct count, not
   * an event count: summing across days double-counts members who enable the skill
   * on more than one day, so it is also null in date-range rollup mode
   * (`starting_date`/`ending_date`).
   */
  enable_count: number | null;

  /**
   * Estimated overage spend attributed to this skill, as a decimal string in the
   * minor unit of `currency` (cents for USD; "1250" is $12.50, fractional cents
   * possible) — an allocation of each member's daily post-discount, pre-credit
   * metered overage spend (the same cost basis as the organization's spend reporting
   * and the Cost & Usage API, so per-skill figures are directly comparable; spend
   * with no skill attribution — including any member-day without skill invocations —
   * is not represented, so skill rows sum to at most those totals) across the skills
   * the member used. Overage only: usage covered by included seat allowances bills
   * nothing and allocates $0 here — see `attributed_list_price` for the
   * funding-independent usage-value companion. Claude Code, Cowork, and Office Agent
   * spend use request-level skill attribution; claude.ai chat spend is approximated
   * proportionally to skill-invoking messages. An estimate, not a billing number —
   * and the cost of the requests/messages that involved the skill, not the skill's
   * incremental cost (the same request would still have cost something without the
   * skill active). "0" means no overage spend was attributed; null when spend
   * reporting is not enabled for this organization, on `office_agent` product cuts
   * dated before 2026-06-18 (the Office Agent attribution data-start). Addable
   * across days: date-range rollup mode (`starting_date`/`ending_date`) returns the
   * window's sum. With `group_by[]=user_id` each row carries the user's own
   * attributed spend. On `group_by[]` and `filter[]` shapes both amounts can total
   * below the ungrouped value for the same skill over the same date or range: spend
   * attributed to a member–skill pair with no counted usage on that day is excluded
   * from those cuts.
   */
  estimated_overage_spend: string | null;

  /**
   * Total number of times this skill was invoked on the requested day (the skill
   * analog of plugin `invocation_count`). Unlike `distinct_user_count` — which
   * answers '# of users' — this is the true '# of uses'. A skill counts as used only
   * when it is explicitly activated — the model (or the user, via the skill's slash
   * command) invokes it, reading its instructions into context as part of that
   * activation. Skills that are merely installed or listed as available, or whose
   * content reaches the context without an activation (preloaded, hook-injected, or
   * read as a plain file), are not counted. Null when invocation reporting is not
   * enabled for this organization. Sum across a date range for total uses in the
   * window — date-range rollup mode (`starting_date`/`ending_date`) returns this sum
   * directly.
   */
  invocation_count: number | null;

  /**
   * Office Agent activity metrics for a single skill on a given day, broken out by
   * Office product.
   */
  office_metrics: AnalyticsSkillOfficeMetrics;

  /**
   * Skill share status (claude.ai only): one of `private`, `organization`, or
   * `public`. Null for skills used only in Claude Code or Office (no per-skill
   * share-status concept) and when share-status reporting is not yet available for
   * the organization. Filterable via `filter[]=share_status:{value}`.
   */
  share_status: 'organization' | 'private' | 'public' | null;

  /**
   * Human-readable display name for rows whose `skill_name` is an opaque skill id
   * (user/organization skill types and plugin-delivered skills, whose user-defined
   * names usage reports generally withhold). Organization-shared skills and skills
   * delivered by the organization's own plugins (its plugin marketplaces and its
   * library) resolve; plugin skill names are shown without their 'plugin:' prefix.
   * The literal 'unknown' bucket row gets a fixed 'Unknown skill' label. For a
   * member's own skill (private or personal-plugin) it is null, except when the
   * skill's owner used it from Claude Code or Cowork in the requested period: then
   * it shows the name that client reported at the time. Apart from that, the names
   * of members' own skills are not disclosed to analytics-key holders. Also null for
   * Anthropic-provided plugin skills (not resolved), for an organization skill or
   * plugin whose name can no longer be found (for example, one since deleted), when
   * `skill_name` is already a display name, or when display-name resolution is not
   * enabled for this organization.
   */
  skill_display_name: string | null;

  /**
   * Name of the skill
   */
  skill_name: string;

  /**
   * Skill use recorded while members had Chat and Cowork unified (Cowork's features
   * inside claude.ai chat) turned on, split into chat conversations and Cowork
   * sessions. A count is null in date-range mode where it cannot be computed.
   * Omitted from the response where Chat and Cowork unified is not available.
   */
  chat_cowork_unified_metrics?: AnalyticsSkillChatCoworkUnifiedMetrics | null;

  /**
   * Product that produced this row's activity: one of `chat`, `claude_code`,
   * `cowork`, `office_agent`, or `chat_cowork_unified` (Chat and Cowork unified).
   * These are the canonical Cost & Usage product names; an `office_agent` row's
   * per-surface breakdown is in its `office_metrics`. On `/plugins` only `cowork`,
   * `claude_code` and `chat_cowork_unified` occur (the only surfaces with plugin
   * attribution); on `/artifacts` only `chat`, `claude_code`, `cowork` and
   * `chat_cowork_unified` occur (the surfaces that create artifacts);
   * `/apps/chat/projects` does not support the product dimension (a `product` entry
   * in `group_by[]` or `filter[]` there is rejected). Present only when the request
   * grouped by `product`.
   */
  product?: string | null;

  /**
   * Tagged RBAC group identifier (`rbac_group_...`), matching the spend-limits API
   * spelling. Present only when the request grouped by `rbac_group_id`.
   */
  rbac_group_id?: string | null;

  /**
   * Resolved RBAC group display name, alongside `rbac_group_id` when name resolution
   * is available. Null if the group has been deleted or its name could not be
   * resolved; `rbac_group_id` remains the stable key.
   */
  rbac_group_name?: string | null;

  /**
   * Tagged user identifier (e.g. `user_...`). Present only when the request grouped
   * by `user_id`.
   */
  user_id?: string | null;
}

/**
 * A skill's use in chat conversations recorded while members had Chat and Cowork
 * unified turned on.
 */
export interface AnalyticsSkillChatCoworkUnifiedChatMetrics {
  /**
   * Same measure as `chat_metrics.distinct_conversation_skill_used_count`, for
   * activity recorded while members had Chat and Cowork unified turned on.
   * Approximate (HLL, typical error <2%) in date-range mode. Null on aggregated rows
   * where a distinct count cannot be computed.
   */
  distinct_conversation_skill_used_count: number | null;
}

/**
 * A skill's use in Chat and Cowork unified on one day: `chat` holds its use in
 * chat conversations and `sessions` its use in Cowork sessions.
 */
export interface AnalyticsSkillChatCoworkUnifiedMetrics {
  /**
   * A skill's use in chat conversations recorded while members had Chat and Cowork
   * unified turned on.
   */
  chat: AnalyticsSkillChatCoworkUnifiedChatMetrics;

  /**
   * A skill's use in Cowork sessions recorded while members had Chat and Cowork
   * unified turned on.
   */
  sessions: AnalyticsSkillChatCoworkUnifiedSessionsMetrics;
}

/**
 * A skill's use in Cowork sessions recorded while members had Chat and Cowork
 * unified turned on.
 */
export interface AnalyticsSkillChatCoworkUnifiedSessionsMetrics {
  /**
   * Same measure as `cowork_metrics.distinct_session_skill_used_count`, for activity
   * recorded while members had Chat and Cowork unified turned on. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  distinct_session_skill_used_count: number | null;
}

/**
 * Claude.ai activity metrics for a single skill on a given day.
 */
export interface AnalyticsSkillChatMetrics {
  /**
   * Number of distinct conversations in which the skill was used. A skill counts as
   * used only when it is explicitly activated — the model (or the user, via the
   * skill's slash command) invokes it, reading its instructions into context as part
   * of that activation. Skills that are merely installed or listed as available, or
   * whose content reaches the context without an activation (preloaded,
   * hook-injected, or read as a plain file), are not counted. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  distinct_conversation_skill_used_count: number | null;
}

/**
 * Claude Code activity metrics for a single skill on a given day.
 */
export interface AnalyticsSkillClaudeCodeMetrics {
  /**
   * Number of distinct Claude Code sessions in which the skill was used. A skill
   * counts as used only when it is explicitly activated — the model (or the user,
   * via the skill's slash command) invokes it, reading its instructions into context
   * as part of that activation. Skills that are merely installed or listed as
   * available, or whose content reaches the context without an activation
   * (preloaded, hook-injected, or read as a plain file), are not counted.
   * Approximate (HLL, typical error <2%) in date-range mode. Null on aggregated rows
   * where a distinct count cannot be computed.
   */
  distinct_session_skill_used_count: number | null;
}

/**
 * Cowork activity metrics for a single skill on a given day.
 */
export interface AnalyticsSkillCoworkMetrics {
  /**
   * Number of distinct Cowork sessions in which the skill was used. A skill counts
   * as used only when it is explicitly activated — the model (or the user, via the
   * skill's slash command) invokes it, reading its instructions into context as part
   * of that activation. Skills that are merely installed or listed as available, or
   * whose content reaches the context without an activation (preloaded,
   * hook-injected, or read as a plain file), are not counted. Approximate (HLL,
   * typical error <2%) in date-range mode. Null on aggregated rows where a distinct
   * count cannot be computed.
   */
  distinct_session_skill_used_count: number | null;
}

/**
 * A dimension to group skill activity by.
 */
export type AnalyticsSkillGroupBy = 'product' | 'rbac_group_id' | 'user_id';

/**
 * Office Agent activity metrics for a single skill on a given day, broken out by
 * Office product.
 */
export interface AnalyticsSkillOfficeMetrics {
  /**
   * Office Agent activity metrics for a single skill on a given day within one
   * Office product.
   */
  excel: AnalyticsSkillOfficeProductMetrics;

  /**
   * Office Agent activity metrics for a single skill on a given day within one
   * Office product.
   */
  outlook: AnalyticsSkillOfficeProductMetrics;

  /**
   * Office Agent activity metrics for a single skill on a given day within one
   * Office product.
   */
  powerpoint: AnalyticsSkillOfficeProductMetrics;

  /**
   * Office Agent activity metrics for a single skill on a given day within one
   * Office product.
   */
  word: AnalyticsSkillOfficeProductMetrics;
}

/**
 * Office Agent activity metrics for a single skill on a given day within one
 * Office product.
 */
export interface AnalyticsSkillOfficeProductMetrics {
  /**
   * Number of distinct Office Agent sessions in which the skill was used. A skill
   * counts as used only when it is explicitly activated — the model (or the user,
   * via the skill's slash command) invokes it, reading its instructions into context
   * as part of that activation. Skills that are merely installed or listed as
   * available, or whose content reaches the context without an activation
   * (preloaded, hook-injected, or read as a plain file), are not counted.
   * Approximate (HLL, typical error <2%) in date-range mode. Null on aggregated rows
   * where a distinct count cannot be computed.
   */
  distinct_session_skill_used_count: number | null;
}

/**
 * Accepted/rejected counts for a single Claude Code tool type.
 */
export interface AnalyticsToolActionCounts {
  /**
   * Number of tool proposals accepted
   */
  accepted_count: number;

  /**
   * Number of tool proposals rejected
   */
  rejected_count: number;
}

/**
 * Per-tool accepted/rejected counts for Claude Code file modification tools.
 */
export interface AnalyticsToolActions {
  /**
   * Accepted/rejected counts for a single Claude Code tool type.
   */
  edit_tool: AnalyticsToolActionCounts;

  /**
   * Accepted/rejected counts for a single Claude Code tool type.
   */
  multi_edit_tool: AnalyticsToolActionCounts;

  /**
   * Accepted/rejected counts for a single Claude Code tool type.
   */
  notebook_edit_tool: AnalyticsToolActionCounts;

  /**
   * Accepted/rejected counts for a single Claude Code tool type.
   */
  write_tool: AnalyticsToolActionCounts;
}

/**
 * A user in the organization, identified by tagged id and email address.
 */
export interface AnalyticsUser {
  /**
   * Tagged user identifier (e.g. `user_...`)
   */
  id: string;

  /**
   * Email address of the user
   */
  email_address: string;

  /**
   * Object type. Always `user`.
   */
  type: 'user';
}

/**
 * Per-user activity data for a given day.
 */
export interface AnalyticsUserActivity {
  /**
   * Claude.ai activity metrics for a single user on a given day.
   */
  chat_metrics: AnalyticsChatMetrics;

  /**
   * Claude Code activity metrics for a single user on a given day.
   */
  claude_code_metrics: AnalyticsClaudeCodeMetrics;

  /**
   * Cowork activity metrics for a single user on a given day.
   */
  cowork_metrics: AnalyticsCoworkMetrics;

  /**
   * Claude Design activity metrics for a single user on a given day.
   */
  design_metrics: AnalyticsDesignMetrics;

  /**
   * Number of distinct active users represented by this row. Only set for grouped
   * rollups (`group_by[]`); null for per-user rows. In date-range mode, recomputed
   * as an exact distinct count of the group's active members over the requested
   * window, never a sum of per-day values.
   */
  distinct_user_count: number | null;

  /**
   * Office Agent activity metrics for a single user on a given day, broken out by
   * Office product.
   */
  office_metrics: AnalyticsOfficeMetrics;

  /**
   * Claude Science activity metrics for a single user on a given day.
   */
  science_metrics: AnalyticsScienceMetrics;

  /**
   * The user this row describes. Null on rows aggregated across users.
   */
  user: AnalyticsUser | null;

  /**
   * Number of web searches performed
   */
  web_search_count: number;

  /**
   * Activity recorded while the member had Chat and Cowork unified (Cowork's
   * features inside claude.ai chat) turned on, split into `chat` (chat activity) and
   * `sessions` (Cowork activity). Omitted from the response where Chat and Cowork
   * unified is not available.
   */
  chat_cowork_unified_metrics?: AnalyticsChatCoworkUnifiedMetrics | null;

  /**
   * Most recent UTC day (YYYY-MM-DD) on which the user had any counted activity,
   * within the requested window: equal to the requested `date` in single-day mode,
   * and to the latest active day from `starting_date` (inclusive) to `ending_date`
   * (exclusive) in date-range rollup mode — never a day earlier than the window
   * start. On filtered requests (`filter[]`) only days matching the filter count:
   * with `filter[]=rbac_group_id:{id}` it is the last day the user was active while
   * a member of that group, consistent with the row's other metrics. On grouped
   * (`group_by[]`) rows it is the latest day any member of the group was active (the
   * requested `date` in single-day mode). Omitted from the response while
   * last-activity reporting is not enabled for this organization.
   */
  last_activity_date?: string | null;

  /**
   * Tagged RBAC group identifier (`rbac_group_...`), matching the spend-limits API
   * spelling. Present only when the request grouped by `rbac_group_id`.
   */
  rbac_group_id?: string | null;

  /**
   * Resolved RBAC group display name, alongside `rbac_group_id` when name resolution
   * is available. Null if the group has been deleted or its name could not be
   * resolved; `rbac_group_id` remains the stable key.
   */
  rbac_group_name?: string | null;
}

/**
 * A dimension to group user activity by.
 */
export type AnalyticsUserGroupBy = 'rbac_group_id';

Analytics.Summaries = Summaries;
Analytics.Users = Users;
Analytics.Apps = Apps;
Analytics.Connectors = Connectors;
Analytics.Plugins = Plugins;
Analytics.Skills = Skills;
Analytics.Artifacts = Artifacts;

export declare namespace Analytics {
  export {
    type AnalyticsArtifactActivity as AnalyticsArtifactActivity,
    type AnalyticsArtifactGroupBy as AnalyticsArtifactGroupBy,
    type AnalyticsChatCoworkUnifiedChatMetrics as AnalyticsChatCoworkUnifiedChatMetrics,
    type AnalyticsChatCoworkUnifiedMetrics as AnalyticsChatCoworkUnifiedMetrics,
    type AnalyticsChatCoworkUnifiedSessionsMetrics as AnalyticsChatCoworkUnifiedSessionsMetrics,
    type AnalyticsChatMetrics as AnalyticsChatMetrics,
    type AnalyticsClaudeCodeMetrics as AnalyticsClaudeCodeMetrics,
    type AnalyticsConnectorActivity as AnalyticsConnectorActivity,
    type AnalyticsConnectorChatCoworkUnifiedChatMetrics as AnalyticsConnectorChatCoworkUnifiedChatMetrics,
    type AnalyticsConnectorChatCoworkUnifiedMetrics as AnalyticsConnectorChatCoworkUnifiedMetrics,
    type AnalyticsConnectorChatCoworkUnifiedSessionsMetrics as AnalyticsConnectorChatCoworkUnifiedSessionsMetrics,
    type AnalyticsConnectorChatMetrics as AnalyticsConnectorChatMetrics,
    type AnalyticsConnectorClaudeCodeMetrics as AnalyticsConnectorClaudeCodeMetrics,
    type AnalyticsConnectorCoworkMetrics as AnalyticsConnectorCoworkMetrics,
    type AnalyticsConnectorGroupBy as AnalyticsConnectorGroupBy,
    type AnalyticsConnectorOfficeMetrics as AnalyticsConnectorOfficeMetrics,
    type AnalyticsConnectorOfficeProductMetrics as AnalyticsConnectorOfficeProductMetrics,
    type AnalyticsCoreCodeMetrics as AnalyticsCoreCodeMetrics,
    type AnalyticsCoworkMetrics as AnalyticsCoworkMetrics,
    type AnalyticsDesignMetrics as AnalyticsDesignMetrics,
    type AnalyticsLinesOfCode as AnalyticsLinesOfCode,
    type AnalyticsOfficeMetrics as AnalyticsOfficeMetrics,
    type AnalyticsOfficeProductMetrics as AnalyticsOfficeProductMetrics,
    type AnalyticsOrder as AnalyticsOrder,
    type AnalyticsPluginActivity as AnalyticsPluginActivity,
    type AnalyticsPluginChatCoworkUnifiedMetrics as AnalyticsPluginChatCoworkUnifiedMetrics,
    type AnalyticsPluginClaudeCodeMetrics as AnalyticsPluginClaudeCodeMetrics,
    type AnalyticsPluginCoworkMetrics as AnalyticsPluginCoworkMetrics,
    type AnalyticsPluginGroupBy as AnalyticsPluginGroupBy,
    type AnalyticsProjectActivity as AnalyticsProjectActivity,
    type AnalyticsProjectGroupBy as AnalyticsProjectGroupBy,
    type AnalyticsScienceMetrics as AnalyticsScienceMetrics,
    type AnalyticsSingleDayActivitySummary as AnalyticsSingleDayActivitySummary,
    type AnalyticsSkillActivity as AnalyticsSkillActivity,
    type AnalyticsSkillChatCoworkUnifiedChatMetrics as AnalyticsSkillChatCoworkUnifiedChatMetrics,
    type AnalyticsSkillChatCoworkUnifiedMetrics as AnalyticsSkillChatCoworkUnifiedMetrics,
    type AnalyticsSkillChatCoworkUnifiedSessionsMetrics as AnalyticsSkillChatCoworkUnifiedSessionsMetrics,
    type AnalyticsSkillChatMetrics as AnalyticsSkillChatMetrics,
    type AnalyticsSkillClaudeCodeMetrics as AnalyticsSkillClaudeCodeMetrics,
    type AnalyticsSkillCoworkMetrics as AnalyticsSkillCoworkMetrics,
    type AnalyticsSkillGroupBy as AnalyticsSkillGroupBy,
    type AnalyticsSkillOfficeMetrics as AnalyticsSkillOfficeMetrics,
    type AnalyticsSkillOfficeProductMetrics as AnalyticsSkillOfficeProductMetrics,
    type AnalyticsToolActionCounts as AnalyticsToolActionCounts,
    type AnalyticsToolActions as AnalyticsToolActions,
    type AnalyticsUser as AnalyticsUser,
    type AnalyticsUserActivity as AnalyticsUserActivity,
    type AnalyticsUserGroupBy as AnalyticsUserGroupBy,
  };

  export { Summaries as Summaries, type SummaryListParams as SummaryListParams };

  export { Users as Users, type UserListParams as UserListParams };

  export { Apps as Apps };

  export { Connectors as Connectors, type ConnectorListParams as ConnectorListParams };

  export { Plugins as Plugins, type PluginListParams as PluginListParams };

  export { Skills as Skills, type SkillListParams as SkillListParams };

  export { Artifacts as Artifacts, type ArtifactListParams as ArtifactListParams };
}
