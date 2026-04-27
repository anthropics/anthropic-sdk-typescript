// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as AgentsAPI from './agents';
import { BetaManagedAgentsAgentsPageCursor } from './agents';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Versions extends APIResource {
  /**
   * List Agent Versions
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsAgent of client.beta.agents.versions.list(
   *   'agent_011CZkYpogX7uDKUyvBTophP',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    agentID: string,
    params: VersionListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaManagedAgentsAgentsPageCursor, AgentsAPI.BetaManagedAgentsAgent> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/agents/${agentID}/versions?beta=true`,
      PageCursor<AgentsAPI.BetaManagedAgentsAgent>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'managed-agents-2026-04-01'].toString() },
          options?.headers,
        ]),
      },
    );
  }
}

export interface VersionListParams extends PageCursorParams {
  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Versions {
  export { type VersionListParams as VersionListParams };
}

export { type BetaManagedAgentsAgentsPageCursor };
