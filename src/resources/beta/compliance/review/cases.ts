import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as ReviewAPI from './review';
import { APIPromise } from '../../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';
import { path } from '../../../../internal/utils/path';

export class Cases extends APIResource {
  /**
   * Read one review case.
   *
   * A case that the API key can't reach, or that Anthropic hasn't sent, returns the
   * same 404 as a case that doesn't exist.
   *
   * An Admin API key with the `read:compliance_review_cases` scope can call this
   * endpoint.
   *
   * @example
   * ```ts
   * const betaComplianceReviewCase =
   *   await client.beta.compliance.review.cases.retrieve(
   *     'case_id',
   *   );
   * ```
   */
  retrieve(
    caseID: string,
    params: CaseRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaComplianceReviewCase> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/compliance/review/cases/${caseID}`, {
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.compliance.review.cases.retrieve', options, {
        route: '/v1/compliance/review/cases/{case_id}',
        attributes: { 'anthropic.compliance.review.case.id': caseID },
      }),
    });
  }

  /**
   * List the review cases of every organization that the API key can reach, newest
   * first by default. Both open and closed cases are returned unless `status` is
   * set.
   *
   * To sync, store the largest `updated_at` you have read, and send it as the
   * at-or-after filter on `updated_at`, sorted by `updated_at` ascending. That finds
   * new cases, newly closed cases, and cases with a new notice. Read every page,
   * match results by `id`, and store the new largest value after the last page.
   *
   * A request with the `anthropic-user-profile-id` header and no `user_profile_id`
   * parameter returns a 400 error.
   *
   * An Admin API key with the `read:compliance_review_cases` scope can call this
   * endpoint.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaComplianceReviewCase of client.beta.compliance.review.cases.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: CaseListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaComplianceReviewCasesPageCursor, BetaComplianceReviewCase> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/compliance/review/cases', PageCursor<BetaComplianceReviewCase>, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.compliance.review.cases.list', options, {
        route: '/v1/compliance/review/cases',
        queryParams: [
          'created_at[gt]',
          'created_at[gte]',
          'created_at[lt]',
          'created_at[lte]',
          'limit',
          'order',
          'order_by',
          'page',
          'status',
          'updated_at[gt]',
          'updated_at[gte]',
          'updated_at[lt]',
          'updated_at[lte]',
          'user_profile_id',
        ],
      }),
    });
  }

  /**
   * Send your conclusion on a review case. A response closes the case, and a closed
   * case can't be reopened.
   *
   * Only the first response counts. A request is safe to send again: if the closed
   * case has a response with the same field values, in any list order, the API
   * returns 200 and changes nothing. If the closed case has a different response, or
   * none, the API returns a 400 with `case_closed` in `error.details.error_code`.
   *
   * If your end customer reviews this case instead of you, the API returns a 403
   * with `case_reviewed_by_end_customer` in `error.details.error_code`.
   *
   * An Admin API key with the `write:compliance_review_cases` scope can call this
   * endpoint.
   *
   * @example
   * ```ts
   * const betaComplianceReviewCase =
   *   await client.beta.compliance.review.cases.respond(
   *     'case_id',
   *     { determination: 'no_violation' },
   *   );
   * ```
   */
  respond(
    caseID: string,
    params: CaseRespondParams,
    options?: RequestOptions,
  ): APIPromise<BetaComplianceReviewCase> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/compliance/review/cases/${caseID}/respond`, {
      body,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.compliance.review.cases.respond', options, {
        route: '/v1/compliance/review/cases/{case_id}/respond',
        attributes: { 'anthropic.compliance.review.case.id': caseID },
      }),
    });
  }
}

export type BetaComplianceReviewCasesPageCursor = PageCursor<BetaComplianceReviewCase>;

/**
 * A record of an organization's messages that Anthropic flagged and sent to the
 * organization to review. It lists the messages by ID and doesn't include their
 * content.
 */
export interface BetaComplianceReviewCase {
  /**
   * The unique ID of the case (`rvc_...`).
   */
  id: string;

  /**
   * When Anthropic sent the case. The time you have to respond starts here.
   */
  created_at: string;

  /**
   * The action that Anthropic took before it sent the case. Null when it took none.
   */
  enforcement_action: BetaComplianceReviewEnforcementAction | null;

  /**
   * The UUID of the organization that sent the flagged messages, which the case
   * belongs to.
   */
  organization_id: string;

  /**
   * Anthropic's labels for why the messages were flagged, such as `cyber` or
   * `fraud`. There is at least one. New values can appear, so accept a value that
   * you don't know.
   */
  policy_categories: Array<BetaComplianceReviewPolicyCategory>;

