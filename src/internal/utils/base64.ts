// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { AnthropicError } from '../../core/error';
import { encodeUTF8 } from './bytes';

export const toBase64 = (data: string | Uint8Array | null | undefined): string => {
  if (!data) return '';

  if (typeof (globalThis as any).Buffer !== 'undefined') {
    return (globalThis as any).Buffer.from(data).toString('base64');
  }

  if (typeof data === 'string') {
    data = encodeUTF8(data);
  }

  if (typeof btoa !== 'undefined') {
    // Process in chunks to avoid a RangeError ("Maximum call stack size exceeded")
    // when spreading large Uint8Arrays as arguments to String.fromCharCode.apply().
    const CHUNK_SIZE = 8192;
    let binary = '';
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      binary += String.fromCharCode.apply(null, data.subarray(i, i + CHUNK_SIZE) as any);
    }
    return btoa(binary);
  }

  throw new AnthropicError('Cannot generate base64 string; Expected `Buffer` or `btoa` to be defined');
};

export const fromBase64 = (str: string): Uint8Array => {
  if (typeof (globalThis as any).Buffer !== 'undefined') {
    const buf = (globalThis as any).Buffer.from(str, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  if (typeof atob !== 'undefined') {
    const bstr = atob(str);
    const buf = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) {
      buf[i] = bstr.charCodeAt(i);
    }
    return buf;
  }

  throw new AnthropicError('Cannot decode base64 string; Expected `Buffer` or `atob` to be defined');
};
