// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';
import * as BetaAPI from './beta';
import { Page, type PageParams } from '../../pagination';

export class Models extends APIResource {
  /**
   * Get a specific model.
   *
   * The Models API response can be used to determine information about a specific
   * model or resolve a model alias to a model ID.
   *
   * @example
   * ```ts
   * const betaModelInfo = await client.beta.models.retrieve(
   *   'model_id',
   * );
   * ```
   */
  retrieve(
    modelId: string,
    params?: ModelRetrieveParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<BetaModelInfo>;
  retrieve(modelId: string, options?: Core.RequestOptions): Core.APIPromise<BetaModelInfo>;
  retrieve(
    modelId: string,
    params: ModelRetrieveParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<BetaModelInfo> {
    if (isRequestOptions(params)) {
      return this.retrieve(modelId, {}, params);
    }
    const { betas } = params;
    return this._client.get(`/v1/models/${modelId}?beta=true`, {
      ...options,
      headers: {
        ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined),
        ...options?.headers,
      },
    });
  }

  /**
   * List available models.
   *
   * The Models API response can be used to determine which models are available for
   * use in the API. More recently released models are listed first.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaModelInfo of client.beta.models.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params?: ModelListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<BetaModelInfosPage, BetaModelInfo>;
  list(options?: Core.RequestOptions): Core.PagePromise<BetaModelInfosPage, BetaModelInfo>;
  list(
    params: ModelListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<BetaModelInfosPage, BetaModelInfo> {
    if (isRequestOptions(params)) {
      return this.list({}, params);
    }
    const { betas, ...query } = params;
    return this._client.getAPIList('/v1/models?beta=true', BetaModelInfosPage, {
      query,
      ...options,
      headers: {
        ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined),
        ...options?.headers,
      },
    });
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

export interface ModelRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface ModelListParams extends PageParams {
  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

Models.BetaModelInfosPage = BetaModelInfosPage;

export declare namespace Models {
  export {
    type BetaModelInfo as BetaModelInfo,
    BetaModelInfosPage as BetaModelInfosPage,
    type ModelRetrieveParams as ModelRetrieveParams,
    type ModelListParams as ModelListParams,
  };
}
