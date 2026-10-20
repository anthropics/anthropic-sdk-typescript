import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';
import { path } from '../../../../internal/utils/path';

export class Workspaces extends APIResource {
  /**
   * List the workspaces on a destination's workspace list, newest entry first.
   *
   * A destination whose `workspaces.type` is `all` doesn't have a list, so its page
   * is empty. The list includes archived workspaces.
   *
   * See the
   * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#choose-workspaces-for-a-destination)
   * to learn more about choosing the workspaces of a destination.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaTelemetryDestinationWorkspace of client.beta.organization.telemetryDestinations.workspaces.list(
   *   'destination_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    destinationID: string,
    params: WorkspaceListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaTelemetryDestinationWorkspacesPageCursor, BetaTelemetryDestinationWorkspace> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/organizations/telemetry_destinations/${destinationID}/workspaces?beta=true`,
      PageCursor<BetaTelemetryDestinationWorkspace>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'telemetry-destinations-2026-08-11'].toString() },
          options?.headers,
        ]),
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.telemetry_destinations.workspaces.list',
          options,
          {
            route: '/v1/organizations/telemetry_destinations/{destination_id}/workspaces',
            queryParams: ['limit', 'page'],
            attributes: { 'anthropic.organization.telemetry_destination.id': destinationID },
          },
        ),
      },
    );
  }

  /**
   * Add one workspace to a destination's workspace list.
   *
   * Under `include` the workspace's spans start going to the destination. Under
   * `exclude` they stop. A list holds at most 1,000 workspaces.
   *
   * Adding a workspace that is already on the list changes nothing and returns the
   * existing entry. An archived workspace that isn't on the list yet can't be added.
   * A destination whose `workspaces.type` is `all` doesn't have a list, so the API
   * returns 400. To change which workspaces such a destination covers, update its
   * `workspaces`.
   *
   * See the
   * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#choose-workspaces-for-a-destination)
   * to learn more about choosing the workspaces of a destination.
   *
   * @example
   * ```ts
   * const betaTelemetryDestinationWorkspace =
   *   await client.beta.organization.telemetryDestinations.workspaces.add(
   *     'workspace_id',
   *     { destination_id: 'destination_id' },
   *   );
   * ```
   */
  add(
    workspaceID: string,
    params: WorkspaceAddParams,
    options?: RequestOptions,
  ): APIPromise<BetaTelemetryDestinationWorkspace> {
    const { destination_id, betas } = params;
    return this._client.post(
      path`/v1/organizations/telemetry_destinations/${destination_id}/workspaces/${workspaceID}?beta=true`,
      {
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'telemetry-destinations-2026-08-11'].toString() },
          options?.headers,
        ]),
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.telemetry_destinations.workspaces.add',
          options,
          {
            route: '/v1/organizations/telemetry_destinations/{destination_id}/workspaces/{workspace_id}',
            attributes: {
              'anthropic.organization.telemetry_destination.id': destination_id,
              'anthropic.organization.telemetry_destination.workspace.id': workspaceID,
            },
          },
        ),
      },
    );
  }

  /**
   * Remove one workspace from a destination's workspace list.
   *
   * Under `include` the workspace's spans stop going to the destination. Under
   * `exclude` they start. An archived workspace can be removed too.
   *
   * The API returns 404 when the workspace isn't on the list. A destination whose
   * `workspaces.type` is `all` doesn't have a list, so the API returns 400.
   *
   * See the
   * [OpenTelemetry export guide](https://platform.claude.com/docs/en/manage-claude/opentelemetry#choose-workspaces-for-a-destination)
   * to learn more about choosing the workspaces of a destination.
   *
   * @example
   * ```ts
   * const betaDeletedTelemetryDestinationWorkspace =
   *   await client.beta.organization.telemetryDestinations.workspaces.remove(
   *     'workspace_id',
   *     { destination_id: 'destination_id' },
   *   );
   * ```
   */
  remove(
    workspaceID: string,
    params: WorkspaceRemoveParams,
    options?: RequestOptions,
  ): APIPromise<BetaDeletedTelemetryDestinationWorkspace> {
    const { destination_id, betas } = params;
    return this._client.delete(
      path`/v1/organizations/telemetry_destinations/${destination_id}/workspaces/${workspaceID}?beta=true`,
      {
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'telemetry-destinations-2026-08-11'].toString() },
          options?.headers,
        ]),
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.telemetry_destinations.workspaces.remove',
          options,
          {
            route: '/v1/organizations/telemetry_destinations/{destination_id}/workspaces/{workspace_id}',
            attributes: {
              'anthropic.organization.telemetry_destination.id': destination_id,
              'anthropic.organization.telemetry_destination.workspace.id': workspaceID,
            },
          },
        ),
      },
    );
  }
}

export type BetaTelemetryDestinationWorkspacesPageCursor = PageCursor<BetaTelemetryDestinationWorkspace>;

/**
 * Confirmation that a workspace was removed from a destination's list.
 */
export interface BetaDeletedTelemetryDestinationWorkspace {
  /**
   * ID of the telemetry destination (`tdst_...`).
   */
  telemetry_destination_id: string;

  type: 'telemetry_destination_workspace_deleted';

  /**
   * ID of the workspace that was removed (`wrkspc_...`).
   */
  workspace_id: string;
}

/**
 * A workspace on a telemetry destination's workspace list.
 *
 * Under `include`, the destination covers the workspace. Under `exclude`, the
 * destination covers every workspace except this one. The entry doesn't have an
 * `id`. Its `telemetry_destination_id` and `workspace_id` together identify it.
 */
export interface BetaTelemetryDestinationWorkspace {
  /**
   * Time the workspace was added to the list.
   */
  created_at: string;

  /**
   * ID of the telemetry destination (`tdst_...`).
   */
  telemetry_destination_id: string;

  type: 'telemetry_destination_workspace';

  /**
   * ID of the workspace (`wrkspc_...`).
   */
  workspace_id: string;
}

export interface WorkspaceListParams extends PageCursorParams {
  /**
   * Header param: This endpoint is in beta: requests must send
   * `telemetry-destinations-2026-08-11` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkspaceAddParams {
  /**
   * Path param: ID of the destination (`tdst_...`).
   */
  destination_id: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `telemetry-destinations-2026-08-11` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WorkspaceRemoveParams {
  /**
   * Path param: ID of the destination (`tdst_...`).
   */
  destination_id: string;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `telemetry-destinations-2026-08-11` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Workspaces {
  export {
    type BetaDeletedTelemetryDestinationWorkspace as BetaDeletedTelemetryDestinationWorkspace,
    type BetaTelemetryDestinationWorkspace as BetaTelemetryDestinationWorkspace,
    type BetaTelemetryDestinationWorkspacesPageCursor as BetaTelemetryDestinationWorkspacesPageCursor,
    type WorkspaceListParams as WorkspaceListParams,
    type WorkspaceAddParams as WorkspaceAddParams,
    type WorkspaceRemoveParams as WorkspaceRemoveParams,
  };
}
