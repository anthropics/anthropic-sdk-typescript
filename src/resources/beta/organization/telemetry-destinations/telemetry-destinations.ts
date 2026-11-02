import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as WorkspacesAPI from './workspaces';
import {
  BetaDeletedTelemetryDestinationWorkspace,
  BetaTelemetryDestinationWorkspace,
  BetaTelemetryDestinationWorkspacesPageCursor,
  WorkspaceAddParams,
  WorkspaceListParams,
  WorkspaceRemoveParams,
  Workspaces,
} from './workspaces';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';
import { path } from '../../../../internal/utils/path';

export class TelemetryDestinations extends APIResource {
  workspaces: WorkspacesAPI.Workspaces = new WorkspacesAPI.Workspaces(this._client);

  /**
   * Register an OpenTelemetry destination for the organization.
   *
   * The destination starts in state `enabled`. An organization can have at most 10
   * destinations, including disabled ones.
   *
   * See the
   * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#add-a-destination)
   * to learn more about adding a destination.
   *
   * @example
   * ```ts
   * const betaTelemetryDestination =
   *   await client.beta.organization.telemetryDestinations.create(
   *     {
   *       endpoint_url: 'x',
   *       workspaces: { type: 'all' },
   *     },
   *   );
   * ```
   */
  create(
    params: TelemetryDestinationCreateParams,
    options?: RequestOptions,
  ): APIPromise<BetaTelemetryDestination> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/telemetry_destinations', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'telemetry-destinations-2026-08-11'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.telemetry_destinations.create',
        options,
        {
          route: '/v1/organizations/telemetry_destinations',
          createdIDAttribute: 'anthropic.organization.telemetry_destination.id',
        },
      ),
    });
  }

  /**
   * Read a destination's configuration, state, and most recent delivery results.
   *
   * See the
   * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#delivery-and-health)
   * to learn how the API delivers spans and when it disables a destination.
   *
   * @example
   * ```ts
   * const betaTelemetryDestination =
   *   await client.beta.organization.telemetryDestinations.retrieve(
   *     'destination_id',
   *   );
   * ```
   */
  retrieve(
    destinationID: string,
    params: TelemetryDestinationRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaTelemetryDestination> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/organizations/telemetry_destinations/${destinationID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'telemetry-destinations-2026-08-11'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.telemetry_destinations.retrieve',
        options,
        {
          route: '/v1/organizations/telemetry_destinations/{destination_id}',
          attributes: { 'anthropic.organization.telemetry_destination.id': destinationID },
        },
      ),
    });
  }

  /**
   * Change a telemetry destination's settings, its state, or which workspaces it
   * covers.
   *
   * Send at least one field. Omitted fields keep their stored values, except the
   * registered headers, which a change of the endpoint's hostname or port removes.
   * Only `display_name`, `traces`, `traces.endpoint_url`, `traces.content_mode`,
   * `traces.max_content_bytes`, and individual `headers` values accept `null`.
   *
   * If another request changes the destination while the update runs, the API
   * returns a 409 `conflict_error`. Read the destination again, then retry the
   * update.
   *
   * See the
   * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#delivery-and-health)
   * to learn more about changing a destination.
   *
   * @example
   * ```ts
   * const betaTelemetryDestination =
   *   await client.beta.organization.telemetryDestinations.update(
   *     'destination_id',
   *   );
   * ```
   */
  update(
    destinationID: string,
    params: TelemetryDestinationUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaTelemetryDestination> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/telemetry_destinations/${destinationID}`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'telemetry-destinations-2026-08-11'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.telemetry_destinations.update',
        options,
        {
          route: '/v1/organizations/telemetry_destinations/{destination_id}',
          attributes: { 'anthropic.organization.telemetry_destination.id': destinationID },
        },
      ),
    });
  }

  /**
   * List the organization's destinations, newest first, optionally only those that
   * cover given workspaces.
   *
   * See the
   * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#set-up-api-tracing)
   * to learn more about destinations.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaTelemetryDestination of client.beta.organization.telemetryDestinations.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: TelemetryDestinationListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaTelemetryDestinationsPageCursor, BetaTelemetryDestination> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      '/v1/organizations/telemetry_destinations',
      PageCursor<BetaTelemetryDestination>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'telemetry-destinations-2026-08-11'].toString() },
          options?.headers,
        ]),
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.telemetry_destinations.list',
          options,
          {
            route: '/v1/organizations/telemetry_destinations',
            queryParams: ['limit', 'page', 'workspace_ids'],
          },
        ),
      },
    );
  }

  /**
   * Delete a destination and its workspace list.
   *
   * The API stops sending spans to the destination. The spans of the workspaces it
   * covered still go to the other destinations that cover them. A deleted
   * destination can't be read, listed, or restored.
   *
   * See the
   * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#delivery-and-health)
   * to learn more about managing a destination.
   *
   * @example
   * ```ts
   * const betaDeletedTelemetryDestination =
   *   await client.beta.organization.telemetryDestinations.delete(
   *     'destination_id',
   *   );
   * ```
   */
  delete(
    destinationID: string,
    params: TelemetryDestinationDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaDeletedTelemetryDestination> {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/organizations/telemetry_destinations/${destinationID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'telemetry-destinations-2026-08-11'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(
        this._client,
        'anthropic.organization.telemetry_destinations.delete',
        options,
        {
          route: '/v1/organizations/telemetry_destinations/{destination_id}',
          attributes: { 'anthropic.organization.telemetry_destination.id': destinationID },
        },
      ),
    });
  }

  /**
   * Send one test span, named `anthropic.test`, to the destination with its
   * registered headers, once and without retries, and report the destination's
   * answer. The response is 200 whether or not the destination answered with a 2xx
   * status: its `result` has the type `success`, or the type `failure` and the
   * reason in `error`. The destination's configuration, `state` and
   * `delivery_health` do not change. A disabled destination can be tested too. Wait
   * 10 seconds between tests of one destination; a request that comes sooner may be
   * answered with status 429.
   *
   * @example
   * ```ts
   * const betaTelemetryDestinationTestResponse =
   *   await client.beta.organization.telemetryDestinations.test(
   *     'destination_id',
   *   );
   * ```
   */
  test(
    destinationID: string,
    params: TelemetryDestinationTestParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaTelemetryDestinationTestResponse> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/organizations/telemetry_destinations/${destinationID}/test`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'telemetry-destinations-2026-08-11'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.telemetry_destinations.test', options, {
        route: '/v1/organizations/telemetry_destinations/{destination_id}/test',
        attributes: { 'anthropic.organization.telemetry_destination.id': destinationID },
      }),
    });
  }
}

