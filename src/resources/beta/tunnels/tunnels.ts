import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import * as CertificatesAPI from './certificates';
import {
  BetaTunnelCertificate,
  BetaTunnelCertificatesPageCursor,
  CertificateArchiveParams,
  CertificateCreateParams,
  CertificateListParams,
  CertificateRetrieveParams,
  Certificates,
} from './certificates';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

export class Tunnels extends APIResource {
  certificates: CertificatesAPI.Certificates = new CertificatesAPI.Certificates(this._client);

  /**
   * The Tunnels API is in research preview. It requires the
   * `anthropic-beta: mcp-tunnels-2026-06-22` header and may change without a
   * deprecation period. It supersedes the Admin API endpoints at
   * `/v1/organizations/tunnels`, which remain available during a migration window.
   *
   * Creates a tunnel. Creation allocates a fresh hostname and provisions the tunnel;
   * it is not idempotent. The new tunnel rejects MCP traffic until at least one CA
   * certificate is added.
   *
   * @example
   * ```ts
   * const betaTunnel = await client.beta.tunnels.create();
   * ```
   */
  create(params: TunnelCreateParams, options?: RequestOptions): APIPromise<BetaTunnel> {
    const { betas, workspace_id, ...body } = params;
    return this._client.post('/v1/tunnels', {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'mcp-tunnels-2026-06-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.tunnels.create', options, {
        route: '/v1/tunnels',
        createdIDAttribute: 'anthropic.tunnel.id',
      }),
    });
  }

  /**
   * The Tunnels API is in research preview. It requires the
   * `anthropic-beta: mcp-tunnels-2026-06-22` header and may change without a
   * deprecation period. It supersedes the Admin API endpoints at
   * `/v1/organizations/tunnels`, which remain available during a migration window.
   *
   * Fetches a tunnel by ID.
   *
   * @example
   * ```ts
   * const betaTunnel = await client.beta.tunnels.retrieve(
   *   'tunnel_id',
   * );
   * ```
   */
  retrieve(
    tunnelID: string,
    params: TunnelRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaTunnel> {
    const { betas, workspace_id } = params ?? {};
    return this._client.get(path`/v1/tunnels/${tunnelID}`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'mcp-tunnels-2026-06-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.tunnels.retrieve', options, {
        route: '/v1/tunnels/{tunnel_id}',
        attributes: { 'anthropic.tunnel.id': tunnelID },
      }),
    });
  }

  /**
   * The Tunnels API is in research preview. It requires the
   * `anthropic-beta: mcp-tunnels-2026-06-22` header and may change without a
   * deprecation period. It supersedes the Admin API endpoints at
   * `/v1/organizations/tunnels`, which remain available during a migration window.
   *
   * Lists tunnels. Results are ordered by creation time, newest first; archived
   * tunnels are excluded unless include_archived is set.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaTunnel of client.beta.tunnels.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: TunnelListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaTunnelsPageCursor, BetaTunnel> {
    const { betas, workspace_id, ...query } = params ?? {};
    return this._client.getAPIList('/v1/tunnels', PageCursor<BetaTunnel>, {
      query,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'mcp-tunnels-2026-06-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.tunnels.list', options, {
        route: '/v1/tunnels',
        queryParams: ['include_archived', 'limit', 'page'],
      }),
    });
  }

  /**
   * The Tunnels API is in research preview. It requires the
   * `anthropic-beta: mcp-tunnels-2026-06-22` header and may change without a
   * deprecation period. It supersedes the Admin API endpoints at
   * `/v1/organizations/tunnels`, which remain available during a migration window.
   *
   * Archives a tunnel. Archival is irreversible: every non-archived certificate on
   * the tunnel is archived in the same operation, the hostname is retired and never
   * re-allocated, and the tunnel token is invalidated. Retrying against an
   * already-archived tunnel returns the existing record unchanged.
   *
   * @example
   * ```ts
   * const betaTunnel = await client.beta.tunnels.archive(
   *   'tunnel_id',
   * );
   * ```
   */
  archive(
    tunnelID: string,
    params: TunnelArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaTunnel> {
    const { betas, workspace_id } = params ?? {};
    return this._client.post(path`/v1/tunnels/${tunnelID}/archive`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'mcp-tunnels-2026-06-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.tunnels.archive', options, {
        route: '/v1/tunnels/{tunnel_id}/archive',
        attributes: { 'anthropic.tunnel.id': tunnelID },
      }),
    });
  }

  /**
   * The Tunnels API is in research preview. It requires the
   * `anthropic-beta: mcp-tunnels-2026-06-22` header and may change without a
   * deprecation period. It supersedes the Admin API endpoints at
   * `/v1/organizations/tunnels`, which remain available during a migration window.
   *
   * Reveals a tunnel's connector token. The value is fetched live on each call;
   * Anthropic does not store it. Repeated calls return the same value until the
   * token is rotated. Exposed as POST so the token does not appear in intermediary
   * access logs.
   *
   * @example
   * ```ts
   * const betaTunnelToken =
   *   await client.beta.tunnels.revealToken('tunnel_id');
   * ```
   */
  revealToken(
    tunnelID: string,
    params: TunnelRevealTokenParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaTunnelToken> {
    const { betas, workspace_id } = params ?? {};
    return this._client.post(path`/v1/tunnels/${tunnelID}/reveal_token`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'mcp-tunnels-2026-06-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.tunnels.reveal_token', options, {
        route: '/v1/tunnels/{tunnel_id}/reveal_token',
        attributes: { 'anthropic.tunnel.id': tunnelID },
      }),
    });
  }

  /**
   * The Tunnels API is in research preview. It requires the
   * `anthropic-beta: mcp-tunnels-2026-06-22` header and may change without a
   * deprecation period. It supersedes the Admin API endpoints at
   * `/v1/organizations/tunnels`, which remain available during a migration window.
   *
   * Rotates a tunnel's connector token. Rotation invalidates the current token for
   * new connections and returns a fresh value; established connections are not
   * severed. A connector restarted after rotation must use the new value.
   *
   * @example
   * ```ts
   * const betaTunnelToken =
   *   await client.beta.tunnels.rotateToken('tunnel_id');
   * ```
   */
  rotateToken(
    tunnelID: string,
    params: TunnelRotateTokenParams,
    options?: RequestOptions,
  ): APIPromise<BetaTunnelToken> {
    const { betas, workspace_id, ...body } = params;
    return this._client.post(path`/v1/tunnels/${tunnelID}/rotate_token`, {
      body,
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'mcp-tunnels-2026-06-22'].toString(),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.tunnels.rotate_token', options, {
        route: '/v1/tunnels/{tunnel_id}/rotate_token',
        attributes: { 'anthropic.tunnel.id': tunnelID },
      }),
    });
  }
}

