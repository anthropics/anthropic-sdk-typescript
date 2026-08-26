// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as OrganizationAPI from './organization';
import { APIPromise } from '../../../core/api-promise';
import { Page, type PageParams, PagePromise } from '../../../core/pagination';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Invites extends APIResource {
  /**
   * Invite a user to join the organization by email.
   *
   * On plans that draw members from a finite pool of purchased seats, the invite
   * automatically consumes a seat from the lowest tier with availability; there is
   * no seat-tier parameter. When no seat is free the request fails with a 400 error
   * rather than purchasing a seat.
   *
   * @example
   * ```ts
   * const betaOrganizationInvite =
   *   await client.beta.organization.invites.create({
   *     email: 'user@emaildomain.com',
   *     role: 'user',
   *   });
   * ```
   */
  create(body: InviteCreateParams, options?: RequestOptions): APIPromise<BetaOrganizationInvite> {
    return this._client.post('/v1/organizations/invites?beta=true', { body, ...options });
  }

  /**
   * Retrieve an invite by ID.
   *
   * @example
   * ```ts
   * const betaOrganizationInvite =
   *   await client.beta.organization.invites.retrieve(
   *     'invite_id',
   *   );
   * ```
   */
  retrieve(inviteID: string, options?: RequestOptions): APIPromise<BetaOrganizationInvite> {
    return this._client.get(path`/v1/organizations/invites/${inviteID}?beta=true`, options);
  }

  /**
   * List the organization's invites.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaOrganizationInvite of client.beta.organization.invites.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query: InviteListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaOrganizationInvitesPage, BetaOrganizationInvite> {
    return this._client.getAPIList('/v1/organizations/invites?beta=true', Page<BetaOrganizationInvite>, {
      query,
      ...options,
    });
  }

  /**
   * Delete a pending invite.
   *
   * @example
   * ```ts
   * const invite =
   *   await client.beta.organization.invites.delete(
   *     'invite_id',
   *   );
   * ```
   */
  delete(inviteID: string, options?: RequestOptions): APIPromise<InviteDeleteResponse> {
    return this._client.delete(path`/v1/organizations/invites/${inviteID}?beta=true`, options);
  }
}

export type BetaOrganizationInvitesPage = Page<BetaOrganizationInvite>;

export interface BetaOrganizationInvite {
  /**
   * ID of the Invite.
   */
  id: string;

  /**
   * RFC 3339 datetime string indicating when the Invite was accepted, or null.
   */
  accepted_at: string | null;

  /**
   * Email of the User being invited.
   */
  email: string;

  /**
   * RFC 3339 datetime string indicating when the Invite expires.
   */
  expires_at: string;

  /**
   * RFC 3339 datetime string indicating when the Invite was created.
   */
  invited_at: string;

  /**
   * RBAC group IDs recorded on the Invite (Claude Enterprise organizations), to be
   * assigned to the User when the Invite is accepted. `[]` when none.
   */
  rbac_group_ids: Array<string>;

  /**
   * Organization role of the User.
   */
  role: OrganizationAPI.BetaOrganizationRole;

  /**
   * Status of the Invite.
   */
  status: 'accepted' | 'deleted' | 'expired' | 'pending';

  /**
   * Object type.
   *
   * For Invites, this is always `"invite"`.
   */
  type: 'invite';
}

export interface InviteDeleteResponse {
  /**
   * ID of the Invite.
   */
  id: string;

  /**
   * Deleted object type.
   *
   * For Invites, this is always `"invite_deleted"`.
   */
  type: 'invite_deleted';
}

export interface InviteCreateParams {
  /**
   * Email of the User.
   */
  email: string;

  /**
   * Role for the invited User.
   *
   * The accepted values depend on the organization type. Console and API
   * organizations accept `user`, `developer`, `billing`, and `claude_code_user`;
   * `admin` cannot be assigned through the API. Claude Enterprise organizations
   * accept `user` and `managed`.
   */
  role: 'billing' | 'claude_code_user' | 'developer' | 'managed' | 'user';

  /**
   * RBAC group IDs to assign to the User when the Invite is accepted. A non-empty
   * array is accepted only for a Claude Enterprise organization with RBAC groups,
   * and requires the key to carry the `write:rbac_groups` scope.
   */
  rbac_group_ids?: Array<string>;
}

export interface InviteListParams extends PageParams {
  /**
   * Filter by the email address the Invite was sent to. Matches the same way as the
   * Users list's `email` filter (normalized, case-insensitive).
   */
  email?: string;

  /**
   * Filter to items whose `role` equals one of the supplied values. Repeatable;
   * values are OR'ed together.
   *
   * Accepted values depend on the organization type: Console and API organizations
   * accept `user`, `developer`, `billing`, `admin`, and `claude_code_user`; Claude
   * Enterprise organizations accept `user`, `owner`, `primary_owner`,
   * `membership_admin`, and `managed`.
   */
  roles?: Array<string>;

  /**
   * Filter by Invite status. Repeatable; values are OR'ed together. Omit to return
   * `pending`, `accepted`, and `expired` Invites alike.
   */
  statuses?: Array<'accepted' | 'expired' | 'pending'>;
}

export declare namespace Invites {
  export {
    type BetaOrganizationInvite as BetaOrganizationInvite,
    type InviteDeleteResponse as InviteDeleteResponse,
    type BetaOrganizationInvitesPage as BetaOrganizationInvitesPage,
    type InviteCreateParams as InviteCreateParams,
    type InviteListParams as InviteListParams,
  };
}