export type BetaTelemetryDestinationsPageCursor = PageCursor<BetaTelemetryDestination>;

/**
 * Confirmation that a destination was deleted.
 */
export interface BetaDeletedTelemetryDestination {
  /**
   * ID of the deleted destination (`tdst_...`).
   */
  id: string;

  type: 'telemetry_destination_deleted';
}

/**
 * An OpenTelemetry destination: an OTLP/HTTP endpoint, the request headers sent
 * with every delivery to it, what the exported spans contain, and which workspaces
 * it covers. A destination belongs to an organization. A workspace's spans go to
 * every enabled destination that covers it.
 */
export interface BetaTelemetryDestination {
  /**
   * The unique ID of the destination (`tdst_...`).
   */
  id: string;

  /**
   * Time the destination was created.
   */
  created_at: string;

  /**
   * The most recent delivery results for this destination.
   */
  delivery_health: BetaTelemetryDestinationDeliveryHealth;

  /**
   * Human-readable name for the destination. Null when none was set.
   */
  display_name: string | null;

  /**
   * The base URL of the destination's OTLP/HTTP endpoint, exactly as registered.
   *
   * The API appends the per-signal path, such as `/v1/traces`, on delivery, unless
   * `traces.endpoint_url` is set.
   */
  endpoint_url: string;

  /**
   * Names of the registered request headers. Header values are write-only and are
   * never returned.
   */
  header_names: Array<string>;

