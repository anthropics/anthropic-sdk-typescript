import { APIResource } from '../../../core/resource';
import * as ReviewAPI from './review/review';
import { BetaComplianceReviewOrder, Review } from './review/review';

export class Compliance extends APIResource {
  review: ReviewAPI.Review = new ReviewAPI.Review(this._client);
}

Compliance.Review = Review;

export declare namespace Compliance {
  export { Review as Review, type BetaComplianceReviewOrder as BetaComplianceReviewOrder };
}
