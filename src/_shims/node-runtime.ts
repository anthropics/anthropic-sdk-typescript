/**
 * Disclaimer: modules in _shims aren't intended to be imported by SDK users.
 */
import * as nf from 'node-fetch';
import * as fd from 'formdata-node';
import KeepAliveAgent from 'agentkeepalive';
import { AbortController as AbortControllerPolyfill } from 'abort-controller';
import { ReadStream as FsReadStream } from 'node:fs';
import { type Agent } from 'node:http';
import { FormDataEncoder } from 'form-data-encoder';
import { Readable } from 'node:stream';
import { type RequestOptions } from '../core';
import { MultipartBody } from './MultipartBody';
import { type Shims } from './registry';

// @ts-ignore (this package does not have proper export maps for this export)
import { ReadableStream } from 'web-streams-polyfill/dist/ponyfill.es2018.js';

const defaultHttpAgent: Agent = new KeepAliveAgent({ keepAlive: true, timeout: 5 * 60 * 1000 });
const defaultHttpsAgent: Agent = new KeepAliveAgent.HttpsAgent({ keepAlive: true, timeout: 5 * 60 * 1000 });

async function getMultipartRequestOptions<T = Record<string, unknown>>(
  form: fd.FormData,
  opts: RequestOptions<T>,
): Promise<RequestOptions<T>> {
  const encoder = new FormDataEncoder(form);
  const readable = Readable.from(encoder);
  const body = new MultipartBody(readable);
  const headers = {
    ...opts.headers,
    ...encoder.headers,
    'Content-Length': encoder.contentLength,
  };

  return { ...opts, body: body as any, headers };
}

export function getRuntime(): Shims {
  // Polyfill global object if needed.
  if (typeof AbortController === 'undefined') {
    // @ts-expect-error (the types are subtly different, but compatible in practice)
    globalThis.AbortController = AbortControllerPolyfill;
  }
  return {
    kind: 'node',
    fetch: nf.default,
    Request: nf.Request,
    Response: nf.Response,
    Headers: nf.Headers,
    FormData: fd.FormData,
    Blob: fd.Blob,
    File: fd.File,
    ReadableStream,
    getMultipartRequestOptions,
    getDefaultAgent: (url: string): Agent => (url.startsWith('https') ? defaultHttpsAgent : defaultHttpAgent),
    isFsReadStream: (value: any): value is FsReadStream => value instanceof FsReadStream,
  };
}
