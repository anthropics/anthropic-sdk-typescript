// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as BetaAPI from './beta';
import { APIPromise } from '../../core/api-promise';
import { Page, type PageParams, PagePromise } from '../../core/pagination';
import { type Uploadable } from '../../core/uploads';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';

export class Files extends APIResource {
  /**
   * List Files
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fileMetadata of client.beta.files.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: FileListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<FileMetadataPage, FileMetadata> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/files', Page<FileMetadata>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'files-api-2025-04-14'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete File
   *
   * @example
   * ```ts
   * const deletedFile = await client.beta.files.delete(
   *   'file_id',
   * );
   * ```
   */
  delete(
    fileID: string,
    params: FileDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<DeletedFile> {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/files/${fileID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'files-api-2025-04-14'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Download File
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
    const { betas } = params ?? {};
    return this._client.get(path`/v1/files/${fileID}/content`, {
      ...options,
      headers: buildHeaders([
        {
          'anthropic-beta': [...(betas ?? []), 'files-api-2025-04-14'].toString(),
          Accept: 'application/binary',
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
   * const fileMetadata =
   *   await client.beta.files.retrieveMetadata('file_id');
   * ```
   */
  retrieveMetadata(
    fileID: string,
    params: FileRetrieveMetadataParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FileMetadata> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/files/${fileID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'files-api-2025-04-14'].toString() },
        options?.headers,
      ]),
    });
  }

  /**
   * Upload File
   *
   * @example
   * ```ts
   * const fileMetadata = await client.beta.files.upload({
   *   file: fs.createReadStream('path/to/file'),
   * });
   * ```
   */
  upload(params: FileUploadParams, options?: RequestOptions): APIPromise<FileMetadata> {
    const { betas, ...body } = params;
    return this._client.post(
      '/v1/files',
      multipartFormRequestOptions(
        {
          body,
          ...options,
          headers: buildHeaders([
            { 'anthropic-beta': [...(betas ?? []), 'files-api-2025-04-14'].toString() },
            options?.headers,
          ]),
        },
        this._client,
      ),
    );
  }
}

export type FileMetadataPage = Page<FileMetadata>;

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
}

export interface FileListParams extends PageParams {
  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface FileDeleteParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface FileDownloadParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface FileRetrieveMetadataParams {
  /**
   * Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface FileUploadParams {
  /**
   * Body param: The file to upload
   */
  file: Uploadable;

  /**
   * Header param: Optional header to specify the beta version(s) you want to use.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Files {
  export {
    type DeletedFile as DeletedFile,
    type FileMetadata as FileMetadata,
    type FileMetadataPage as FileMetadataPage,
    type FileListParams as FileListParams,
    type FileDeleteParams as FileDeleteParams,
    type FileDownloadParams as FileDownloadParams,
    type FileRetrieveMetadataParams as FileRetrieveMetadataParams,
    type FileUploadParams as FileUploadParams,
  };
}