  /**
   * Whether Anthropic is still waiting for a response.
   */
  status: BetaComplianceReviewCaseStatus;

  /**
   * The flagged messages. There is at least one, and the list isn't paginated.
   */
  transcripts: Array<BetaComplianceReviewTranscript>;

  /**
   * The object type, always `compliance_review_case`.
   */
  type: 'compliance_review_case';

  /**
   * When the case last changed. It changes when Anthropic sends the case, when the
   * case closes, and when Anthropic sends a notice about the case.
   */
  updated_at: string;

  /**
   * The ID of the workspace that sent the flagged messages (`wrkspc_...`). Null when
   * the messages have no workspace, and it can be null for the default workspace.
   */
  workspace_id: string | null;
}

/**
 * Why a review case closed.
 */
export interface BetaComplianceReviewCaseCloseReason {
  /**
   * `responded` means that Anthropic recorded a response. `window_ended` means that
   * the time to respond ended with no response. `ended_by_anthropic` means that
   * Anthropic ended the case before that time was over. New values can appear, so
   * accept a value that you don't know.
   */
  type: 'responded' | 'window_ended' | 'ended_by_anthropic';
}

/**
 * Anthropic has stopped waiting for a response. A closed case stays closed.
 */
export interface BetaComplianceReviewCaseClosed {
  /**
   * Why the case closed. It doesn't change afterwards.
   */
  reason: BetaComplianceReviewCaseCloseReason;

  type: 'closed';
}

/**
 * Anthropic is waiting for a response to the case.
 */
export interface BetaComplianceReviewCaseOpen {
  type: 'open';
}

/**
 * The field that a list of review cases is sorted by: `created_at` or
 * `updated_at`.
 *
 * - `created_at` - Sort by when Anthropic sent the case.
 * - `updated_at` - Sort by when the case last changed.
 */
export type BetaComplianceReviewCaseOrderBy = 'created_at' | 'updated_at';

/**
 * The status of a review case.
 */
export type BetaComplianceReviewCaseStatus = BetaComplianceReviewCaseOpen | BetaComplianceReviewCaseClosed;

/**
 * A review case status to filter by: `open` or `closed`.
 *
 * - `open` - Cases that Anthropic is waiting for a response to.
 * - `closed` - Cases that Anthropic has stopped waiting on.
 */
export type BetaComplianceReviewCaseStatusFilter = 'open' | 'closed';

/**
 * A conclusion on flagged messages: `violation` or `no_violation`.
 *
 * - `violation` - The messages violated a policy.
 * - `no_violation` - The messages violated no policy.
 */
export type BetaComplianceReviewDetermination = 'violation' | 'no_violation';

/**
 * An action that Anthropic took on the flagged traffic.
 */
export interface BetaComplianceReviewEnforcementAction {
  /**
   * The kind of action. New values can appear, so accept a value that you don't
   * know.
   */
  type: string;
}

export type BetaComplianceReviewPolicyCategory =
  | 'cyber'
  | 'bio'
  | 'chem'
  | 'radnuc'
  | 'cgw'
  | 'mgw'
  | 'io'
  | 'fraud'
  | 'violent_extremism'
  | 'surveillance'
  | 'human_exploitation'
  | 'self_harm'
  | 'adult_content'
  | 'reasoning_extraction'
  | 'frontier_llm'
  | 'compromised_key'
  | 'benign'
  | 'other'
  | 'undetermined';

/**
 * One flagged message of a review case.
 */
export interface BetaComplianceReviewTranscript {
  /**
   * The ID of the flagged message.
   */
  item_id: string;

  /**
   * The ID of the user profile that the message belongs to. Null when the message
   * belongs to none, or when the profile can no longer be looked up.
   */
  user_profile_id: string | null;
}

/**
 * Your conclusion on one message of a review case.
 */
export interface BetaComplianceReviewVerdictParam {
  /**
   * Your conclusion on this message.
   */
  determination: BetaComplianceReviewDetermination;

  /**
   * The `item_id` of one of the case's `transcripts`.
   */
  item_id: string;

  /**
   * The policy category that this message violated, from the values that the
   * request's `policy_categories` accepts. Optional with `violation`. Leave it out
   * with `no_violation`.
   */
  policy_category?: BetaComplianceReviewViolatedPolicyCategory | null;
}

export type BetaComplianceReviewViolatedPolicyCategory =
  | 'cyber'
  | 'bio'
  | 'chem'
  | 'radnuc'
  | 'cgw'
  | 'mgw'
  | 'io'
  | 'fraud'
  | 'violent_extremism'
  | 'surveillance'
  | 'human_exploitation'
  | 'self_harm'
  | 'adult_content'
  | 'reasoning_extraction'
  | 'frontier_llm'
  | 'compromised_key'
  | 'other';

