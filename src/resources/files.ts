// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../core/pagination';
import { type Uploadable } from '../core/uploads';
import { buildHeaders } from '../internal/headers';
import { RequestOptions } from '../internal/request-options';
import { multipartFormRequestOptions } from '../internal/uploads';
import { path } from '../internal/utils/path';

export class Files extends APIResource {
  /**
   * List Files
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fileMetadata of client.files.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: FileListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<FileMetadataPageCursor, FileMetadata> {
    const { workspace_id, ...query } = params ?? {};
    return this._client.getAPIList('/v1/files', PageCursor<FileMetadata>, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete File
   *
   * @example
   * ```ts
   * const deletedFile = await client.files.delete('file_id');
   * ```
   */
  delete(
    fileID: string,
    params: FileDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<DeletedFile> {
    const { workspace_id } = params ?? {};
    return this._client.delete(path`/v1/files/${fileID}`, {
      ...options,
      headers: buildHeaders([
        { ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Download File
   *
   * @example
   * ```ts
   * const response = await client.files.download('file_id');
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
    const { workspace_id } = params ?? {};
    return this._client.get(path`/v1/files/${fileID}/content`, {
      ...options,
      headers: buildHeaders([
        {
          Accept: 'application/binary',
          ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined),
        },
        options?.headers,
      ]),
      __binaryResponse: true,
    });
  }

  /**
   * Get File Metadata
   *
   * @example
   * ```ts
   * const fileMetadata = await client.files.retrieveMetadata(
   *   'file_id',
   * );
   * ```
   */
  retrieveMetadata(
    fileID: string,
    params: FileRetrieveMetadataParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FileMetadata> {
    const { workspace_id } = params ?? {};
    return this._client.get(path`/v1/files/${fileID}`, {
      ...options,
      headers: buildHeaders([
        { ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Upload File
   *
   * @example
   * ```ts
   * const fileMetadata = await client.files.upload({
   *   file: fs.createReadStream('path/to/file'),
   * });
   * ```
   */
  upload(params: FileUploadParams, options?: RequestOptions): APIPromise<FileMetadata> {
    const { workspace_id, ...body } = params;
    return this._client.post(
      '/v1/files',
      multipartFormRequestOptions(
        {
          body,
          ...options,
          headers: buildHeaders([
            { ...(workspace_id != null ? { 'anthropic-workspace-id': workspace_id } : undefined) },
            options?.headers,
          ]),
        },
        this._client,
      ),
    );
  }
}

export type FileMetadataPageCursor = PageCursor<FileMetadata>;

export interface DeletedFile {
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

export interface FileMetadata {
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
   * Body param: The file to upload
   */
  file: Uploadable;

  /**
   * Body param: Seconds from upload until the file expires and its bytes become
   * permanently unavailable. Must be between 3600 (one hour) and 7776000 (ninety
   * days).
   */
  expires_in_seconds?: number;

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
    type DeletedFile as DeletedFile,
    type FileMetadata as FileMetadata,
    type FileMetadataPageCursor as FileMetadataPageCursor,
    type FileListParams as FileListParams,
    type FileDeleteParams as FileDeleteParams,
    type FileDownloadParams as FileDownloadParams,
    type FileRetrieveMetadataParams as FileRetrieveMetadataParams,
    type FileUploadParams as FileUploadParams,
  };
}
