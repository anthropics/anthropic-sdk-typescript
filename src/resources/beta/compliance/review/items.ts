import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as MessagesAPI from '../../messages/messages';
import { APIPromise } from '../../../../core/api-promise';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';
import { path } from '../../../../internal/utils/path';

export class Items extends APIResource {
  /**
   * Read one message that Anthropic flagged for your organization to review, with
   * its request and response.
   *
   * A message that the API key can't read, or that isn't flagged, returns the same
   * 404 as one that doesn't exist. For a message recorded with a user profile, send
   * that profile's ID in the `anthropic-user-profile-id` header. A flagged message
   * can also return 404 if it belongs to another organization than the key's own, or
   * to your end customer's user profile or Workspace.
   *
   * If your encryption key or storage bucket refuses the read, the API returns a 400
   * with `cmek_key_disabled`, `storage_bucket_unreadable` or
   * `customer_storage_refusal_unattributed` in `error.details.error_code`.
   *
   * The API key must have the `read:compliance_review_items`,
   * `read:compliance_user_data` or `read:org_audit` scope. A key of an organization
   * with no parent organization must have `read:compliance_review_items`.
   *
   * @example
   * ```ts
   * const betaComplianceReviewItem =
   *   await client.beta.compliance.review.items.retrieve(
   *     'item_id',
   *   );
   * ```
   */
  retrieve(
    itemID: string,
    params: ItemRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaComplianceReviewItem> {
    const { betas, user_profile_id } = params ?? {};
    return this._client.get(path`/v1/compliance/review/items/${itemID}`, {
      ...options,
      headers: buildHeaders([
        {
          ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined),
          ...(user_profile_id != null ? { 'anthropic-user-profile-id': user_profile_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.compliance.review.items.retrieve', options, {
        route: '/v1/compliance/review/items/{item_id}',
        attributes: { 'anthropic.compliance.review.item.id': itemID },
      }),
    });
  }
}

/**
 * Who sent a message.
 */
export type BetaComplianceReviewActor =
  | BetaComplianceReviewUserActor
  | BetaComplianceReviewAPIActor
  | BetaComplianceReviewServiceAccountActor;

/**
 * An API key.
 */
export interface BetaComplianceReviewAPIActor {
  /**
   * The ID of the API key (`apikey_...`).
   */
  api_key_id: string;

  type: 'api_actor';
}

/**
 * No copy of the message was stored.
 */
export interface BetaComplianceReviewContentNotCaptured {
  type: 'not_captured';
}

/**
 * Why a message's content isn't returned.
 */
export type BetaComplianceReviewContentUnavailableReason =
  | BetaComplianceReviewContentNotCaptured
  | BetaComplianceReviewStoredCopyUnavailable;

/**
 * A request to create a message, and its response.
 */
export interface BetaComplianceReviewCreateMessageContent {
  /**
   * The `POST /v1/messages` request body, without thinking blocks or unpublished
   * fields. For a user's message from an Anthropic app, such as Claude Code,
   * `system` is a placeholder.
   */
  request: { [key: string]: unknown };

  /**
   * The model's `Message`, without thinking blocks or unpublished fields. Null when
   * no response was stored, for example because the client disconnected.
   */
  response: MessagesAPI.BetaMessage | null;

  type: 'create_message';
}

/**
 * One stored item that the organization it belongs to can read for review.
 */
export interface BetaComplianceReviewItem {
  /**
   * The ID of the item. For a message, its own ID, such as `msg_...`.
   */
  id: string;

  /**
   * For a message, who sent it. Null when no sender was recorded. New types can
   * appear, so accept a type that you don't know.
   */
  actor: BetaComplianceReviewActor | null;

  /**
   * Read the item, and save any copy you need, by this time. The item can stop being
   * readable sooner.
   */
  content_expires_at: string;

  /**
   * For a message, when Anthropic received the call.
   */
  created_at: string;

  /**
   * What is particular to this kind of item. New types can appear, so accept a type
   * that you don't know.
   */
  details: BetaComplianceReviewMessageDetails;

  /**
   * The UUID of the organization that the item belongs to. For a message, the
   * organization that sent it.
   */
  organization_id: string;

  /**
   * Why the item is readable. New types can appear, so accept a type that you don't
   * know.
   */
  read_reason: BetaComplianceReviewSafeguardsReason;

  /**
   * The object type, always `compliance_review_item`.
   */
  type: 'compliance_review_item';

  /**
   * The ID of the user profile that the item was attributed to (`uprof_...`). Null
   * when none was recorded.
   */
  user_profile_id: string | null;

  /**
   * The ID of the workspace (`wrkspc_...`). Null when the item isn't attributed to a
   * workspace.
   */
  workspace_id: string | null;
}

/**
 * A message sent to Claude.
 */
export interface BetaComplianceReviewMessageDetails {
  /**
   * The stored request and response. Null when `content_unavailable_reason` is set.
   * New types can appear, so accept a type that you don't know.
   */
  content: BetaComplianceReviewCreateMessageContent | null;

  /**
   * Why `content` is null. Null when `content` is set. New types can appear, so
   * accept a type that you don't know.
   */
  content_unavailable_reason: BetaComplianceReviewContentUnavailableReason | null;

  /**
   * The model that the call named. Null when none was recorded.
   */
  model: string | null;

  type: 'message';
}

/**
 * Anthropic flagged the item for your organization to review.
 */
export interface BetaComplianceReviewSafeguardsReason {
  type: 'safeguards_review';
}

/**
 * A service account.
 */
export interface BetaComplianceReviewServiceAccountActor {
  /**
   * The ID of the service account (`svac_...`).
   */
  service_account_id: string;

  type: 'service_account_actor';
}

/**
 * A copy of the message was stored and can't be returned.
 */
export interface BetaComplianceReviewStoredCopyUnavailable {
  type: 'stored_copy_unavailable';
}

/**
 * A signed-in user.
 */
export interface BetaComplianceReviewUserActor {
  /**
   * The user's email address. Set only for a current member of an organization that
   * the API key can read.
   */
  email_address: string | null;

  type: 'user_actor';

  /**
   * The ID of the user (`user_...`).
   */
  user_id: string;
}

export interface ItemRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * The ID of the user profile that the message was recorded with (`uprof_...`).
   * Send it for a message recorded with a user profile, and leave it out for a
   * message recorded with none.
   */
  user_profile_id?: string;
}

export declare namespace Items {
  export {
    type BetaComplianceReviewActor as BetaComplianceReviewActor,
    type BetaComplianceReviewAPIActor as BetaComplianceReviewAPIActor,
    type BetaComplianceReviewContentNotCaptured as BetaComplianceReviewContentNotCaptured,
    type BetaComplianceReviewContentUnavailableReason as BetaComplianceReviewContentUnavailableReason,
    type BetaComplianceReviewCreateMessageContent as BetaComplianceReviewCreateMessageContent,
    type BetaComplianceReviewItem as BetaComplianceReviewItem,
    type BetaComplianceReviewMessageDetails as BetaComplianceReviewMessageDetails,
    type BetaComplianceReviewSafeguardsReason as BetaComplianceReviewSafeguardsReason,
    type BetaComplianceReviewServiceAccountActor as BetaComplianceReviewServiceAccountActor,
    type BetaComplianceReviewStoredCopyUnavailable as BetaComplianceReviewStoredCopyUnavailable,
    type BetaComplianceReviewUserActor as BetaComplianceReviewUserActor,
    type ItemRetrieveParams as ItemRetrieveParams,
  };
}