  /**
   * Whether the destination receives deliveries.
   */
  state: BetaTelemetryDestinationState;

  /**
   * The destination's settings for the traces it receives.
   */
  traces: BetaTelemetryDestinationTraces;

  type: 'telemetry_destination';

  /**
   * Time of the last change to the destination's configuration or state. Changes to
   * `delivery_health` don't change it.
   *
   * An update that sets a header value always changes it, even when the value is the
   * same as before. Adding or removing a single workspace on the destination's list
   * doesn't change it. An update that changes the list does.
   */
  updated_at: string;

  /**
   * Which of the organization's workspaces the destination covers.
   */
  workspaces: BetaTelemetryDestinationWorkspaces;
}

/**
 * What the spans that the API exports to a telemetry destination contain.
 *
 * See the
 * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#choose-a-content-mode)
 * to learn what the spans contain in each content mode.
 *
 * - `metadata_only` - The spans contain identifiers, timing, status, token counts,
 *   and similar metadata. They don't contain prompt text, completion text, or tool
 *   inputs and outputs.
 * - `content` - The spans contain the same metadata as `metadata_only`, plus
 *   message and tool content.
 *
 *   An organization with a data-handling restriction, such as under HIPAA, can't
 *   choose this mode. The API exports only metadata for such an organization, even
 *   to a destination that already has `content`.
 */
export type BetaTelemetryDestinationContentMode = 'metadata_only' | 'content';

/**
 * The most recent delivery results that the API records for a telemetry
 * destination.
 *
 * Changes to the destination's configuration or state don't reset these fields.
 * Changes to these fields don't change `updated_at`. The values can lag behind the
 * latest deliveries.
 *
 * See the
 * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#delivery-and-health)
 * to learn how the API delivers spans and when it disables a destination.
 */
export interface BetaTelemetryDestinationDeliveryHealth {
  /**
   * A message that describes the most recent failed delivery to the destination, or
   * `null` if no delivery has failed yet.
   *
   * Examples are `temporary DNS failure`, `TLS failure`, `timeout`,
   * `connection failure`, `invalid address`, `HTTP error (status 503)`, and
   * `redirect (status 301)`. The message is `invalid address` both for a hostname
   * that doesn't exist and for an address that isn't publicly routable. It never
   * contains the endpoint's response body, a header value, a network address, or TLS
   * details.
   *
   * `last_error` and `last_error_at` always change together. A later successful
   * delivery doesn't clear them. If `last_success_at` is later than `last_error_at`,
   * a delivery has succeeded since this failure.
   *
   * See the
   * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#delivery-errors)
   * to learn the likely cause of each error.
   */
  last_error: string | null;

  /**
   * Time of the failure that `last_error` describes. Changes together with
   * `last_error`. Null until a delivery first fails.
   */
  last_error_at: string | null;

  /**
   * Time of the most recent successful delivery to the destination, or `null` if no
   * delivery has succeeded yet.
   */
  last_success_at: string | null;
}

/**
 * Why the destination is disabled: `caller` when a caller disabled it, or the
 * reason the API disabled it automatically (`sustained_failure`,
 * `invalid_address`, or `redirect`). Every automatic disable is reversible with an
 * update that sets `state` to `enabled`. An update that sets `disabled` on a
 * destination that is already disabled keeps its reason.
 */
export type BetaTelemetryDestinationDisabledReason =
  | BetaTelemetryDestinationDisabledReasonCaller
  | BetaTelemetryDestinationDisabledReasonSustainedFailure
  | BetaTelemetryDestinationDisabledReasonInvalidAddress
  | BetaTelemetryDestinationDisabledReasonRedirect;

/**
 * A caller disabled the destination with an update that set `state` to `disabled`.
 */
export interface BetaTelemetryDestinationDisabledReasonCaller {
  type: 'caller';
}

