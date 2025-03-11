import { type RequestOptions } from './request-options';
import { type FilePropertyBag } from './builtin-types';
import { isFsReadStreamLike, type FsReadStreamLike } from './shims';
import './polyfill/file.node.js';

type BlobLikePart = string | ArrayBuffer | ArrayBufferView | BlobLike | DataView;
type BlobPart = string | ArrayBuffer | ArrayBufferView | Blob | DataView;

/**
 * Typically, this is a native "File" class.
 *
 * We provide the {@link toFile} utility to convert a variety of objects
 * into the File class.
 *
 * For convenience, you can also pass a fetch Response, or in Node,
 * the result of fs.createReadStream().
 */
export type Uploadable = FileLike | ResponseLike | FsReadStreamLike;

/**
 * Intended to match DOM Blob, node-fetch Blob, node:buffer Blob, etc.
 * Don't add arrayBuffer here, node-fetch doesn't have it
 */
interface BlobLike {
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/size) */
  readonly size: number;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/type) */
  readonly type: string;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/text) */
  text(): Promise<string>;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/slice) */
  slice(start?: number, end?: number): BlobLike;
}

/**
 * This check adds the arrayBuffer() method type because it is available and used at runtime
 */
const isBlobLike = (value: any): value is BlobLike & { arrayBuffer(): Promise<ArrayBuffer> } =>
  value != null &&
  typeof value === 'object' &&
  typeof value.size === 'number' &&
  typeof value.type === 'string' &&
  typeof value.text === 'function' &&
  typeof value.slice === 'function' &&
  typeof value.arrayBuffer === 'function';

/**
 * Intended to match DOM File, node:buffer File, undici File, etc.
 */
interface FileLike extends BlobLike {
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/lastModified) */
  readonly lastModified: number;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/name) */
  readonly name: string;
}
declare var FileClass: {
  prototype: FileLike;
  new (fileBits: BlobPart[], fileName: string, options?: FilePropertyBag): FileLike;
};

/**
 * This check adds the arrayBuffer() method type because it is available and used at runtime
 */
const isFileLike = (value: any): value is FileLike & { arrayBuffer(): Promise<ArrayBuffer> } =>
  value != null &&
  typeof value === 'object' &&
  typeof value.name === 'string' &&
  typeof value.lastModified === 'number' &&
  isBlobLike(value);

/**
 * Intended to match DOM Response, node-fetch Response, undici Response, etc.
 */
export interface ResponseLike {
  url: string;
  blob(): Promise<BlobLike>;
}

const isResponseLike = (value: any): value is ResponseLike =>
  value != null &&
  typeof value === 'object' &&
  typeof value.url === 'string' &&
  typeof value.blob === 'function';

const isUploadable = (value: any): value is Uploadable => {
  return isFileLike(value) || isResponseLike(value) || isFsReadStreamLike(value);
};

type ToFileInput = Uploadable | Exclude<BlobLikePart, string> | AsyncIterable<BlobLikePart>;

/**
 * Construct a `File` instance. This is used to ensure a helpful error is thrown
 * for environments that don't define a global `File` yet and so that we don't
 * accidentally rely on a global `File` type in our annotations.
 */
function makeFile(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag): FileLike {
  const File = (globalThis as any).File as typeof FileClass | undefined;
  if (typeof File === 'undefined') {
    throw new Error('`File` is not defined as a global which is required for file uploads');
  }

  return new File(fileBits, fileName, options);
}

/**
 * Helper for creating a {@link File} to pass to an SDK upload method from a variety of different data formats
 * @param value the raw content of the file.  Can be an {@link Uploadable}, {@link BlobLikePart}, or {@link AsyncIterable} of {@link BlobLikePart}s
 * @param {string=} name the name of the file. If omitted, toFile will try to determine a file name from bits if possible
 * @param {Object=} options additional properties
 * @param {string=} options.type the MIME type of the content
 * @param {number=} options.lastModified the last modified timestamp
 * @returns a {@link File} with the given properties
 */
