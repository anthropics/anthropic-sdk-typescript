import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import { APIPromise } from '../../../core/api-promise';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

export class ActionURLs extends APIResource {
  /**
   * Create Action URL
   *
   * @example
   * ```ts
   * const betaUserProfileActionURL =
   *   await client.beta.userProfiles.actionURLs.create(
   *     'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   *     { action: { type: 'enroll_end_user' } },
   *   );
   * ```
   */
  create(
    userProfileID: string,
    params: ActionURLCreateParams,
    options?: RequestOptions,
  ): APIPromise<BetaUserProfileActionURL> {
    const { betas, workspace_id, ...body } = params;
    return this._client.post(path`/v1/user_profiles/${userProfileID}/action_urls`, {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'user-profiles-2026-08-18'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.user_profiles.action_urls.create', options, {
        route: '/v1/user_profiles/{user_profile_id}/action_urls',
        attributes: { 'anthropic.user_profile.id': userProfileID },
      }),
    });
  }
}

/**
 * A URL to give to the person who takes the requested action.
 */
export interface BetaUserProfileActionURL {
  /**
   * When the URL stops working, in RFC 3339 format.
   */
  expires_at: string;

  /**
   * Object type. Always `user_profile_action_url`.
   */
  type: 'user_profile_action_url';

  /**
   * The URL to give to the person who takes the action. Anyone who holds it can open
   * it until `expires_at`.
   */
  url: string;
}

/**
 * The end-user that the profile represents enrolls in a program.
 */
export interface BetaUserProfileEnrollEndUserAction {
  type: 'enroll_end_user';
}

export interface ActionURLCreateParams {
  /**
   * Body param: The action that the person who opens the URL takes.
   */
  action: BetaUserProfileEnrollEndUserAction;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
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

export declare namespace ActionURLs {
  export {
    type BetaUserProfileActionURL as BetaUserProfileActionURL,
    type BetaUserProfileEnrollEndUserAction as BetaUserProfileEnrollEndUserAction,
    type ActionURLCreateParams as ActionURLCreateParams,
  };
}