/**
 * The API disabled the destination because deliveries to it failed for longer than
 * the same threshold as for `sustained_failure`, and the most recent failed
 * delivery failed with an invalid address: the DNS answer says that the endpoint's
 * hostname doesn't exist or doesn't have an address, or the address that the API
 * would connect to isn't publicly routable or is reserved, for example a loopback,
 * link-local, private-network, or cloud-metadata address. The API doesn't connect
 * to such an address, and retries the delivery a bounded number of times as it
 * does after a timeout. A timeout or a server failure of the DNS lookup is a
 * temporary DNS failure instead, not an invalid address.
 */
export interface BetaTelemetryDestinationDisabledReasonInvalidAddress {
  type: 'invalid_address';
}

/**
 * The API disabled the destination because the endpoint answered a delivery with a
 * 3xx status. Redirects are never followed, and one such answer disables the
 * destination at once.
 */
export interface BetaTelemetryDestinationDisabledReasonRedirect {
  type: 'redirect';
}

/**
 * The API disabled the destination because deliveries to it failed, with no
 * successful delivery in between, for longer than a threshold that Anthropic
 * configures and that is not part of this contract. The reason is
 * `invalid_address` instead when the most recent failed delivery failed with an
 * invalid address.
 */
export interface BetaTelemetryDestinationDisabledReasonSustainedFailure {
  type: 'sustained_failure';
}

/**
 * Whether a telemetry destination receives deliveries.
 *
 * A caller can set either state. The API also disables an enabled destination on
 * its own in some cases. The `reason` of the disabled state says whether a caller
 * or the API disabled the destination and, when the API did, why.
 *
 * See the
 * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#delivery-and-health)
 * to learn when the API disables a destination.
 */
export type BetaTelemetryDestinationState =
  | BetaTelemetryDestinationStateEnabled
  | BetaTelemetryDestinationStateDisabled;

/**
 * The API doesn't deliver anything to the telemetry destination.
 *
 * Spans produced while it is disabled aren't delivered later.
 */
export interface BetaTelemetryDestinationStateDisabled {
  /**
   * Whether a caller or the API disabled the destination and, when the API did, why.
   * Read-only.
   */
  reason: BetaTelemetryDestinationDisabledReason;

  type: 'disabled';
}

/**
 * Stop deliveries to the telemetry destination.
 *
 * Spans produced while it is disabled aren't delivered later. A destination that
 * is already disabled keeps its `reason`.
 */
export interface BetaTelemetryDestinationStateDisabledParams {
  type: 'disabled';
}

/**
 * The telemetry destination receives the spans of the workspaces that it covers.
 */
export interface BetaTelemetryDestinationStateEnabled {
  type: 'enabled';
}

/**
 * Start deliveries to the telemetry destination again.
 *
 * This doesn't reset `delivery_health`.
 */
export interface BetaTelemetryDestinationStateEnabledParams {
  type: 'enabled';
}

/**
 * The state to set on a telemetry destination, by `type` alone.
 *
 * A caller can't set the `reason` of a disabled state. Only the API sets it.
 */
export type BetaTelemetryDestinationStateParams =
  | BetaTelemetryDestinationStateEnabledParams
  | BetaTelemetryDestinationStateDisabledParams;

/**
 * The test span was not delivered.
 */
export interface BetaTelemetryDestinationTestFailure {
  /**
   * A message that describes why the test span was not delivered, including the HTTP
   * status code when the destination returned one. Examples:
   * `HTTP error (status 403)`, `timeout`, `TLS failure`. It has the same form as the
   * destination's `delivery_health.last_error` and never contains the destination's
   * response body, any header value, a network address, or TLS details.
   */
  error: string;

  type: 'failure';
}

/**
 * The result of one test span sent to a destination.
 */
export interface BetaTelemetryDestinationTestResponse {
  /**
   * How the test went: `success` when the destination answered with a 2xx status,
   * else `failure` with the reason.
   */
  result: BetaTelemetryDestinationTestResult;

  type: 'telemetry_destination_test';
}

/**
 * The outcome of a test: `success`, or `failure` with the reason.
 */
export type BetaTelemetryDestinationTestResult =
  | BetaTelemetryDestinationTestSuccess
  | BetaTelemetryDestinationTestFailure;

/**
 * The destination answered the test span with a 2xx status.
 */
