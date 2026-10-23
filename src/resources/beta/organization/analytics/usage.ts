import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as MessagesAPI from '../../messages/messages';
import * as AnalyticsAPI from './analytics';
import { PagePromise, ReportPageCursor, type ReportPageCursorParams } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';

export class Usage extends APIResource {
  /**
   * Get token usage across a date range, broken out by dimension.
   *
   * Returns one row per combination of the requested `group_by[]` dimensions (and
   * time bucket, when `time_bucket_width` is set) that has usage in the range,
   * ranked by the `order_by` metric or ordered by time bucket; every combination is
   * returned across pages. With no `group_by[]` and no `time_bucket_width`, a single
   * row aggregates the whole range. Includes all usage, whether or not it is
   * attributable to a seat user. Requires an API key with the `read:analytics`
   * scope, or an Admin API key.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaAnalyticsUsageItem of client.beta.organization.analytics.usage.list(
   *   { starting_at: '2026-09-01T00:00:00Z' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: UsageListParams,
    options?: RequestOptions,
  ): PagePromise<BetaAnalyticsUsageItemsReportPageCursor, BetaAnalyticsUsageItem> {
    const { betas, ...query } = params;
    return this._client.getAPIList(
      '/v1/organizations/analytics/usage',
      ReportPageCursor<BetaAnalyticsUsageItem>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'analytics-usage-cost-2026-08-24'].toString() },
          options?.headers,
        ]),
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(this._client, 'anthropic.organization.analytics.usage.list', options, {
          route: '/v1/organizations/analytics/usage',
          queryParams: [
            'actor_ids',
            'actor_types',
            'agent_ids',
            'api_key_ids',
            'claude_tag_categories',
            'claude_tag_user_ids',
            'context_windows',
            'deployment_ids',
            'ending_at',
            'environment_ids',
            'exclude_deleted_users',
            'group_by',
            'inference_geos',
            'limit',
            'models',
            'order',
            'order_by',
            'page',
            'products',
            'rbac_group_ids',
            'service_tiers',
            'session_ids',
            'slack_channel_ids',
            'speeds',
            'starting_at',
            'time_bucket_width',
            'user_profile_ids',
            'workspace_ids',
          ],
        }),
      },
    );
  }
}

export type BetaAnalyticsUsageItemsReportPageCursor = ReportPageCursor<BetaAnalyticsUsageItem>;

/**
 * The dimension values one usage row is broken out by; each is null unless its
 * dimension is in `group_by[]`.
 */
export interface BetaAnalyticsUsageGroup {
  /**
   * The identity the usage is attributed to: the user if one is attributed, else the
   * service account, else the federated (cloud-platform) identity, else the API key.
   * Populated only when `actor` is in `group_by[]`; null for usage with no
   * attributable identity, and for users' and federated identities' usage when the
   * reader is a member who can see only some workspaces. Distinct identities the
   * server cannot render also read null, each as its own row.
   */
  actor: AnalyticsAPI.BetaAnalyticsActor | null;

  /**
   * Kind of identity the usage is attributed to; matches `actor.type` when `actor`
   * is set. Populated only when `actor_type` is in `group_by[]`.
   */
  actor_type: AnalyticsAPI.BetaAnalyticsActorType | null;

  /**
   * Claude Managed Agents agent whose session incurred the usage. Populated only
   * when `agent_id` is in `group_by[]`; null for usage outside a managed session.
   */
  agent_id: string | null;

  /**
   * API key that authenticated the requests, as a tagged API key ID, whichever
   * identity `actor` resolves to. Populated only when `api_key_id` is in
   * `group_by[]`; null for usage not authenticated by an API key.
   */
  api_key_id: string | null;

  /**
   * Claude Tag (Claude in Slack) spend category: `engaged` (a person addressed
   * Claude in a channel or thread), `proactive` (Claude responded without being
   * addressed), `scheduled` (a scheduled routine ran), `monitoring` (Claude watching
   * a channel it was asked to monitor), or `dm` (direct messages with Claude).
   * Populated only when `claude_tag_category` is in `group_by[]`; null for usage
   * that is not Claude Tag. Direct-message usage is billed to the individual user
   * and is reported under that user's product, not under `claude_tag`. New
   * categories may be added over time.
   */
  claude_tag_category: AnalyticsAPI.BetaAnalyticsClaudeTagCategory | null;

