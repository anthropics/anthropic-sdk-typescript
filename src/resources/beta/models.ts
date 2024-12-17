// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import { Page, type PageParams, PagePromise } from '../../pagination';
import { RequestOptions } from '../../internal/request-options';

export class Models extends APIResource {
  /**
   * Get a specific model.
   *
   * The Models API response can be used to determine information about a specific
   * model or resolve a model alias to a model ID.
   */
  retrieve(modelID: string, options?: RequestOptions): APIPromise<BetaModelInfo> {
    return this._client.get(`/v1/models/${modelID}?beta=true`, options);
  }

  /**
   * List available models.
   *
   * The Models API response can be used to determine which models are available for
   * use in the API. More recently released models are listed first.
   */
  list(
    query: ModelListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaModelInfosPage, BetaModelInfo> {
    return this._client.getAPIList('/v1/models?beta=true', Page<BetaModelInfo>, { query, ...options });
  }
}

export type BetaModelInfosPage = Page<BetaModelInfo>;

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

export declare namespace Models {
  export {
    type BetaModelInfo as BetaModelInfo,
    type BetaModelInfosPage as BetaModelInfosPage,
    type ModelListParams as ModelListParams,
  };
}
