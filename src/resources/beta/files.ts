import { APIResource } from '../../core/resource';
import * as BetaAPI from './beta';
import { APIPromise } from '../../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../../core/pagination';
import { type Uploadable } from '../../core/uploads';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { startApiCallSpan } from '../../internal/tracing';
import { stainlessHelperHeaderFromFile } from '../../internal/stainless-helper-header';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';

export class Files extends APIResource {
  /**
   * List Files
   *
   * @throws {ClaudeCodeKeyCreatorNotMemberError} The API key belongs to the Claude Code workspace, and the user who created it is
   * no longer a member of the organization or of that workspace.
   * @throws {CMEKKeyDisabledError} The workspace's customer-managed encryption key is disabled or revoked.
   * Re-enable the key, then retry.
   * @throws {CMEKKeyNetworkBlockedError} The key management service's network access controls blocked the request to the
   * workspace's customer-managed encryption key. The key itself may be healthy.
   * @throws {OrganizationOnHoldError} Anthropic has disabled the organization for trust and safety reasons. An
   * organization disabled for any other reason, such as billing, does not get this
   * code. `appeal_url`, when present, is where the organization can appeal.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaFileMetadata of client.beta.files.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: FileListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaFileMetadataPageCursor, BetaFileMetadata> {
    const { betas, workspace_id, ...query } = params ?? {};
    return this._client.getAPIList('/v1/files', PageCursor<BetaFileMetadata>, {
      query,
      ...options,
      headers: buildHeaders([
        {
          ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.files.list', options, {
        route: '/v1/files',
        queryParams: ['ids', 'limit', 'page', 'scope_id'],
      }),
    });
  }

  /**
   * Delete File
   *
   * @throws {ClaudeCodeKeyCreatorNotMemberError} The API key belongs to the Claude Code workspace, and the user who created it is
   * no longer a member of the organization or of that workspace.
   * @throws {CMEKKeyDisabledError} The workspace's customer-managed encryption key is disabled or revoked.
   * Re-enable the key, then retry.
   * @throws {CMEKKeyNetworkBlockedError} The key management service's network access controls blocked the request to the
   * workspace's customer-managed encryption key. The key itself may be healthy.
   * @throws {OrganizationOnHoldError} Anthropic has disabled the organization for trust and safety reasons. An
   * organization disabled for any other reason, such as billing, does not get this
   * code. `appeal_url`, when present, is where the organization can appeal.
   *
   * @example
   * ```ts
   * const betaDeletedFile = await client.beta.files.delete(
   *   'file_id',
   * );
   * ```
   */
  delete(
    fileID: string,
    params: FileDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaDeletedFile> {
    const { betas, workspace_id } = params ?? {};
    return this._client.delete(path`/v1/files/${fileID}`, {
      ...options,
      headers: buildHeaders([
        {
          ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.files.delete', options, {
        route: '/v1/files/{file_id}',
        attributes: { 'anthropic.file.id': fileID },
      }),
    });
  }

  /**
   * Download File
   *
   * @throws {ClaudeCodeKeyCreatorNotMemberError} The API key belongs to the Claude Code workspace, and the user who created it is
   * no longer a member of the organization or of that workspace.
   * @throws {CMEKKeyDisabledError} The workspace's customer-managed encryption key is disabled or revoked.
   * Re-enable the key, then retry.
   * @throws {CMEKKeyNetworkBlockedError} The key management service's network access controls blocked the request to the
   * workspace's customer-managed encryption key. The key itself may be healthy.
   * @throws {FileNotDownloadableError} The file has `downloadable: false`. Only files generated by a tool, such as the
   * code execution tool, can be downloaded.
   * @throws {OrganizationOnHoldError} Anthropic has disabled the organization for trust and safety reasons. An
   * organization disabled for any other reason, such as billing, does not get this
   * code. `appeal_url`, when present, is where the organization can appeal.
   * @throws {FileExpiredError} The file's `expires_at` has passed, so its content is no longer available.
   *
   * @example
   * ```ts
   * const response = await client.beta.files.download(
   *   'file_id',
   * );
   *
   * const content = await response.blob();
   * console.log(content);
   * ```
   */
  download(
    fileID: string,
    params: FileDownloadParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Response> {
    const { betas, workspace_id } = params ?? {};
    return this._client.get(path`/v1/files/${fileID}/content`, {
      ...options,
      headers: buildHeaders([
        {
          Accept: 'application/binary',
          ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __binaryResponse: true,
      __span: startApiCallSpan(this._client, 'anthropic.files.download', options, {
        route: '/v1/files/{file_id}/content',
        attributes: { 'anthropic.file.id': fileID },
      }),
    });
  }

  /**
   * Get File Metadata
   *
   * @throws {ClaudeCodeKeyCreatorNotMemberError} The API key belongs to the Claude Code workspace, and the user who created it is
   * no longer a member of the organization or of that workspace.
   * @throws {CMEKKeyDisabledError} The workspace's customer-managed encryption key is disabled or revoked.
   * Re-enable the key, then retry.
   * @throws {CMEKKeyNetworkBlockedError} The key management service's network access controls blocked the request to the
   * workspace's customer-managed encryption key. The key itself may be healthy.
   * @throws {OrganizationOnHoldError} Anthropic has disabled the organization for trust and safety reasons. An
   * organization disabled for any other reason, such as billing, does not get this
   * code. `appeal_url`, when present, is where the organization can appeal.
   *
   * @example
   * ```ts
   * const betaFileMetadata =
   *   await client.beta.files.retrieveMetadata('file_id');
   * ```
   */
  retrieveMetadata(
    fileID: string,
    params: FileRetrieveMetadataParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaFileMetadata> {
    const { betas, workspace_id } = params ?? {};
    return this._client.get(path`/v1/files/${fileID}`, {
      ...options,
      headers: buildHeaders([
        {
          ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined),
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.files.retrieve_metadata', options, {
        route: '/v1/files/{file_id}',
        attributes: { 'anthropic.file.id': fileID },
      }),
    });
  }

  /**
   * Upload File
   *
   * @throws {ClaudeCodeKeyCreatorNotMemberError} The API key belongs to the Claude Code workspace, and the user who created it is
   * no longer a member of the organization or of that workspace.
   * @throws {CMEKKeyDisabledError} The workspace's customer-managed encryption key is disabled or revoked.
   * Re-enable the key, then retry.
   * @throws {CMEKKeyNetworkBlockedError} The key management service's network access controls blocked the request to the
   * workspace's customer-managed encryption key. The key itself may be healthy.
   * @throws {OrganizationOnHoldError} Anthropic has disabled the organization for trust and safety reasons. An
   * organization disabled for any other reason, such as billing, does not get this
   * code. `appeal_url`, when present, is where the organization can appeal.
   * @throws {StorageQuotaExceededError} The organization's file storage quota is exhausted. Delete files to free up
   * space, then retry the upload.
   *
   * @example
   * ```ts
   * const betaFileMetadata = await client.beta.files.upload({
   *   file: fs.createReadStream('path/to/file'),
   * });
   * ```
   */
  upload(params: FileUploadParams, options?: RequestOptions): APIPromise<BetaFileMetadata> {
    const { betas, workspace_id, ...body } = params;
    return this._client.post(
      '/v1/files',
      multipartFormRequestOptions(
        {
          body,
          ...options,
          headers: buildHeaders([
            {
              ...(betas?.toString() != null ? { 'anthropic-beta': betas?.toString() } : undefined),
              ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
            },
            stainlessHelperHeaderFromFile(body.file),
            options?.headers,
          ]),
          __qualifiers: { beta: 'true' },
          __span: startApiCallSpan(this._client, 'anthropic.files.upload', options, {
            route: '/v1/files',
            createdIDAttribute: 'anthropic.file.id',
          }),
        },
        this._client,
      ),
    );
  }
}

export type BetaFileMetadataPageCursor = PageCursor<BetaFileMetadata>;

export interface BetaDeletedFile {
  /**
   * ID of the deleted file.
   */
  id: string;

  /**
   * Deleted object type.
   *
   * For file deletion, this is always `"file_deleted"`.
   */
  type?: 'file_deleted';
}

export interface BetaFileMetadata {
  /**
   * Unique object identifier.
   *
   * The format and length of IDs may change over time.
   */
  id: string;

  /**
   * RFC 3339 datetime string representing when the file was created.
   */
  created_at: string;

  /**
   * Original filename of the uploaded file.
   */
  filename: string;

  /**
   * MIME type of the file.
   */
  mime_type: string;

  /**
   * Size of the file in bytes.
   */
  size_bytes: number;

  /**
   * Object type.
   *
   * For files, this is always `"file"`.
   */
  type: 'file';

  /**
   * Whether the file can be downloaded.
   */
  downloadable?: boolean;

  /**
   * RFC 3339 datetime string representing when the file will expire and become
   * unavailable for download. Null if the file does not expire. For files uploaded
   * with `expires_in_seconds`, this is the upload time plus that value.
   */
  expires_at?: string | null;

  /**
   * The scope of this file, indicating the context in which it was created (e.g., a
   * session).
   */
  scope?: BetaFileScope | null;
}

export interface BetaFileScope {
  /**
   * The ID of the scoping resource (e.g., the session ID).
   */
  id: string;

  /**
   * The type of scope (e.g., `"session"`).
   */
  type: 'session';
}

export interface FileListParams extends PageCursorParams {
  /**
   * Query param: Restrict the result set to Files whose `id` is in this list. At
   * most 100 entries (after de-duplication). Mutually exclusive with `page` and
   * `limit`. When supplied, the response is always a single page (`next_page` is
   * null). IDs that do not resolve to a visible File — including deleted Files — are
   * silently omitted.
   */
  ids?: Array<string> | null;

  /**
   * Query param: Filter by scope ID. Only returns files associated with the
   * specified scope (e.g., a session ID).
   */
  scope_id?: string;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
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

export interface FileDeleteParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
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

export interface FileDownloadParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
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

export interface FileRetrieveMetadataParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
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

export interface FileUploadParams {
  /**
   * Body param: The file to upload. Only the final path component of the part's
   * `filename` is kept; an absent or empty `filename` is replaced with `unnamed`
   * plus the extension for the file's stored `mime_type`, when known.
   */
  file: Uploadable;

  /**
   * Body param: Seconds from upload until the file expires and its bytes become
   * permanently unavailable. Must be between 3600 (one hour) and 7776000 (ninety
   * days).
   */
  expires_in_seconds?: number;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
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

export declare namespace Files {
  export {
    type BetaDeletedFile as BetaDeletedFile,
    type BetaFileMetadata as BetaFileMetadata,
    type BetaFileScope as BetaFileScope,
    type BetaFileMetadataPageCursor as BetaFileMetadataPageCursor,
    type FileListParams as FileListParams,
    type FileDeleteParams as FileDeleteParams,
    type FileDownloadParams as FileDownloadParams,
    type FileRetrieveMetadataParams as FileRetrieveMetadataParams,
    type FileUploadParams as FileUploadParams,
  };
}