export interface BetaTelemetryDestinationTestSuccess {
  type: 'success';
}

/**
 * A telemetry destination's settings for the traces it receives.
 */
export interface BetaTelemetryDestinationTraces {
  /**
   * What the exported spans contain.
   */
  content_mode: BetaTelemetryDestinationContentMode;

  /**
   * Whether the destination receives traces. A destination whose `enabled` is false
   * keeps its other settings.
   */
  enabled: boolean;

  /**
   * The full URL that the API posts traces to, exactly as registered, or `null` if
   * the destination doesn't have one.
   *
   * When it is `null`, the API posts traces to `endpoint_url` with `/v1/traces`
   * appended.
   */
  endpoint_url: string | null;

  /**
   * The most bytes of content that one exported span can contain, or `null` if only
   * the API's maximum applies.
   *
   * Content means model prompts and responses, and tool inputs and outputs. The API
   * shortens longer content to this size before it delivers the span. A destination
   * whose `content_mode` is `metadata_only` keeps this value. It applies once
   * `content_mode` is `content`.
   */
  max_content_bytes: number | null;
}

/**
 * The settings for the traces that a telemetry destination receives, as a create
 * or update request sets them. An omitted field takes its default on create and
 * keeps its stored value on update.
 */
export interface BetaTelemetryDestinationTracesParams {
  /**
   * What the exported spans contain. Defaults to `metadata_only` on create.
   *
   * On update, `null` sets `metadata_only`.
   */
  content_mode?: BetaTelemetryDestinationContentMode | null;

  /**
   * Whether the destination receives traces. Defaults to true on create. It cannot
   * be null.
   */
  enabled?: boolean;

  /**
   * The full URL of your collector's traces endpoint, for a collector that takes
   * traces on a path other than `/v1/traces`. The API posts traces to it exactly as
   * given and appends nothing.
   *
   * The same rules as for `endpoint_url` apply, except that any path is allowed. It
   * must have the same scheme, host, and port as `endpoint_url`. At most 2,048
   * characters.
   *
   * On create, `null` is the same as leaving it out. On update, `null` removes it.
   * The API then posts traces to `endpoint_url` with `/v1/traces` appended. A change
   * of this URL alone keeps the registered headers.
   */
  endpoint_url?: string | null;

  /**
   * The most bytes of content that one exported span can contain, from 1 up to the
   * API's maximum. `null` sets no bound, so only the API's maximum applies.
   *
   * On create, leaving it out is the same as `null`. The error for a value above the
   * maximum states the maximum.
   */
  max_content_bytes?: number | null;
}

/**
 * Which of the organization's workspaces a telemetry destination covers.
 *
 * Several destinations can cover the same workspace. Each of them receives the
 * workspace's spans while it is enabled.
 *
 * The workspace list of an `include` or `exclude` destination isn't part of the
 * destination object. List the destination's workspaces to read it. Add or remove
 * one workspace at a time, or replace the whole list with an update. A list holds
 * at most 1,000 workspaces.
 */
export type BetaTelemetryDestinationWorkspaces =
  | BetaTelemetryDestinationWorkspacesAll
  | BetaTelemetryDestinationWorkspacesInclude
  | BetaTelemetryDestinationWorkspacesExclude;

/**
 * The destination covers every workspace of the organization, including the
 * default workspace, archived workspaces, and workspaces created later. It doesn't
 * have a list.
 */
export interface BetaTelemetryDestinationWorkspacesAll {
  type: 'all';
}

/**
 * Cover every workspace of the organization. Doesn't take `workspace_ids`.
 *
 * An update that sets `all` empties the destination's workspace list.
 */
export interface BetaTelemetryDestinationWorkspacesAllParams {
  type: 'all';
}

/**
 * The destination covers every workspace of the organization except the workspaces
 * on its list. A workspace created later is covered until it is added to the list.
 */
export interface BetaTelemetryDestinationWorkspacesExclude {
  type: 'exclude';
}

/**
 * Cover every workspace of the organization except the workspaces on the list.
 */