export type BetaTunnelsPageCursor = PageCursor<BetaTunnel>;

/**
 * An MCP tunnel.
 */
export interface BetaTunnel {
  /**
   * Unique identifier for the tunnel, prefixed with `tnl_`.
   */
  id: string;

  /**
   * RFC 3339 datetime string indicating when the tunnel was archived. Null if it is
   * not archived.
   */
  archived_at: string | null;

  /**
   * RFC 3339 datetime string indicating when the tunnel was created.
   */
  created_at: string;

  /**
   * Human-readable name for the tunnel (1-255 characters). Null if unset.
   */
  display_name: string | null;

  /**
   * Anthropic-assigned hostname for the tunnel. MCP server URLs whose host is a
   * subdomain of this value are routed through the tunnel. Globally unique and never
   * reused, even after the tunnel is archived.
   */
  domain: string;

  type: 'tunnel';
}

/**
 * A tunnel's connector token.
 */
export interface BetaTunnelToken {
  /**
   * Stable identifier for the current token value. Changes when the token is
   * rotated.
   */
  id: string;

  /**
   * The connector token used to run the tunnel. Treat as a credential.
   */
  tunnel_token: string;

  type: 'tunnel_token';
}

export interface TunnelCreateParams {
  /**
   * Body param: Optional human-readable name for the tunnel (1-255 characters).
   */
  display_name?: string | null;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `mcp-tunnels-2026-06-22` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface TunnelRetrieveParams {
  /**
   * This endpoint is in beta: requests must send `mcp-tunnels-2026-06-22` in this
   * header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Optional header to select the Workspace for this request. The value is a
   * Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface TunnelListParams extends PageCursorParams {
  /**
   * Query param: Whether to include archived tunnels in the results. Defaults to
   * false.
   */
  include_archived?: boolean;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `mcp-tunnels-2026-06-22` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface TunnelArchiveParams {
  /**
   * This endpoint is in beta: requests must send `mcp-tunnels-2026-06-22` in this
   * header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Optional header to select the Workspace for this request. The value is a
   * Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface TunnelRevealTokenParams {
  /**
   * This endpoint is in beta: requests must send `mcp-tunnels-2026-06-22` in this
   * header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Optional header to select the Workspace for this request. The value is a
   * Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

export interface TunnelRotateTokenParams {
  /**
   * Body param: Optional free-text reason for the rotation, recorded for audit.
   */
  reason?: string | null;

  /**
   * Header param: This endpoint is in beta: requests must send
   * `mcp-tunnels-2026-06-22` in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;

  /**
   * Header param: Optional header to select the Workspace for this request. The
   * value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).
   *
   * Only needed for credentials that can act on more than one Workspace. A
   * credential that belongs to a specific Workspace may omit it; if sent, it must
   * match that Workspace.
   */
  workspace_id?: string;
}

Tunnels.Certificates = Certificates;

export declare namespace Tunnels {
  export {
    type BetaTunnel as BetaTunnel,
    type BetaTunnelToken as BetaTunnelToken,
    type BetaTunnelsPageCursor as BetaTunnelsPageCursor,
    type TunnelCreateParams as TunnelCreateParams,
    type TunnelRetrieveParams as TunnelRetrieveParams,
    type TunnelListParams as TunnelListParams,
    type TunnelArchiveParams as TunnelArchiveParams,
    type TunnelRevealTokenParams as TunnelRevealTokenParams,
    type TunnelRotateTokenParams as TunnelRotateTokenParams,
  };

  export {
    Certificates as Certificates,
    type BetaTunnelCertificate as BetaTunnelCertificate,
    type BetaTunnelCertificatesPageCursor as BetaTunnelCertificatesPageCursor,
    type CertificateCreateParams as CertificateCreateParams,
    type CertificateRetrieveParams as CertificateRetrieveParams,
    type CertificateListParams as CertificateListParams,
    type CertificateArchiveParams as CertificateArchiveParams,
  };
}