export interface CaseRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface CaseListParams extends PageCursorParams {
  /**
   * Query param: Return only cases whose `created_at` is after this time.
   */
  'created_at[gt]'?: string;

  /**
   * Query param: Return only cases whose `created_at` is at or after this time.
   */
  'created_at[gte]'?: string;

  /**
   * Query param: Return only cases whose `created_at` is before this time.
   */
  'created_at[lt]'?: string;

  /**
   * Query param: Return only cases whose `created_at` is at or before this time.
   */
  'created_at[lte]'?: string;

  /**
   * Query param: Sort direction, by `order_by` and then by `id`. Defaults to `desc`.
   */
  order?: ReviewAPI.BetaComplianceReviewOrder;

  /**
   * Query param: The field to sort by. Defaults to `created_at`.
   */
  order_by?: BetaComplianceReviewCaseOrderBy;

  /**
   * Query param: Return only cases with this status. Leave it out to get both open
   * and closed cases.
   */
  status?: BetaComplianceReviewCaseStatusFilter;

  /**
   * Query param: Return only cases whose `updated_at` is after this time.
   */
  'updated_at[gt]'?: string;

  /**
   * Query param: Return cases whose `updated_at` is at or after this time. Cases
   * slightly older than this time are also returned, so that a sync misses no
   * change.
   */
  'updated_at[gte]'?: string;

  /**
   * Query param: Return only cases whose `updated_at` is before this time.
   */
  'updated_at[lt]'?: string;

  /**
   * Query param: Return only cases whose `updated_at` is at or before this time.
   */
  'updated_at[lte]'?: string;

  /**
   * Query param: Return only cases where a message's `user_profile_id` is this ID,
   * including cases that also have messages of other user profiles. A case stops
   * matching once its messages' `user_profile_id` is null. An ID that matches no
   * reachable case returns no cases. A request that sends the
   * `anthropic-user-profile-id` header without this parameter returns a 400 error.
   */
  user_profile_id?: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface CaseRespondParams {
  /**
   * Body param: Your conclusion on the case as a whole. Anthropic doesn't check it
   * against `verdicts`.
   */
  determination: BetaComplianceReviewDetermination;

  /**
   * Body param: The policy categories that you found were violated. Send one to four
   * with `violation`, and none with `no_violation`. They need not match the case's
   * own. Each value is one of `cyber`, `bio`, `chem`, `radnuc` (radiological or
   * nuclear weapons), `cgw` (conventional weapons), `mgw` (military-grade weapons
   * systems), `io` (influence operations), `fraud`, `violent_extremism`,
   * `surveillance`, `human_exploitation`, `self_harm`, `adult_content`,
   * `reasoning_extraction`, `frontier_llm` (use of the model to accelerate frontier
   * AI research and development in restricted ways), `compromised_key` or `other`,
   * and can appear once.
   */
  policy_categories?: Array<BetaComplianceReviewViolatedPolicyCategory>;

  /**
   * Body param: Your conclusions on individual messages of the case. They need not
   * cover every message, and each `item_id` can appear once.
   */
  verdicts?: Array<BetaComplianceReviewVerdictParam>;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Cases {
  export {
    type BetaComplianceReviewCase as BetaComplianceReviewCase,
    type BetaComplianceReviewCaseCloseReason as BetaComplianceReviewCaseCloseReason,
    type BetaComplianceReviewCaseClosed as BetaComplianceReviewCaseClosed,
    type BetaComplianceReviewCaseOpen as BetaComplianceReviewCaseOpen,
    type BetaComplianceReviewCaseOrderBy as BetaComplianceReviewCaseOrderBy,
    type BetaComplianceReviewCaseStatus as BetaComplianceReviewCaseStatus,
    type BetaComplianceReviewCaseStatusFilter as BetaComplianceReviewCaseStatusFilter,
    type BetaComplianceReviewDetermination as BetaComplianceReviewDetermination,
    type BetaComplianceReviewEnforcementAction as BetaComplianceReviewEnforcementAction,
    type BetaComplianceReviewPolicyCategory as BetaComplianceReviewPolicyCategory,
    type BetaComplianceReviewTranscript as BetaComplianceReviewTranscript,
    type BetaComplianceReviewVerdictParam as BetaComplianceReviewVerdictParam,
    type BetaComplianceReviewViolatedPolicyCategory as BetaComplianceReviewViolatedPolicyCategory,
    type BetaComplianceReviewCasesPageCursor as BetaComplianceReviewCasesPageCursor,
    type CaseRetrieveParams as CaseRetrieveParams,
    type CaseListParams as CaseListParams,
    type CaseRespondParams as CaseRespondParams,
  };
}