  /**
   * Slack user ID (for example `U0123ABCDEF`) of the member the Claude Tag (Claude
   * in Slack) usage is attributed to, not a claude.ai user ID. Populated only when
   * `claude_tag_user_id` is in `group_by[]`; null for usage that is not Claude Tag
   * and for Claude Tag usage that is not attributed to a single user (for example
   * `monitoring`, and `proactive` usage Claude initiated), so per-user rows can sum
   * to less than the Claude Tag total. Cannot be combined with
   * `group_by[]=rbac_group_id` or the `rbac_group_ids[]` filter.
   */
  claude_tag_user_id: string | null;

  /**
   * Context-window pricing tier of the usage or cost. Null unless `context_window`
   * is in `group_by[]`; it can also be null on grouped rows with no context-window
   * tier, such as code execution.
   */
  context_window: AnalyticsAPI.BetaAnalyticsContextWindow | null;

  /**
   * Deployment that started the Claude Managed Agents session. Populated only when
   * `deployment_id` is in `group_by[]`; null for usage outside a managed session and
   * for sessions no deployment started.
   */
  deployment_id: string | null;

  /**
   * Claude Managed Agents environment the session ran in. Populated only when
   * `environment_id` is in `group_by[]`; null for usage outside a managed session.
   */
  environment_id: string | null;

  /**
   * Inference region of the usage or cost. Null unless `inference_geo` is in
   * `group_by[]`; it can also be null on grouped rows where the region is not set
   * (the rows that `inference_geos[]=not_available` matches).
   */
  inference_geo: AnalyticsAPI.BetaAnalyticsUsageCostInferenceGeo | null;

  /**
   * Model that produced the usage or cost, as a model name in the form the
   * `models[]` filter accepts (for example, `claude-opus-5-5`). Null unless `model`
   * is in `group_by[]`; it can also be null on grouped rows whose usage or cost is
   * not attributed to a specific model, such as code execution.
   */
  model: string | null;

  /**
   * Product surface that produced the usage or cost. Null unless product is in
   * `group_by[]`; it can also be null on grouped rows whose usage cannot be
   * attributed to a known surface. Values include `chat`, `claude_code`, `cowork`,
   * `office_agent`, `claude_in_chrome`, `claude_design`, `claude_tag`, and
   * `chat_cowork_unified`. `claude_tag` is Claude Tag, the Claude product in Slack.
   * `chat_cowork_unified` is Chat and Cowork unified, Cowork's features inside
   * claude.ai chat: chat and Cowork usage by a member who has it turned on is
   * reported under this value instead of `chat` or `cowork`. It is accepted as a
   * filter only on deployments that offer Chat and Cowork unified. Some unattributed
   * usage is reported as "other".
   */
  product: string | null;

  /**
   * RBAC group (team) the usage is attributed to, in the public tagged
   * `rbac_group_...` spelling — the same spelling the activity resources use for
   * this key, so the same team has one id across resources and it round-trips as an
   * `rbac_group_ids[]` filter value. Populated only when `rbac_group_id` is in
   * `group_by[]`. Any-membership semantics: a user in several groups contributes
   * their full usage to each of those groups' rows, so the named-group rows overlap
   * and their sum can exceed the org total. A null value is the single unassigned
   * row: users in no group on that (UTC) day. For the true org total, run the same
   * query without `group_by[]`.
   */
  rbac_group_id: string | null;

  /**
   * Service tier the usage was served at. Populated only when `service_tier` is in
   * `group_by[]`; null for usage with no service tier (for example, code execution)
   * and for Claude Enterprise usage.
   */
  service_tier: AnalyticsAPI.BetaAnalyticsServiceTier | null;

  /**
   * Claude Managed Agents session that incurred the usage. Populated only when
   * `session_id` is in `group_by[]`; null for usage outside a managed session.
   */
  session_id: string | null;

  /**
   * Slack channel the usage originated from. Populated only when `slack_channel_id`
   * is in `group_by[]`; null for usage outside Slack (and for rows recorded before
   * channel attribution was enabled).
   */
  slack_channel_id: string | null;

