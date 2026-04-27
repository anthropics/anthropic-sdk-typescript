// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as BetaAPI from './beta';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Environments extends APIResource {
  /**
   * Create a new environment with the specified configuration.
   *
   * @example
   * ```ts
   * const betaEnvironment =
   *   await client.beta.environments.create({
   *     name: 'python-data-analysis',
   *   });
   * ```
   */
  create(params: EnvironmentCreateParams, options?: RequestOptions): APIPromise<BetaEnvironment> {
    const { betas, ...body } = params;
    return this._client.post('/v1/environments?beta=true', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Retrieve a specific environment by ID.
   *
   * @example
   * ```ts
   * const betaEnvironment =
   *   await client.beta.environments.retrieve(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  retrieve(
    environmentID: string,
    params: EnvironmentRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaEnvironment> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/environments/${environmentID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Update an existing environment's configuration.
   *
   * @example
   * ```ts
   * const betaEnvironment =
   *   await client.beta.environments.update(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  update(
    environmentID: string,
    params: EnvironmentUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaEnvironment> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/environments/${environmentID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * List environments with pagination support.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaEnvironment of client.beta.environments.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: EnvironmentListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaEnvironmentsPageCursor, BetaEnvironment> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/environments?beta=true', PageCursor<BetaEnvironment>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete an environment by ID. Returns a confirmation of the deletion.
   *
   * @example
   * ```ts
   * const betaEnvironmentDeleteResponse =
   *   await client.beta.environments.delete(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  delete(
    environmentID: string,
    params: EnvironmentDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaEnvironmentDeleteResponse> {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/environments/${environmentID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Archive an environment by ID. Archived environments cannot be used to create new
   * sessions.
   *
   * @example
   * ```ts
   * const betaEnvironment =
   *   await client.beta.environments.archive(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  archive(
    environmentID: string,
    params: EnvironmentArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaEnvironment> {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/environments/${environmentID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaEnvironmentsPageCursor = PageCursor<BetaEnvironment>;

/**
 * `cloud` environment configuration.
 */
export interface BetaCloudConfig {
  /**
   * Network configuration policy.
   */
  networking: BetaUnrestrictedNetwork | BetaLimitedNetwork;

  /**
   * Package manager configuration.
   */
  packages: BetaPackages;

  /**
   * Environment type
   */
  type: 'cloud';
}

/**
 * Request params for `cloud` environment configuration.
 *
 * Fields default to null; on update, omitted fields preserve the existing value.
 */
export interface BetaCloudConfigParams {
  /**
   * Environment type
   */
  type: 'cloud';

  /**
   * Network configuration policy. Omit on update to preserve the existing value.
   */
  networking?: BetaUnrestrictedNetwork | BetaLimitedNetworkParams | null;

  /**
   * Specify packages (and optionally their versions) available in this environment.
   *
   * When versioning, use the version semantics relevant for the package manager,
   * e.g. for `pip` use `package==1.0.0`. You are responsible for validating the
   * package and version exist. Unversioned installs the latest.
   */
  packages?: BetaPackagesParams | null;
}

/**
 * Unified Environment resource for both cloud and BYOC environments.
 */
export interface BetaEnvironment {
  /**
   * Environment identifier (e.g., 'env\_...')
   */
  id: string;

  /**
   * RFC 3339 timestamp when environment was archived, or null if not archived
   */
  archived_at: string | null;

  /**
   * `cloud` environment configuration.
   */
  config: BetaCloudConfig;

  /**
   * RFC 3339 timestamp when environment was created
   */
  created_at: string;

  /**
   * User-provided description for the environment
   */
  description: string;

  /**
   * User-provided metadata key-value pairs
   */
  metadata: { [key: string]: string };

  /**
   * Human-readable name for the environment
   */
  name: string;

  /**
   * The type of object (always 'environment')
   */
  type: 'environment';

  /**
   * RFC 3339 timestamp when environment was last updated
   */
  updated_at: string;
}

/**
 * Response after deleting an environment.
 */
export interface BetaEnvironmentDeleteResponse {
  /**
   * Environment identifier
   */
  id: string;

  /**
   * The type of response
   */
  type: 'environment_deleted';
}

/**
 * Limited network access.
 */
export interface BetaLimitedNetwork {
  /**
   * Permits outbound access to MCP server endpoints configured on the agent, beyond
   * those listed in the `allowed_hosts` array.
   */
  allow_mcp_servers: boolean;

  /**
   * Permits outbound access to public package registries (PyPI, npm, etc.) beyond
   * those listed in the `allowed_hosts` array.
   */
  allow_package_managers: boolean;

  /**
   * Specifies domains the container can reach.
   */
  allowed_hosts: Array<string>;

  /**
   * Network policy type
   */
  type: 'limited';
}

/**
 * Limited network request params.
 *
 * Fields default to null; on update, omitted fields preserve the existing value.
 */
export interface BetaLimitedNetworkParams {
  /**
   * Network policy type
   */
  type: 'limited';

  /**
   * Permits outbound access to MCP server endpoints configured on the agent, beyond
   * those listed in the `allowed_hosts` array. Defaults to `false`.
   */
  allow_mcp_servers?: boolean | null;

  /**
   * Permits outbound access to public package registries (PyPI, npm, etc.) beyond
   * those listed in the `allowed_hosts` array. Defaults to `false`.
   */
  allow_package_managers?: boolean | null;

  /**
   * Specifies domains the container can reach.
   */
  allowed_hosts?: Array<string> | null;
}

/**
 * Packages (and their versions) available in this environment.
 */
export interface BetaPackages {
  /**
   * Ubuntu/Debian packages to install
   */
  apt: Array<string>;

  /**
   * Rust packages to install
   */
  cargo: Array<string>;

  /**
   * Ruby packages to install
   */
  gem: Array<string>;

  /**
   * Go packages to install
   */
  go: Array<string>;

  /**
   * Node.js packages to install
   */
  npm: Array<string>;

  /**
   * Python packages to install
   */
  pip: Array<string>;

  /**
   * Package configuration type
   */
  type?: 'packages';
}

/**
 * Specify packages (and optionally their versions) available in this environment.
 *
 * When versioning, use the version semantics relevant for the package manager,
 * e.g. for `pip` use `package==1.0.0`. You are responsible for validating the
 * package and version exist. Unversioned installs the latest.
 */
export interface BetaPackagesParams {
  /**
   * Ubuntu/Debian packages to install
   */
  apt?: Array<string> | null;

  /**
   * Rust packages to install
   */
  cargo?: Array<string> | null;

  /**
   * Ruby packages to install
   */
  gem?: Array<string> | null;

  /**
   * Go packages to install
   */
  go?: Array<string> | null;

  /**
   * Node.js packages to install
   */
  npm?: Array<string> | null;

  /**
   * Python packages to install
   */
  pip?: Array<string> | null;

  /**
   * Package configuration type
   */
  type?: 'packages';
}

/**
 * Unrestricted network access.
 */
export interface BetaUnrestrictedNetwork {
  /**
   * Network policy type
   */
  type: 'unrestricted';
}

export interface EnvironmentCreateParams {
  /**
   * Body param: Human-readable name for the environment
   */
  name: string;

  /**
   * Body param: Request params for `cloud` environment configuration.
   *
   * Fields default to null; on update, omitted fields preserve the existing value.
   */
  config?: BetaCloudConfigParams | null;

  /**
   * Body param: Optional description of the environment
   */
  description?: string | null;

  /**
   * Body param: User-provided metadata key-value pairs
   */
  metadata?: { [key: string]: string };

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface EnvironmentRetrieveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface EnvironmentUpdateParams {
  /**
   * Body param: Request params for `cloud` environment configuration.
   *
   * Fields default to null; on update, omitted fields preserve the existing value.
   */
  config?: BetaCloudConfigParams | null;

  /**
   * Body param: Updated description of the environment
   */
  description?: string | null;

  /**
   * Body param: User-provided metadata key-value pairs. Set a value to null or empty
   * string to delete the key.
   */
  metadata?: { [key: string]: string | null };

  /**
   * Body param: Updated name for the environment
   */
  name?: string | null;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface EnvironmentListParams extends PageCursorParams {
  /**
   * Query param: Include archived environments in the response
   */
  include_archived?: boolean;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface EnvironmentDeleteParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface EnvironmentArchiveParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Environments {
  export {
    type BetaCloudConfig as BetaCloudConfig,
    type BetaCloudConfigParams as BetaCloudConfigParams,
    type BetaEnvironment as BetaEnvironment,
    type BetaEnvironmentDeleteResponse as BetaEnvironmentDeleteResponse,
    type BetaLimitedNetwork as BetaLimitedNetwork,
    type BetaLimitedNetworkParams as BetaLimitedNetworkParams,
    type BetaPackages as BetaPackages,
    type BetaPackagesParams as BetaPackagesParams,
    type BetaUnrestrictedNetwork as BetaUnrestrictedNetwork,
    type BetaEnvironmentsPageCursor as BetaEnvironmentsPageCursor,
    type EnvironmentCreateParams as EnvironmentCreateParams,
    type EnvironmentRetrieveParams as EnvironmentRetrieveParams,
    type EnvironmentUpdateParams as EnvironmentUpdateParams,
    type EnvironmentListParams as EnvironmentListParams,
    type EnvironmentDeleteParams as EnvironmentDeleteParams,
    type EnvironmentArchiveParams as EnvironmentArchiveParams,
  };
}
