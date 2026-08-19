// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { PageCursor, type PageCursorParams, PagePromise } from '../core/pagination';
import { type Uploadable } from '../core/uploads';
import { buildHeaders } from '../internal/headers';
import { RequestOptions } from '../internal/request-options';
import { stainlessHelperHeaderFromFile } from '../internal/stainless-helper-header';
import { multipartFormRequestOptions } from '../internal/uploads';
import { path } from '../internal/utils/path';

export class Files extends APIResource {
  /**
   * List Files
   */
  list(
    query: FileListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<FileMetadataPageCursor, FileMetadata> {
    return this._client.getAPIList('/v1/files', PageCursor<FileMetadata>, { query, ...options });
  }

  /**
   * Delete File
   */
  delete(fileID: string, options?: RequestOptions): APIPromise<DeletedFile> {
    return this._client.delete(path`/v1/files/${fileID}`, options);
  }

  /**
   * Download File
   */
  download(fileID: string, options?: RequestOptions): APIPromise<Response> {
    return this._client.get(path`/v1/files/${fileID}/content`, {
      ...options,
      headers: buildHeaders([{ Accept: 'application/binary' }, options?.headers]),
      __binaryResponse: true,
    });
  }

  /**
   * Get File Metadata
   */
  retrieveMetadata(fileID: string, options?: RequestOptions): APIPromise<FileMetadata> {
    return this._client.get(path`/v1/files/${fileID}`, options);
  }

  /**
   * Upload File
   */
  upload(body: FileUploadParams, options?: RequestOptions): APIPromise<FileMetadata> {
    return this._client.post(
      '/v1/files',
      multipartFormRequestOptions(
        {
          body,
          ...options,
          headers: buildHeaders([stainlessHelperHeaderFromFile(body.file), options?.headers]),
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
   * Restrict the result set to Files whose `id` is in this list. At most 100 entries
   * (after de-duplication). Mutually exclusive with `page` and `limit`. When
   * supplied, the response is always a single page (`next_page` is null). IDs that
   * do not resolve to a visible File — including deleted Files — are silently
   * omitted.
   */
  ids?: Array<string> | null;
}

export interface FileUploadParams {
  /**
   * The file to upload
   */
  file: Uploadable;

  /**
   * Seconds from upload until the file expires and its bytes become permanently
   * unavailable. Must be between 3600 (one hour) and 7776000 (ninety days).
   */
  expires_in_seconds?: number;
}

export declare namespace Files {
  export {
    type DeletedFile as DeletedFile,
    type FileMetadata as FileMetadata,
    type FileMetadataPageCursor as FileMetadataPageCursor,
    type FileListParams as FileListParams,
    type FileUploadParams as FileUploadParams,
  };
}