  /**
   * Inference speed mode of the usage or cost: `fast` or `standard`. Null unless
   * `speed` is in `group_by[]`.
   */
  speed: AnalyticsAPI.BetaAnalyticsSpeed | null;

  /**
   * User profile the usage was attributed to, as a tagged `uprof_` ID. Populated
   * only when `user_profile_id` is in `group_by[]`; null for usage that named no
   * profile and for Claude Enterprise usage.
   */
  user_profile_id: string | null;

  /**
   * Workspace the usage occurred in, as a tagged workspace ID, including the
   * organization's default workspace. Populated only when `workspace_id` is in
   * `group_by[]`; null for Claude Enterprise usage.
   */
  workspace_id: string | null;
}

export type BetaAnalyticsUsageGroupBy =
  | 'actor'
  | 'actor_type'
  | 'agent_id'
  | 'api_key_id'
  | 'claude_tag_category'
  | 'claude_tag_user_id'
  | 'context_window'
  | 'deployment_id'
  | 'environment_id'
  | 'inference_geo'
  | 'model'
  | 'product'
  | 'rbac_group_id'
  | 'service_tier'
  | 'session_id'
  | 'slack_channel_id'
  | 'speed'
  | 'user_profile_id'
  | 'workspace_id';

export interface BetaAnalyticsUsageItem {
  /**
   * End of the period this row covers (exclusive), as an RFC 3339 UTC timestamp: the
   * end of the row's time bucket when a time-bucket width is set; otherwise the
   * requested `ending_at` (or, when omitted, the earlier of now and `starting_at`
   * plus 31 days) rounded down to the hour, because without a time bucket the report
   * covers whole hours.
   */
  ending_at: string;

  /**
   * The dimension values this row's usage is broken out by.
   */
  group: BetaAnalyticsUsageGroup;

  /**
   * Start of the period this row covers (inclusive), as an RFC 3339 UTC timestamp:
   * the start of the row's time bucket when a time-bucket width is set, otherwise
   * the requested `starting_at` rounded down to the hour.
   */
  starting_at: string;

  /**
   * Token usage for this row.
   */
  usage: BetaAnalyticsUsageMetrics;
}

/**
 * The token usage of one row.
 */
export interface BetaAnalyticsUsageMetrics {
  /**
   * The number of input tokens for cache creation.
   */
  cache_creation: MessagesAPI.BetaCacheCreation;

  /**
   * The number of input tokens read from the cache.
   */
  cache_read_input_tokens: number;

  /**
   * The number of output tokens generated.
   */
  output_tokens: number;

  /**
   * Number of API requests in this row's scope. For sandbox / code-execution events,
   * this counts execution spans rather than HTTP requests (these rows surface with
   * `product: null`).
   */
  requests: number | null;

  /**
   * Server-side tool usage metrics.
   */
  server_tool_use: AnalyticsAPI.BetaAnalyticsServerToolUse;

  /**
   * Total token count across all token types. This is the value the default
   * `order_by` (`total_tokens`) sorts on.
   */
  total_tokens: number;

  /**
   * The number of uncached input tokens processed.
   */
  uncached_input_tokens: number;
}

export type BetaAnalyticsUsageOrderBy =
  | 'output_tokens'
  | 'requests'
  | 'time'
  | 'total_tokens'
  | 'uncached_input_tokens';

export interface UsageListParams extends ReportPageCursorParams {
  /**
   * Query param: Start of range, inclusive. RFC 3339 tz-aware. Must be within the
   * last 365 days and no earlier than 2026-01-01T00:00:00Z.
   */
  starting_at: string;

  /**
   * Query param: Filter to usage attributed to specific identities, by tagged ID: a
   * `user_...`, `svac_...` (service account), or `apikey_...` ID. An `apikey_` entry
   * matches only usage attributed to the key itself, not usage on that key
   * attributed to a user or service account (use `api_key_ids[]` for every request a
   * key authenticated). Federated identities have no tagged ID; select them with
   * `actor_types[]`. Use `group_by[]=actor` to break out per-identity values.
   */
  actor_ids?: Array<string> | null;

