// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import { APIPromise } from '../../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Certificates extends APIResource {
  /**
   * The Tunnels API is in research preview. It requires the
   * `anthropic-beta: mcp-tunnels-2026-06-22` header and may change without a
   * deprecation period. It supersedes the Admin API endpoints at
   * `/v1/organizations/tunnels`, which remain available during a migration window.
   *
   * Registers a public CA certificate on a tunnel. Anthropic verifies the gateway's
   * server certificate against this CA when it terminates the inner TLS session. A
   * tunnel holds at most two non-archived certificates.
   *
   * @example
   * ```ts
   * const betaTunnelCertificate =
   *   await client.beta.tunnels.certificates.create(
   *     'tunnel_id',
   *     { ca_certificate_pem: 'ca_certificate_pem' },
   *   );
   * ```
   */
  create(
    tunnelID: string,
    params: CertificateCreateParams,
    options?: RequestOptions,
  ): APIPromise<BetaTunnelCertificate> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/tunnels/${tunnelID}/certificates?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'mcp-tunnels-2026-06-22'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * The Tunnels API is in research preview. It requires the
   * `anthropic-beta: mcp-tunnels-2026-06-22` header and may change without a
   * deprecation period. It supersedes the Admin API endpoints at
   * `/v1/organizations/tunnels`, which remain available during a migration window.
   *
   * Fetches a tunnel certificate by ID.
   *
   * @example
   * ```ts
   * const betaTunnelCertificate =
   *   await client.beta.tunnels.certificates.retrieve(
   *     'certificate_id',
   *     { tunnel_id: 'tunnel_id' },
   *   );
   * ```
   */
  retrieve(
    certificateID: string,
    params: CertificateRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<BetaTunnelCertificate> {
    const { tunnel_id, betas } = params;
    return this._client.get(path`/v1/tunnels/${tunnel_id}/certificates/${certificateID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'mcp-tunnels-2026-06-22'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * The Tunnels API is in research preview. It requires the
   * `anthropic-beta: mcp-tunnels-2026-06-22` header and may change without a
   * deprecation period. It supersedes the Admin API endpoints at
   * `/v1/organizations/tunnels`, which remain available during a migration window.
   *
   * Lists the certificates registered on a tunnel. Archived certificates are
   * excluded unless include_archived is set.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaTunnelCertificate of client.beta.tunnels.certificates.list(
   *   'tunnel_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    tunnelID: string,
    params: CertificateListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaTunnelCertificatesPageCursor, BetaTunnelCertificate> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(
      path`/v1/tunnels/${tunnelID}/certificates?beta=true`,
      PageCursor<BetaTunnelCertificate>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'mcp-tunnels-2026-06-22'].toString() },
          options?.headers,
        ]),
      },
    );
  }

  /**
   * The Tunnels API is in research preview. It requires the
   * `anthropic-beta: mcp-tunnels-2026-06-22` header and may change without a
   * deprecation period. It supersedes the Admin API endpoints at
   * `/v1/organizations/tunnels`, which remain available during a migration window.
   *
   * Archives a tunnel certificate, removing it from the set Anthropic trusts for the
   * tunnel. The certificate record is retained. Archiving the last non-archived
   * certificate is permitted; the tunnel rejects MCP traffic until a new certificate
   * is added.
   *
   * @example
   * ```ts
   * const betaTunnelCertificate =
   *   await client.beta.tunnels.certificates.archive(
   *     'certificate_id',
   *     { tunnel_id: 'tunnel_id' },
   *   );
   * ```
   */
  archive(
    certificateID: string,
    params: CertificateArchiveParams,
    options?: RequestOptions,
  ): APIPromise<BetaTunnelCertificate> {
    const { tunnel_id, betas } = params;
    return this._client.post(path`/v1/tunnels/${tunnel_id}/certificates/${certificateID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'mcp-tunnels-2026-06-22'].toString() },
        options?.headers,
      ]),
    });
  }
}

export type BetaTunnelCertificatesPageCursor = PageCursor<BetaTunnelCertificate>;

/**
 * A CA certificate attached to a tunnel.
 */
export interface BetaTunnelCertificate {
  /**
   * Unique identifier for the certificate, prefixed with `tcrt_`.
   */
  id: string;

  /**
   * A timestamp in RFC 3339 format
   */
  archived_at: string | null;

  /**
   * A timestamp in RFC 3339 format
   */
  created_at: string;

  /**
   * A timestamp in RFC 3339 format
   */
  expires_at: string | null;

  /**
   * Lowercase hex SHA-256 fingerprint of the certificate's DER encoding.
   */
  fingerprint: string;

  /**
   * ID of the tunnel the certificate is registered against.
   */
  tunnel_id: string;

  type: 'tunnel_certificate';
}

export interface CertificateCreateParams {
  /**
   * Body param: PEM-encoded X.509 CA certificate. Must contain exactly one
   * certificate and no private-key material. Maximum 8KB.
   */
  ca_certificate_pem: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface CertificateRetrieveParams {
  /**
   * Path param: Path parameter tunnel_id
   */
  tunnel_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface CertificateListParams extends PageCursorParams {
  /**
   * Query param: Whether to include archived certificates in the results. Defaults
   * to false.
   */
  include_archived?: boolean;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface CertificateArchiveParams {
  /**
   * Path param: Path parameter tunnel_id
   */
  tunnel_id: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Certificates {
  export {
    type BetaTunnelCertificate as BetaTunnelCertificate,
    type BetaTunnelCertificatesPageCursor as BetaTunnelCertificatesPageCursor,
    type CertificateCreateParams as CertificateCreateParams,
    type CertificateRetrieveParams as CertificateRetrieveParams,
    type CertificateListParams as CertificateListParams,
    type CertificateArchiveParams as CertificateArchiveParams,
  };
}
