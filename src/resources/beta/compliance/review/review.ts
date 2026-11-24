import { APIResource } from '../../../../core/resource';
import * as CasesAPI from './cases';
import {
  BetaComplianceReviewCase,
  BetaComplianceReviewCaseCloseReason,
  BetaComplianceReviewCaseClosed,
  BetaComplianceReviewCaseOpen,
  BetaComplianceReviewCaseOrderBy,
  BetaComplianceReviewCaseStatus,
  BetaComplianceReviewCaseStatusFilter,
  BetaComplianceReviewCasesPageCursor,
  BetaComplianceReviewDetermination,
  BetaComplianceReviewEnforcementAction,
  BetaComplianceReviewPolicyCategory,
  BetaComplianceReviewTranscript,
  BetaComplianceReviewVerdictParam,
  BetaComplianceReviewViolatedPolicyCategory,
  CaseListParams,
  CaseRespondParams,
  CaseRetrieveParams,
  Cases,
} from './cases';
import * as ItemsAPI from './items';
import {
  BetaComplianceReviewAPIActor,
  BetaComplianceReviewActor,
  BetaComplianceReviewContentNotCaptured,
  BetaComplianceReviewContentUnavailableReason,
  BetaComplianceReviewCreateMessageContent,
  BetaComplianceReviewItem,
  BetaComplianceReviewMessageDetails,
  BetaComplianceReviewSafeguardsReason,
  BetaComplianceReviewServiceAccountActor,
  BetaComplianceReviewStoredCopyUnavailable,
  BetaComplianceReviewUserActor,
  ItemRetrieveParams,
  Items,
} from './items';
import * as NoticesAPI from './notices';
import {
  BetaComplianceReviewNotice,
  BetaComplianceReviewNoticeKind,
  BetaComplianceReviewNoticesPageCursor,
  NoticeListParams,
  Notices,
} from './notices';

export class Review extends APIResource {
  cases: CasesAPI.Cases = new CasesAPI.Cases(this._client);
  notices: NoticesAPI.Notices = new NoticesAPI.Notices(this._client);
  items: ItemsAPI.Items = new ItemsAPI.Items(this._client);
}

/**
 * A sort direction: `asc` or `desc`.
 *
 * - `asc` - Oldest first.
 * - `desc` - Newest first.
 */
export type BetaComplianceReviewOrder = 'asc' | 'desc';

Review.Cases = Cases;
Review.Notices = Notices;
Review.Items = Items;

export declare namespace Review {
  export { type BetaComplianceReviewOrder as BetaComplianceReviewOrder };

  export {
    Cases as Cases,
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

  export {
    Notices as Notices,
    type BetaComplianceReviewNotice as BetaComplianceReviewNotice,
    type BetaComplianceReviewNoticeKind as BetaComplianceReviewNoticeKind,
    type BetaComplianceReviewNoticesPageCursor as BetaComplianceReviewNoticesPageCursor,
    type NoticeListParams as NoticeListParams,
  };

  export {
    Items as Items,
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