  /**
   * Query param: Filter to usage attributed to specific kinds of identity. Use
   * `group_by[]=actor_type` to break out per-kind values.
   */
  actor_types?: Array<AnalyticsAPI.BetaAnalyticsActorType> | null;

  /**
   * Query param: Filter to usage incurred by sessions of specific Claude Managed
   * Agents agents. Use `group_by[]=agent_id` to break out per-agent values. Claude
   * Developer Platform organizations only.
   */
  agent_ids?: Array<string> | null;

  /**
   * Query param: Filter to usage authenticated by specific API keys, by tagged API
   * key ID (`apikey_...`), whichever identity the usage is attributed to. Include an
   * empty entry (`api_key_ids[]=`) to also match usage that no API key
   * authenticated. Use `group_by[]=api_key_id` to break out per-key values; usage
   * without a key has a null `api_key_id`. Claude Developer Platform organizations
   * only.
   */
  api_key_ids?: Array<string> | null;

  /**
   * Query param: Filter to Claude Tag (Claude in Slack) usage in specific spend
   * categories. Usage with no category never matches. `dm` usage is reported under
   * the user's product rather than `claude_tag`, so combining this filter with
   * `products[]=claude_tag` excludes it. Use `group_by[]=claude_tag_category` to
   * break out per-category values.
   */
  claude_tag_categories?: Array<AnalyticsAPI.BetaAnalyticsClaudeTagCategory> | null;

  /**
   * Query param: Filter to Claude Tag (Claude in Slack) usage attributed to specific
   * Slack users, by Slack user ID (for example `U0123ABCDEF`), not claude.ai user
   * ID. Usage that is not Claude Tag, and Claude Tag usage not attributed to a
   * single user, never matches. Use `group_by[]=claude_tag_user_id` to break out
   * per-user values.
   */
  claude_tag_user_ids?: Array<string> | null;

  /**
   * Query param: Filter to specific context-window pricing tiers. Use
   * `group_by[]=context_window` to break out per-tier values.
   */
  context_windows?: Array<AnalyticsAPI.BetaAnalyticsContextWindow> | null;

  /**
   * Query param: Filter to usage incurred by Claude Managed Agents sessions that
   * specific deployments started. Use `group_by[]=deployment_id` to break out
   * per-deployment values. Claude Developer Platform organizations only.
   */
  deployment_ids?: Array<string> | null;

  /**
   * Query param: End of range, exclusive. Required when `time_bucket_width` is set.
   * Without `time_bucket_width`, defaults to the earlier of now and `starting_at` +
   * 31 days. The range may span at most 31 days.
   */
  ending_at?: string | null;

  /**
   * Query param: Filter to usage incurred by Claude Managed Agents sessions that ran
   * in specific environments. Use `group_by[]=environment_id` to break out
   * per-environment values. Claude Developer Platform organizations only.
   */
  environment_ids?: Array<string> | null;

  /**
   * Query param: If true, omit rows whose `actor` is a `user_actor` with
   * `deleted: true`. Requires `group_by[]=actor`. Rows for other actor types, and
   * rows whose `actor` is null, are always kept. A page may contain fewer than
   * `limit` rows; use `has_more` and `next_page` to paginate as usual.
   */
  exclude_deleted_users?: boolean;

  /**
   * Query param: Dimensions to break usage out by (at most 5): one row per
   * combination of their values with usage in the range (and per time bucket, when
   * `time_bucket_width` is set), every combination returned across pages rather than
   * a capped top set. When omitted, a single row aggregates the whole range.
   */
  group_by?: Array<BetaAnalyticsUsageGroupBy> | null;

  /**
   * Query param: Filter to specific inference regions. `not_available` matches rows
   * where the region is unset. Use `group_by[]=inference_geo` to break out
   * per-region values.
   */
  inference_geos?: Array<AnalyticsAPI.BetaAnalyticsInferenceGeoFilter> | null;

  /**
   * Query param: Number of rows per page (1-1000, default 20).
   * `cost_type`/`token_type` fan-out rows (cost endpoint only) do not count toward
   * this limit, so `data` can exceed it.
   */
  limit?: number;

  /**
   * Query param: Models to include. Defaults to all models. Use `group_by[]=model`
   * to break out per-model values.
   */
  models?: Array<string> | null;