export async function toFile(
  value: ToFileInput | PromiseLike<ToFileInput>,
  name?: string | null | undefined,
  options?: FilePropertyBag | undefined,
): Promise<FileLike> {
  // If it's a promise, resolve it.
  value = await value;

  // If we've been given a `File` we don't need to do anything
  if (isFileLike(value)) {
    const File = (globalThis as any).File as typeof FileClass | undefined;
    if (File && value instanceof File) {
      return value;
    }
    return makeFile([await value.arrayBuffer()], value.name);
  }

  if (isResponseLike(value)) {
    const blob = await value.blob();
    name ||= new URL(value.url).pathname.split(/[\\/]/).pop() ?? 'unknown_file';

    return makeFile(await getBytes(blob), name, options);
  }

  const parts = await getBytes(value);

  name ||= getName(value) ?? 'unknown_file';

  if (!options?.type) {
    const type = parts.find((part) => typeof part === 'object' && 'type' in part && part.type);
    if (typeof type === 'string') {
      options = { ...options, type };
    }
  }

  return makeFile(parts, name, options);
}

export async function getBytes(
  value: Uploadable | BlobLikePart | AsyncIterable<BlobLikePart>,
): Promise<Array<BlobPart>> {
  let parts: Array<BlobPart> = [];
  if (
    typeof value === 'string' ||
    ArrayBuffer.isView(value) || // includes Uint8Array, Buffer, etc.
    value instanceof ArrayBuffer
  ) {
    parts.push(value);
  } else if (isBlobLike(value)) {
    parts.push(value instanceof Blob ? value : await value.arrayBuffer());
  } else if (
    isAsyncIterableIterator(value) // includes Readable, ReadableStream, etc.
  ) {
    for await (const chunk of value) {
      parts.push(...(await getBytes(chunk as BlobLikePart))); // TODO, consider validating?
    }
  } else {
    const constructor = value?.constructor?.name;
    throw new Error(
      `Unexpected data type: ${typeof value}${
        constructor ? `; constructor: ${constructor}` : ''
      }${propsForError(value)}`,
    );
  }

  return parts;
}

function propsForError(value: unknown): string {
  if (typeof value !== 'object' || value === null) return '';
  const props = Object.getOwnPropertyNames(value);
  return `; props: [${props.map((p) => `"${p}"`).join(', ')}]`;
}

function getName(value: unknown): string | undefined {
  return (
    (typeof value === 'object' &&
      value !== null &&
      (('name' in value && String(value.name)) ||
        ('filename' in value && String(value.filename)) ||
        ('path' in value && String(value.path).split(/[\\/]/).pop()))) ||
    undefined
  );
}

const isAsyncIterableIterator = (value: any): value is AsyncIterableIterator<unknown> =>
  value != null && typeof value === 'object' && typeof value[Symbol.asyncIterator] === 'function';

/**
 * Returns a multipart/form-data request if any part of the given request body contains a File / Blob value.
 * Otherwise returns the request as is.
 */
export const maybeMultipartFormRequestOptions = async (opts: RequestOptions): Promise<RequestOptions> => {
  if (!hasUploadableValue(opts.body)) return opts;

  return { ...opts, body: await createForm(opts.body) };
};

type MultipartFormRequestOptions = Omit<RequestOptions, 'body'> & { body: unknown };

export const multipartFormRequestOptions = async (
  opts: MultipartFormRequestOptions,
): Promise<RequestOptions> => {
  return { ...opts, body: await createForm(opts.body) };
};

export const createForm = async <T = Record<string, unknown>>(body: T | undefined): Promise<FormData> => {
  const form = new FormData();
  await Promise.all(Object.entries(body || {}).map(([key, value]) => addFormValue(form, key, value)));
  return form;
};

const hasUploadableValue = (value: unknown): boolean => {
  if (isUploadable(value)) return true;
  if (Array.isArray(value)) return value.some(hasUploadableValue);
  if (value && typeof value === 'object') {
    for (const k in value) {
      if (hasUploadableValue((value as any)[k])) return true;
    }
  }
  return false;
};

const addFormValue = async (form: FormData, key: string, value: unknown): Promise<void> => {
  if (value === undefined) return;
  if (value == null) {
    throw new TypeError(
      `Received null for "${key}"; to pass null in FormData, you must use the string 'null'`,
    );
  }

  // TODO: make nested formats configurable
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    form.append(key, String(value));
  } else if (isUploadable(value)) {
    const file = await toFile(value);
    form.append(key, file as any);
  } else if (Array.isArray(value)) {
    await Promise.all(value.map((entry) => addFormValue(form, key + '[]', entry)));
  } else if (typeof value === 'object') {
    await Promise.all(
      Object.entries(value).map(([name, prop]) => addFormValue(form, `${key}[${name}]`, prop)),
    );
  } else {
    throw new TypeError(
      `Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`,
    );
  }
};
