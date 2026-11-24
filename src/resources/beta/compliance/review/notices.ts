import { APIResource } from '../../../../core/resource';
import * as BetaAPI from '../../beta';
import * as ReviewAPI from './review';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../../core/pagination';
import { buildHeaders } from '../../../../internal/headers';
import { RequestOptions } from '../../../../internal/request-options';
import { startApiCallSpan } from '../../../../internal/tracing';

export class Notices extends APIResource {
  /**
   * List Anthropic's notices to the organizations that the API key can reach, newest
   * first by default. A notice is returned only if the API key can read every case
   * in its `case_ids`.
   *
   * To poll, store the largest `created_at` you have read, and send it as the
   * at-or-after filter on `created_at`. Read every page, match results by `id`, and
   * store the new largest value after the last page.
   *
   * An Admin API key with the `read:compliance_review_cases` scope can call this
   * endpoint.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaComplianceReviewNotice of client.beta.compliance.review.notices.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: NoticeListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaComplianceReviewNoticesPageCursor, BetaComplianceReviewNotice> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/compliance/review/notices', PageCursor<BetaComplianceReviewNotice>, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined) },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.compliance.review.notices.list', options, {
        route: '/v1/compliance/review/notices',
        queryParams: [
          'case_id',
          'created_at[gt]',
          'created_at[gte]',
          'created_at[lt]',
          'created_at[lte]',
          'limit',
          'order',
          'page',
        ],
      }),
    });
  }
}

export type BetaComplianceReviewNoticesPageCursor = PageCursor<BetaComplianceReviewNotice>;

/**
 * A message from Anthropic to an organization about its review cases or about the
 * organization as a whole, such as a request to respond by a date, a warning, or a
 * question. A notice doesn't change after Anthropic sends it.
 */
export interface BetaComplianceReviewNotice {
  /**
   * The unique ID of the notice (`rvn_...`).
   */
  id: string;

  /**
   * The IDs of the cases that the notice is about (`rvc_...`). Empty when the notice
   * is about the whole organization.
   */
  case_ids: Array<string>;

  /**
   * When Anthropic sent the notice.
   */
  created_at: string;

  /**
   * What kind of notice this is.
   */
  kind: BetaComplianceReviewNoticeKind;

  /**
   * The text of the notice.
   */
  message: string;

  /**
   * The UUID of the organization that the notice is for.
   */
  organization_id: string;

  /**
   * The time by which Anthropic asks for an answer. Null when there is no deadline.
   * Missing it changes nothing on a case, and the time to respond to a case can end
   * before it.
   */
  respond_by: string | null;

  /**
   * The object type, always `compliance_review_notice`.
   */
  type: 'compliance_review_notice';
}

/**
 * The kind of a review notice.
 */
export interface BetaComplianceReviewNoticeKind {
  /**
   * `response_requested` asks you to respond to the cases in `case_ids`. For
   * `warning` and `question`, `message` explains how to answer if an answer is
   * needed. New values can appear, so accept a value that you don't know.
   */
  type: 'response_requested' | 'warning' | 'question';
}

export interface NoticeListParams extends PageCursorParams {
  /**
   * Query param: Return only notices whose `case_ids` include this case (`rvc_...`).
   * A case that the API key can't read returns an empty list.
   */
  case_id?: string;

  /**
   * Query param: Return only notices whose `created_at` is after this time.
   */
  'created_at[gt]'?: string;

  /**
   * Query param: Return notices whose `created_at` is at or after this time. Notices
   * slightly older than this time are also returned, so that a poll misses no
   * notice.
   */
  'created_at[gte]'?: string;

  /**
   * Query param: Return only notices whose `created_at` is before this time.
   */
  'created_at[lt]'?: string;

  /**
   * Query param: Return only notices whose `created_at` is at or before this time.
   */
  'created_at[lte]'?: string;

  /**
   * Query param: Sort direction, by `created_at` and then by `id`. Defaults to
   * `desc`.
   */
  order?: ReviewAPI.BetaComplianceReviewOrder;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Notices {
  export {
    type BetaComplianceReviewNotice as BetaComplianceReviewNotice,
    type BetaComplianceReviewNoticeKind as BetaComplianceReviewNoticeKind,
    type BetaComplianceReviewNoticesPageCursor as BetaComplianceReviewNoticesPageCursor,
    type NoticeListParams as NoticeListParams,
  };
}