  /**
   * Query param: Sort direction of the `order_by` metric, or of the time buckets
   * when `order_by` is `time` and `time_bucket_width` is set. Defaults to `desc`.
   */
  order?: AnalyticsAPI.BetaAnalyticsUsageCostSortOrder;

  /**
   * Query param: Row order. A metric ranks rows by that metric in the `order`
   * direction. `time` orders rows by time bucket in the `order` direction (newest
   * first by default) and, within a bucket, by `total_tokens`, highest first. `time`
   * takes effect only with `time_bucket_width`; without it, `time` is the same as
   * `total_tokens`. Defaults to `total_tokens`.
   */
  order_by?: BetaAnalyticsUsageOrderBy;

  /**
   * Query param: Product surfaces to include. Defaults to all products.
   */
  products?: Array<AnalyticsAPI.BetaAnalyticsUsageCostProductFilter> | null;

  /**
   * Query param: Filter to usage attributed to specific RBAC groups. Accepts tagged
   * RBAC group IDs (`rbac_group_...`) or bare group UUIDs. A row matches when the
   * user belonged to any of the listed groups on the (UTC) day the usage occurred;
   * usage with no group attribution never matches.
   */
  rbac_group_ids?: Array<string> | null;

  /**
   * Query param: Filter to specific service tiers. Use `group_by[]=service_tier` to
   * break out per-tier values. Claude Developer Platform organizations only; matches
   * nothing for a Claude Enterprise organization.
   */
  service_tiers?: Array<AnalyticsAPI.BetaAnalyticsServiceTier> | null;

  /**
   * Query param: Filter to usage incurred by specific Claude Managed Agents
   * sessions, by tagged session ID (`sesn_...`). Use `group_by[]=session_id` to
   * break out per-session values. Claude Developer Platform organizations only.
   */
  session_ids?: Array<string> | null;

  /**
   * Query param: Filter to usage originating from specific Slack channels. Use
   * `group_by[]=slack_channel_id` to break out per-channel values.
   */
  slack_channel_ids?: Array<string> | null;

  /**
   * Query param: Filter to fast or standard inference mode. Use `group_by[]=speed`
   * to break out per-mode values.
   */
  speeds?: Array<AnalyticsAPI.BetaAnalyticsSpeed> | null;

  /**
   * Query param: Time-bucket granularity. When set, rows are returned per time
   * bucket (one per bucket and dimension combination with usage) and each row's
   * `starting_at` and `ending_at` are that bucket's bounds; the time bucket counts
   * toward `limit`. `ending_at` is required when `time_bucket_width` is set, and
   * with `time_bucket_width="1m"` the range may span at most 24 hours. When omitted,
   * each row aggregates the requested range with `starting_at` and `ending_at` each
   * rounded down to the hour.
   */
  time_bucket_width?: AnalyticsAPI.BetaAnalyticsTimeBucketWidth | null;

  /**
   * Query param: Filter to usage attributed to specific user profiles, by tagged
   * user profile ID (`uprof_...`). Use `group_by[]=user_profile_id` to break out
   * per-profile values. Claude Developer Platform organizations only.
   */
  user_profile_ids?: Array<string> | null;

  /**
   * Query param: Filter to usage in specific workspaces, by tagged workspace ID
   * (`wrkspc_...`). Use `group_by[]=workspace_id` to break out per-workspace values.
   * Claude Developer Platform organizations only; matches nothing for a Claude
   * Enterprise organization.
   */
  workspace_ids?: Array<string> | null;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `analytics-usage-cost-2026-08-24` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Usage {
  export {
    type BetaAnalyticsUsageGroup as BetaAnalyticsUsageGroup,
    type BetaAnalyticsUsageGroupBy as BetaAnalyticsUsageGroupBy,
    type BetaAnalyticsUsageItem as BetaAnalyticsUsageItem,
    type BetaAnalyticsUsageMetrics as BetaAnalyticsUsageMetrics,
    type BetaAnalyticsUsageOrderBy as BetaAnalyticsUsageOrderBy,
    type BetaAnalyticsUsageItemsReportPageCursor as BetaAnalyticsUsageItemsReportPageCursor,
    type UsageListParams as UsageListParams,
  };
}