export interface BetaTelemetryDestinationWorkspacesExcludeParams {
  type: 'exclude';

  /**
   * The IDs of the workspaces on the destination's list (`wrkspc_...`). At most 100
   * per request.
   *
   * On create, these workspaces become the destination's list. If you leave
   * `workspace_ids` out, the list starts empty. If the API refuses one of the IDs,
   * it doesn't create the destination.
   *
   * On update, `workspace_ids` replaces the whole list. A workspace that stays on
   * the list keeps its entry and its `created_at`. An empty array empties the list.
   * If you leave `workspace_ids` out and the type stays the same, the list doesn't
   * change. If you leave it out and the type changes, the new list starts empty.
   * After a change to `include` without `workspace_ids`, the destination doesn't
   * cover any workspace until one is added. After a change to `exclude` without
   * `workspace_ids`, it covers every workspace.
   *
   * An ID sent more than once is added once. An archived workspace can't be added to
   * a list. An update can keep an archived workspace that is already on the list.
   */
  workspace_ids?: Array<string>;
}

/**
 * The destination covers the workspaces on its list, and no others.
 */
export interface BetaTelemetryDestinationWorkspacesInclude {
  type: 'include';
}

/**
 * Cover only the workspaces on the list.
 */
export interface BetaTelemetryDestinationWorkspacesIncludeParams {
  type: 'include';

  /**
   * The IDs of the workspaces on the destination's list (`wrkspc_...`). At most 100
   * per request.
   *
   * On create, these workspaces become the destination's list. If you leave
   * `workspace_ids` out, the list starts empty. If the API refuses one of the IDs,
   * it doesn't create the destination.
   *
   * On update, `workspace_ids` replaces the whole list. A workspace that stays on
   * the list keeps its entry and its `created_at`. An empty array empties the list.
   * If you leave `workspace_ids` out and the type stays the same, the list doesn't
   * change. If you leave it out and the type changes, the new list starts empty.
   * After a change to `include` without `workspace_ids`, the destination doesn't
   * cover any workspace until one is added. After a change to `exclude` without
   * `workspace_ids`, it covers every workspace.
   *
   * An ID sent more than once is added once. An archived workspace can't be added to
   * a list. An update can keep an archived workspace that is already on the list.
   */
  workspace_ids?: Array<string>;
}

/**
 * Which of the organization's workspaces a telemetry destination covers, as a
 * create or update request sets it.
 */
export type BetaTelemetryDestinationWorkspacesParams =
  | BetaTelemetryDestinationWorkspacesAllParams
  | BetaTelemetryDestinationWorkspacesIncludeParams
  | BetaTelemetryDestinationWorkspacesExcludeParams;

export interface TelemetryDestinationCreateParams {
  /**
   * Body param: The base URL of your collector's OTLP/HTTP endpoint, for example
   * `https://gateway.example.com`.
   *
   * The URL must use `https` and a hostname, not an IP address. The port, if given,
   * must be 443. The URL must not contain a query string, a fragment, or a username
   * and password. At most 2,048 characters.
   *
   * A path prefix, such as `/otlp`, is allowed. Don't include the per-signal path
   * (`/v1/traces`), because the API appends it on delivery. If your collector takes
   * traces on another path, also set `traces.endpoint_url`.
   */
  endpoint_url: string;

  /**
   * Body param: Which of the organization's workspaces the destination covers.
   */
  workspaces: BetaTelemetryDestinationWorkspacesParams;

  /**
   * Body param: Human-readable name for the destination. Optional. 1 to 255
   * characters.
   */
  display_name?: string | null;

  /**
   * Body param: Request headers that the API sends with every delivery, typically
   * your collector's authentication header (for example `authorization`).
   *
   * The API stores the values encrypted and never returns them. Reads show only
   * `header_names`.
   *
   * At most 20 headers. Names are at most 128 characters. Two names can't differ
   * only in case. Values are printable ASCII, at most 4,096 characters, and can't
   * begin or end with a space. Names and values together are at most 16,384 bytes.
   *
   * Reserved names are rejected, for example `host`, `cookie`, `user-agent`, and
   * names that start with `content-`, `proxy-`, `x-forwarded-`, or `anthropic-`. For
   * this check, `_` in a name counts as `-`.
   */
  headers?: { [key: string]: string };

