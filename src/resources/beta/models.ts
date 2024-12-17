// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';
import { Page, type PageParams } from '../../pagination';

export class Models extends APIResource {
  /**
   * Get a specific model.
   *
   * The Models API response can be used to determine information about a specific
   * model or resolve a model alias to a model ID.
   */
  retrieve(modelId: string, options?: Core.RequestOptions): Core.APIPromise<BetaModelInfo> {
    return this._client.get(`/v1/models/${modelId}?beta=true`, options);
  }

  /**
   * List available models.
   *
   * The Models API response can be used to determine which models are available for
   * use in the API. More recently released models are listed first.
   */
  list(
    query?: ModelListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<BetaModelInfosPage, BetaModelInfo>;
  list(options?: Core.RequestOptions): Core.PagePromise<BetaModelInfosPage, BetaModelInfo>;
  list(
    query: ModelListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<BetaModelInfosPage, BetaModelInfo> {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return this._client.getAPIList('/v1/models?beta=true', BetaModelInfosPage, { query, ...options });
  }
}

export class BetaModelInfosPage extends Page<BetaModelInfo> {}

export interface BetaModelInfo {
  /**
   * Unique model identifier.
   */
  id: string;

  /**
   * RFC 3339 datetime string representing the time at which the model was released.
   * May be set to an epoch value if the release date is unknown.
   */
  created_at: string;

  /**
   * A human-readable name for the model.
   */
  display_name: string;

  /**
   * Object type.
   *
   * For Models, this is always `"model"`.
   */
  type: 'model';
}

export interface ModelListParams extends PageParams {}

Models.BetaModelInfosPage = BetaModelInfosPage;

export declare namespace Models {
  export {
    type BetaModelInfo as BetaModelInfo,
    BetaModelInfosPage as BetaModelInfosPage,
    type ModelListParams as ModelListParams,
  };
}