  /**
   * Body param: The settings for the traces that the destination receives. If you
   * leave it out, every setting takes its default.
   */
  traces?: BetaTelemetryDestinationTracesParams;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `telemetry-destinations-2026-08-11` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface TelemetryDestinationRetrieveParams {
  /**
   * This endpoint is in beta: requests must send `telemetry-destinations-2026-08-11`
   * in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface TelemetryDestinationUpdateParams {
  /**
   * Body param: New human-readable name, 1 to 255 characters. Null clears it.
   */
  display_name?: string | null;

  /**
   * Body param: The new base URL of the destination's OTLP/HTTP endpoint. The same
   * rules as on create apply.
   *
   * A change of hostname or port first removes every registered header, so send the
   * headers for the new endpoint in the same request. When the destination has a
   * `traces.endpoint_url`, such a change must also set `traces.endpoint_url` to a
   * URL with the new hostname and port, or to `null`. A change of the path alone
   * keeps the headers.
   */
  endpoint_url?: string;

  /**
   * Body param: Headers to set or remove. The API merges them into the destination's
   * headers by name.
   *
   * Names compare case-insensitively. A string value sets or replaces that header. A
   * `null` value removes it. Headers that you omit don't change. The field itself
   * can't be `null`.
   *
   * A request that sets a header value must also include `endpoint_url`. The current
   * URL is accepted.
   *
   * The resulting set must stay within the same limits as on create. When the
   * request sets a value, each stored value that it doesn't set counts as 4,096
   * bytes toward the 16,384-byte limit, because you can't read its real length. So
   * to change one header of a destination that has four or more other headers, send
   * the values of the others again in the same request.
   */
  headers?: { [key: string]: string | null } | null;

  /**
   * Body param: Whether the destination receives deliveries after the update. The
   * field can't be `null`.
   */
  state?: BetaTelemetryDestinationStateParams;

  /**
   * Body param: The traces settings to change. Omitted settings keep their stored
   * values.
   *
   * `null` sets every traces setting to its create default.
   */
  traces?: BetaTelemetryDestinationTracesParams | null;

  /**
   * Body param: The new workspace scope, in the same form as on create. The field
   * can't be `null`.
   *
   * The API refuses an update that changes the type or sends `workspace_ids` while
   * the destination's list has more than 750 workspaces. Remove workspaces one at a
   * time until 750 or fewer remain, then send the update again.
   */
  workspaces?: BetaTelemetryDestinationWorkspacesParams;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `telemetry-destinations-2026-08-11` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface TelemetryDestinationListParams extends PageCursorParams {
  /**
   * Query param: Return only the destinations that cover at least one of these
   * workspaces (`wrkspc_...`).
   *
   * Send at most 100 IDs, as `workspace_ids[]`. A destination covers a workspace
   * when its `workspaces.type` is `all`, when its `include` list has the workspace,
   * or when its `exclude` list doesn't have it. Destinations in either state can
   * match. An ID that isn't the ID of one of the organization's workspaces doesn't
   * match any destination, not even one whose type is `all`.
   */
  workspace_ids?: Array<string>;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `telemetry-destinations-2026-08-11` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface TelemetryDestinationDeleteParams {
  /**
   * This endpoint is in beta: requests must send `telemetry-destinations-2026-08-11`
   * in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface TelemetryDestinationTestParams {
  /**
   * This endpoint is in beta: requests must send `telemetry-destinations-2026-08-11`
   * in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

TelemetryDestinations.Workspaces = Workspaces;

export declare namespace TelemetryDestinations {
  export {
    type BetaDeletedTelemetryDestination as BetaDeletedTelemetryDestination,
    type BetaTelemetryDestination as BetaTelemetryDestination,
    type BetaTelemetryDestinationContentMode as BetaTelemetryDestinationContentMode,
    type BetaTelemetryDestinationDeliveryHealth as BetaTelemetryDestinationDeliveryHealth,
    type BetaTelemetryDestinationDisabledReason as BetaTelemetryDestinationDisabledReason,
    type BetaTelemetryDestinationDisabledReasonCaller as BetaTelemetryDestinationDisabledReasonCaller,
    type BetaTelemetryDestinationDisabledReasonInvalidAddress as BetaTelemetryDestinationDisabledReasonInvalidAddress,
    type BetaTelemetryDestinationDisabledReasonRedirect as BetaTelemetryDestinationDisabledReasonRedirect,
    type BetaTelemetryDestinationDisabledReasonSustainedFailure as BetaTelemetryDestinationDisabledReasonSustainedFailure,
    type BetaTelemetryDestinationState as BetaTelemetryDestinationState,
    type BetaTelemetryDestinationStateDisabled as BetaTelemetryDestinationStateDisabled,
    type BetaTelemetryDestinationStateDisabledParams as BetaTelemetryDestinationStateDisabledParams,
    type BetaTelemetryDestinationStateEnabled as BetaTelemetryDestinationStateEnabled,
    type BetaTelemetryDestinationStateEnabledParams as BetaTelemetryDestinationStateEnabledParams,
    type BetaTelemetryDestinationStateParams as BetaTelemetryDestinationStateParams,
    type BetaTelemetryDestinationTestFailure as BetaTelemetryDestinationTestFailure,
    type BetaTelemetryDestinationTestResponse as BetaTelemetryDestinationTestResponse,
    type BetaTelemetryDestinationTestResult as BetaTelemetryDestinationTestResult,
    type BetaTelemetryDestinationTestSuccess as BetaTelemetryDestinationTestSuccess,
    type BetaTelemetryDestinationTraces as BetaTelemetryDestinationTraces,
    type BetaTelemetryDestinationTracesParams as BetaTelemetryDestinationTracesParams,
    type BetaTelemetryDestinationWorkspaces as BetaTelemetryDestinationWorkspaces,
    type BetaTelemetryDestinationWorkspacesAll as BetaTelemetryDestinationWorkspacesAll,
    type BetaTelemetryDestinationWorkspacesAllParams as BetaTelemetryDestinationWorkspacesAllParams,
    type BetaTelemetryDestinationWorkspacesExclude as BetaTelemetryDestinationWorkspacesExclude,
    type BetaTelemetryDestinationWorkspacesExcludeParams as BetaTelemetryDestinationWorkspacesExcludeParams,
    type BetaTelemetryDestinationWorkspacesInclude as BetaTelemetryDestinationWorkspacesInclude,
    type BetaTelemetryDestinationWorkspacesIncludeParams as BetaTelemetryDestinationWorkspacesIncludeParams,
    type BetaTelemetryDestinationWorkspacesParams as BetaTelemetryDestinationWorkspacesParams,
    type BetaTelemetryDestinationsPageCursor as BetaTelemetryDestinationsPageCursor,
    type TelemetryDestinationCreateParams as TelemetryDestinationCreateParams,
    type TelemetryDestinationRetrieveParams as TelemetryDestinationRetrieveParams,
    type TelemetryDestinationUpdateParams as TelemetryDestinationUpdateParams,
    type TelemetryDestinationListParams as TelemetryDestinationListParams,
    type TelemetryDestinationDeleteParams as TelemetryDestinationDeleteParams,
    type TelemetryDestinationTestParams as TelemetryDestinationTestParams,
  };

  export {
    Workspaces as Workspaces,
    type BetaDeletedTelemetryDestinationWorkspace as BetaDeletedTelemetryDestinationWorkspace,
    type BetaTelemetryDestinationWorkspace as BetaTelemetryDestinationWorkspace,
    type BetaTelemetryDestinationWorkspacesPageCursor as BetaTelemetryDestinationWorkspacesPageCursor,
    type WorkspaceListParams as WorkspaceListParams,
    type WorkspaceAddParams as WorkspaceAddParams,
    type WorkspaceRemoveParams as WorkspaceRemoveParams,
  };
}
