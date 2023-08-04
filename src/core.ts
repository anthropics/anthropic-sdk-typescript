import { VERSION } from './version';
import { Stream } from './streaming';
import { APIError, APIConnectionError, APIConnectionTimeoutError, APIUserAbortError } from './error';
import type { Readable } from '@anthropic-ai/sdk/_shims/node-readable';
import { getDefaultAgent, type Agent } from '@anthropic-ai/sdk/_shims/agent';
import {
  fetch,
  isPolyfilled as fetchIsPolyfilled,
  type RequestInfo,
  type RequestInit,
  type Response,
} from '@anthropic-ai/sdk/_shims/fetch';
import { isMultipartBody } from './uploads';
export {
  maybeMultipartFormRequestOptions,
  multipartFormRequestOptions,
  createForm,
  type Uploadable,
} from './uploads';

const MAX_RETRIES = 2;

export type Fetch = (url: RequestInfo, init?: RequestInit) => Promise<Response>;

export abstract class APIClient {
  baseURL: string;
  maxRetries: number;
  timeout: number;
  httpAgent: Agent | undefined;

  private fetch: Fetch;
  protected idempotencyHeader?: string;

  constructor({
    baseURL,
    maxRetries,
    timeout = 60 * 1000, // 60s
    httpAgent,
    fetch: overridenFetch,
  }: {
    baseURL: string;
    maxRetries?: number | undefined;
    timeout: number | undefined;
    httpAgent: Agent | undefined;
    fetch: Fetch | undefined;
  }) {
    this.baseURL = baseURL;
    this.maxRetries = validatePositiveInteger('maxRetries', maxRetries ?? MAX_RETRIES);
    this.timeout = validatePositiveInteger('timeout', timeout);
    this.httpAgent = httpAgent;

    this.fetch = overridenFetch ?? fetch;
  }

  protected authHeaders(): Headers {
    return {};
  }

  /**
   * Override this to add your own default headers, for example:
   *
   *  {
   *    ...super.defaultHeaders(),
   *    Authorization: 'Bearer 123',
   *  }
   */
  protected defaultHeaders(): Headers {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': this.getUserAgent(),
      ...getPlatformHeaders(),
      ...this.authHeaders(),
    };
  }

  protected abstract defaultQuery(): DefaultQuery | undefined;

  /**
   * Override this to add your own headers validation:
   */
  protected validateHeaders(headers: Headers, customHeaders: Headers) {}

  protected defaultIdempotencyKey(): string {
    return `stainless-node-retry-${uuid4()}`;
  }

  get<Req extends {}, Rsp>(path: string, opts?: RequestOptions<Req>): Promise<Rsp> {
    return this.request({ method: 'get', path, ...opts });
  }
  post<Req extends {}, Rsp>(path: string, opts?: RequestOptions<Req>): Promise<Rsp> {
    return this.request({ method: 'post', path, ...opts });
  }
  patch<Req extends {}, Rsp>(path: string, opts?: RequestOptions<Req>): Promise<Rsp> {
    return this.request({ method: 'patch', path, ...opts });
  }
  put<Req extends {}, Rsp>(path: string, opts?: RequestOptions<Req>): Promise<Rsp> {
    return this.request({ method: 'put', path, ...opts });
  }
  delete<Req extends {}, Rsp>(path: string, opts?: RequestOptions<Req>): Promise<Rsp> {
    return this.request({ method: 'delete', path, ...opts });
  }

  getAPIList<Item, PageClass extends AbstractPage<Item> = AbstractPage<Item>>(
    path: string,
    Page: new (...args: any[]) => PageClass,
    opts?: RequestOptions<any>,
  ): PagePromise<PageClass> {
    return this.requestAPIList(Page, { method: 'get', path, ...opts });
  }

  private calculateContentLength(body: unknown): string | null {
    if (typeof body === 'string') {
      if (typeof Buffer !== 'undefined') {
        return Buffer.byteLength(body, 'utf8').toString();
      }

      if (typeof TextEncoder !== 'undefined') {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(body);
        return encoded.length.toString();
      }
    }

    return null;
  }

  buildRequest<Req extends {}>(
    options: FinalRequestOptions<Req>,
  ): { req: RequestInit; url: string; timeout: number } {
    const { method, path, query, headers: headers = {} } = options;

    const body =
      isMultipartBody(options.body) ? options.body.body
      : options.body ? JSON.stringify(options.body, null, 2)
      : null;
    const contentLength = this.calculateContentLength(body);

    const url = this.buildURL(path!, query);
    if ('timeout' in options) validatePositiveInteger('timeout', options.timeout);
    const timeout = options.timeout ?? this.timeout;
    const httpAgent = options.httpAgent ?? this.httpAgent ?? getDefaultAgent(url);
    const minAgentTimeout = timeout + 1000;
    if ((httpAgent as any)?.options && minAgentTimeout > ((httpAgent as any).options.timeout ?? 0)) {
      // Allow any given request to bump our agent active socket timeout.
      // This may seem strange, but leaking active sockets should be rare and not particularly problematic,
      // and without mutating agent we would need to create more of them.
      // This tradeoff optimizes for performance.
      (httpAgent as any).options.timeout = minAgentTimeout;
    }

    if (this.idempotencyHeader && method !== 'get') {
      if (!options.idempotencyKey) options.idempotencyKey = this.defaultIdempotencyKey();
      headers[this.idempotencyHeader] = options.idempotencyKey;
    }

    const reqHeaders: Record<string, string> = {
      ...(contentLength && { 'Content-Length': contentLength }),
      ...this.defaultHeaders(),
      ...headers,
    };
    // let builtin fetch set the Content-Type for multipart bodies
    if (isMultipartBody(options.body) && !fetchIsPolyfilled) {
      delete reqHeaders['Content-Type'];
    }

    // Strip any headers being explicitly omitted with null
    Object.keys(reqHeaders).forEach((key) => reqHeaders[key] === null && delete reqHeaders[key]);

    const req: RequestInit = {
      method,
      ...(body && { body: body as any }),
      headers: reqHeaders,
      ...(httpAgent && { agent: httpAgent }),
      // @ts-ignore node-fetch uses a custom AbortSignal type that is
      // not compatible with standard web types
      signal: options.signal ?? null,
    };

    this.validateHeaders(reqHeaders, headers);

    return { req, url, timeout };
  }

  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  protected async prepareRequest(request: RequestInit, { url }: { url: string }): Promise<void> {}

  protected makeStatusError(
    status: number | undefined,
    error: Object | undefined,
    message: string | undefined,
    headers: Headers | undefined,
  ) {
    return APIError.generate(status, error, message, headers);
  }

  async request<Req extends {}, Rsp>(
    options: FinalRequestOptions<Req>,
    retriesRemaining = options.maxRetries ?? this.maxRetries,
  ): Promise<APIResponse<Rsp>> {
    const { req, url, timeout } = this.buildRequest(options);
    await this.prepareRequest(req, { url });

    this.debug('request', url, options, req.headers);

    if (options.signal?.aborted) {
      throw new APIUserAbortError();
    }

    const controller = new AbortController();
    const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(castToError);

    if (response instanceof Error) {
      if (options.signal?.aborted) {
        throw new APIUserAbortError();
      }
      if (retriesRemaining) {
        return this.retryRequest(options, retriesRemaining);
      }
      if (response.name === 'AbortError') {
        throw new APIConnectionTimeoutError();
      }
      throw new APIConnectionError({ cause: response });
    }

    const responseHeaders = createResponseHeaders(response.headers);

    if (!response.ok) {
      if (retriesRemaining && this.shouldRetry(response)) {
        return this.retryRequest(options, retriesRemaining, responseHeaders);
      }

      const errText = await response.text().catch(() => 'Unknown');
      const errJSON = safeJSON(errText);
      const errMessage = errJSON ? undefined : errText;

      this.debug('response', response.status, url, responseHeaders, errMessage);

      const err = this.makeStatusError(response.status, errJSON, errMessage, responseHeaders);
      throw err;
    }

    if (options.stream) {
      // Note: there is an invariant here that isn't represented in the type system
      // that if you set `stream: true` the response type must also be `Stream<T>`
      return new Stream(response, controller) as any;
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const json = await response.json();

      if (typeof json === 'object' && json != null) {
        /** @deprecated – we expect to change this interface in the near future. */
        Object.defineProperty(json, 'responseHeaders', {
          enumerable: false,
          writable: false,
          value: responseHeaders,
        });
      }

      this.debug('response', response.status, url, responseHeaders, json);

      return json as APIResponse<Rsp>;
    }

    // TODO handle blob, arraybuffer, other content types, etc.
    const text = response.text();
    this.debug('response', response.status, url, responseHeaders, text);
    return text as Promise<any>;
  }

  requestAPIList<Item = unknown, PageClass extends AbstractPage<Item> = AbstractPage<Item>>(
    Page: new (...args: ConstructorParameters<typeof AbstractPage>) => PageClass,
    options: FinalRequestOptions,
  ): PagePromise<PageClass> {
    const requestPromise = this.request(options) as Promise<APIResponse<unknown>>;
    return new PagePromise(this, requestPromise, options, Page);
  }

  buildURL<Req>(path: string, query: Req | undefined): string {
    const url =
      isAbsoluteURL(path) ?
        new URL(path)
      : new URL(this.baseURL + (this.baseURL.endsWith('/') && path.startsWith('/') ? path.slice(1) : path));

    const defaultQuery = this.defaultQuery();
    if (!isEmptyObj(defaultQuery)) {
      query = { ...defaultQuery, ...query } as Req;
    }

    if (query) {
      url.search = this.stringifyQuery(query);
    }

    return url.toString();
  }

  protected stringifyQuery(query: Record<string, unknown>): string {
    return Object.entries(query)
      .filter(([_, value]) => typeof value !== 'undefined')
      .map(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }
        if (value === null) {
          return `${encodeURIComponent(key)}=`;
        }
        throw new Error(
          `Cannot stringify type ${typeof value}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`,
        );
      })
      .join('&');
  }

  async fetchWithTimeout(
    url: RequestInfo,
    init: RequestInit | undefined,
    ms: number,
    controller: AbortController,
  ): Promise<Response> {
    const { signal, ...options } = init || {};
    if (signal) signal.addEventListener('abort', () => controller.abort());

    const timeout = setTimeout(() => controller.abort(), ms);

    return this.getRequestClient()
      .fetch(url, { signal: controller.signal as any, ...options })
      .finally(() => {
        clearTimeout(timeout);
      });
  }

  protected getRequestClient(): RequestClient {
    return { fetch: this.fetch };
  }

  private shouldRetry(response: Response): boolean {
    // Note this is not a standard header.
    const shouldRetryHeader = response.headers.get('x-should-retry');

    // If the server explicitly says whether or not to retry, obey.
    if (shouldRetryHeader === 'true') return true;
    if (shouldRetryHeader === 'false') return false;

    // Retry on lock timeouts.
    if (response.status === 409) return true;

    // Retry on rate limits.
    if (response.status === 429) return true;

    // Retry internal errors.
    if (response.status >= 500) return true;

    return false;
  }

  private async retryRequest<Req extends {}, Rsp>(
    options: FinalRequestOptions<Req>,
    retriesRemaining: number,
    responseHeaders?: Headers | undefined,
  ): Promise<Rsp> {
    retriesRemaining -= 1;

    // About the Retry-After header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
    //
    // TODO: we may want to handle the case where the header is using the http-date syntax: "Retry-After: <http-date>".
    // See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After#syntax for details.
    const retryAfter = parseInt(responseHeaders?.['retry-after'] || '');

    const maxRetries = options.maxRetries ?? this.maxRetries;
    const timeout = this.calculateRetryTimeoutSeconds(retriesRemaining, retryAfter, maxRetries) * 1000;
    await sleep(timeout);

    return this.request(options, retriesRemaining);
  }

  private calculateRetryTimeoutSeconds(
    retriesRemaining: number,
    retryAfter: number,
    maxRetries: number,
  ): number {
    const initialRetryDelay = 0.5;
    const maxRetryDelay = 2;

    // If the API asks us to wait a certain amount of time (and it's a reasonable amount),
    // just do what it says.
    if (Number.isInteger(retryAfter) && retryAfter <= 60) {
      return retryAfter;
    }

    const numRetries = maxRetries - retriesRemaining;

    // Apply exponential backoff, but not more than the max.
    const sleepSeconds = Math.min(initialRetryDelay * Math.pow(numRetries - 1, 2), maxRetryDelay);

    // Apply some jitter, plus-or-minus half a second.
    const jitter = Math.random() - 0.5;

    return sleepSeconds + jitter;
  }

  private getUserAgent(): string {
    return `${this.constructor.name}/JS ${VERSION}`;
  }

  private debug(action: string, ...args: any[]) {
    if (typeof process !== 'undefined' && process.env['DEBUG'] === 'true') {
      console.log(`${this.constructor.name}:DEBUG:${action}`, ...args);
    }
  }
}

export class APIResource {
  protected client: APIClient;
  constructor(client: APIClient) {
    this.client = client;

    this.get = client.get.bind(client);
    this.post = client.post.bind(client);
    this.patch = client.patch.bind(client);
    this.put = client.put.bind(client);
    this.delete = client.delete.bind(client);
    this.getAPIList = client.getAPIList.bind(client);
  }

  protected get: APIClient['get'];
  protected post: APIClient['post'];
  protected patch: APIClient['patch'];
  protected put: APIClient['put'];
  protected delete: APIClient['delete'];
  protected getAPIList: APIClient['getAPIList'];
}

export type PageInfo = { url: URL } | { params: Record<string, unknown> | null };

export abstract class AbstractPage<Item> implements AsyncIterable<Item> {
  #client: APIClient;
  protected options: FinalRequestOptions;

  constructor(client: APIClient, response: APIResponse<unknown>, options: FinalRequestOptions) {
    this.#client = client;
    this.options = options;
  }

  /**
   * @deprecated Use nextPageInfo instead
   */
  abstract nextPageParams(): Partial<Record<string, unknown>> | null;
  abstract nextPageInfo(): PageInfo | null;

  abstract getPaginatedItems(): Item[];

  hasNextPage(): boolean {
    const items = this.getPaginatedItems();
    if (!items.length) return false;
    return this.nextPageInfo() != null;
  }

  async getNextPage(): Promise<AbstractPage<Item>> {
    const nextInfo = this.nextPageInfo();
    if (!nextInfo) {
      throw new Error(
        'No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.',
      );
    }
    const nextOptions = { ...this.options };
    if ('params' in nextInfo) {
      nextOptions.query = { ...nextOptions.query, ...nextInfo.params };
    } else if ('url' in nextInfo) {
      const params = [...Object.entries(nextOptions.query || {}), ...nextInfo.url.searchParams.entries()];
      for (const [key, value] of params) {
        nextInfo.url.searchParams.set(key, value);
      }
      nextOptions.query = undefined;
      nextOptions.path = nextInfo.url.toString();
    }
    return await this.#client.requestAPIList(this.constructor as any, nextOptions);
  }

  async *iterPages() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let page: AbstractPage<Item> = this;
    yield page;
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      yield page;
    }
  }

  async *[Symbol.asyncIterator]() {
    for await (const page of this.iterPages()) {
      for (const item of page.getPaginatedItems()) {
        yield item;
      }
    }
  }
}

export class PagePromise<
    PageClass extends AbstractPage<Item>,
    Item = ReturnType<PageClass['getPaginatedItems']>[number],
  >
  extends Promise<PageClass>
  implements AsyncIterable<Item>
{
  /**
   * This subclass of Promise will resolve to an instantiated Page once the request completes.
   */
  constructor(
    client: APIClient,
    requestPromise: Promise<APIResponse<unknown>>,
    options: FinalRequestOptions,
    Page: new (...args: ConstructorParameters<typeof AbstractPage>) => PageClass,
  ) {
    super((resolve, reject) =>
      requestPromise.then((response) => resolve(new Page(client, response, options))).catch(reject),
    );
  }

  /**
   * Enable subclassing Promise.
   * Ref: https://stackoverflow.com/a/60328122
   */
  static get [Symbol.species]() {
    return Promise;
  }

  /**
   * Allow auto-paginating iteration on an unawaited list call, eg:
   *
   *    for await (const item of client.items.list()) {
   *      console.log(item)
   *    }
   */
  async *[Symbol.asyncIterator]() {
    const page = await this;
    for await (const item of page) {
      yield item;
    }
  }
}

export const createResponseHeaders = (
  headers: Awaited<ReturnType<Fetch>>['headers'],
): Record<string, string> => {
  return new Proxy(
    Object.fromEntries(
      // @ts-ignore
      headers.entries(),
    ),
    {
      get(target, name) {
        const key = name.toString();
        return target[key.toLowerCase()] || target[key];
      },
    },
  );
};

type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type RequestClient = { fetch: Fetch };
export type Headers = Record<string, string | null | undefined>;
export type DefaultQuery = Record<string, string | undefined>;
export type KeysEnum<T> = { [P in keyof Required<T>]: true };

export type RequestOptions<Req extends {} = Record<string, unknown> | Readable> = {
  method?: HTTPMethod;
  path?: string;
  query?: Req | undefined;
  body?: Req | undefined;
  headers?: Headers | undefined;

  maxRetries?: number;
  stream?: boolean | undefined;
  timeout?: number;
  httpAgent?: Agent;
  signal?: AbortSignal | undefined | null;
  idempotencyKey?: string;
};

// This is required so that we can determine if a given object matches the RequestOptions
// type at runtime. While this requires duplication, it is enforced by the TypeScript
// compiler such that any missing / extraneous keys will cause an error.
const requestOptionsKeys: KeysEnum<RequestOptions> = {
  method: true,
  path: true,
  query: true,
  body: true,
  headers: true,

  maxRetries: true,
  stream: true,
  timeout: true,
  httpAgent: true,
  signal: true,
  idempotencyKey: true,
};

export const isRequestOptions = (obj: unknown): obj is RequestOptions => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !isEmptyObj(obj) &&
    Object.keys(obj).every((k) => hasOwn(requestOptionsKeys, k))
  );
};

export type FinalRequestOptions<Req extends {} = Record<string, unknown> | Readable> = RequestOptions<Req> & {
  method: HTTPMethod;
  path: string;
};

export type APIResponse<T> = T & {
  /** @deprecated - we plan to add a different way to access raw response information shortly. */
  responseHeaders: Headers;
};

declare const Deno: any;
declare const EdgeRuntime: any;
type Arch = 'x32' | 'x64' | 'arm' | 'arm64' | `other:${string}` | 'unknown';
type PlatformName =
  | 'MacOS'
  | 'Linux'
  | 'Windows'
  | 'FreeBSD'
  | 'OpenBSD'
  | 'iOS'
  | 'Android'
  | `Other:${string}`
  | 'Unknown';
type Browser = 'ie' | 'edge' | 'chrome' | 'firefox' | 'safari';
type PlatformProperties = {
  'X-Stainless-Lang': 'js';
  'X-Stainless-Package-Version': string;
  'X-Stainless-OS': PlatformName;
  'X-Stainless-Arch': Arch;
  'X-Stainless-Runtime': 'node' | 'deno' | 'edge' | `browser:${Browser}` | 'unknown';
  'X-Stainless-Runtime-Version': string;
};
const getPlatformProperties = (): PlatformProperties => {
  if (typeof Deno !== 'undefined' && Deno.build != null) {
    return {
      'X-Stainless-Lang': 'js',
      'X-Stainless-Package-Version': VERSION,
      'X-Stainless-OS': normalizePlatform(Deno.build.os),
      'X-Stainless-Arch': normalizeArch(Deno.build.arch),
      'X-Stainless-Runtime': 'deno',
      'X-Stainless-Runtime-Version': Deno.version,
    };
  }
  if (typeof EdgeRuntime !== 'undefined') {
    return {
      'X-Stainless-Lang': 'js',
      'X-Stainless-Package-Version': VERSION,
      'X-Stainless-OS': 'Unknown',
      'X-Stainless-Arch': `other:${EdgeRuntime}`,
      'X-Stainless-Runtime': 'edge',
      'X-Stainless-Runtime-Version': process.version,
    };
  }
  // Check if Node.js
  if (Object.prototype.toString.call(typeof process !== 'undefined' ? process : 0) === '[object process]') {
    return {
      'X-Stainless-Lang': 'js',
      'X-Stainless-Package-Version': VERSION,
      'X-Stainless-OS': normalizePlatform(process.platform),
      'X-Stainless-Arch': normalizeArch(process.arch),
      'X-Stainless-Runtime': 'node',
      'X-Stainless-Runtime-Version': process.version,
    };
  }

  const browserInfo = getBrowserInfo();
  if (browserInfo) {
    return {
      'X-Stainless-Lang': 'js',
      'X-Stainless-Package-Version': VERSION,
      'X-Stainless-OS': 'Unknown',
      'X-Stainless-Arch': 'unknown',
      'X-Stainless-Runtime': `browser:${browserInfo.browser}`,
      'X-Stainless-Runtime-Version': browserInfo.version,
    };
  }

  // TODO add support for Cloudflare workers, etc.
  return {
    'X-Stainless-Lang': 'js',
    'X-Stainless-Package-Version': VERSION,
    'X-Stainless-OS': 'Unknown',
    'X-Stainless-Arch': 'unknown',
    'X-Stainless-Runtime': 'unknown',
    'X-Stainless-Runtime-Version': 'unknown',
  };
};

type BrowserInfo = {
  browser: Browser;
  version: string;
};

declare const navigator: { userAgent: string } | undefined;

// Note: modified from https://github.com/JS-DevTools/host-environment/blob/b1ab79ecde37db5d6e163c050e54fe7d287d7c92/src/isomorphic.browser.ts
function getBrowserInfo(): BrowserInfo | null {
  if (!navigator || typeof navigator === 'undefined') {
    return null;
  }

  // NOTE: The order matters here!
  const browserPatterns = [
    { key: 'edge' as const, pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: 'ie' as const, pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: 'ie' as const, pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: 'chrome' as const, pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: 'firefox' as const, pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: 'safari' as const, pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ },
  ];

  // Find the FIRST matching browser
  for (const { key, pattern } of browserPatterns) {
    const match = pattern.exec(navigator.userAgent);
    if (match) {
      const major = match[1] || 0;
      const minor = match[2] || 0;
      const patch = match[3] || 0;

      return { browser: key, version: `${major}.${minor}.${patch}` };
    }
  }

  return null;
}

const normalizeArch = (arch: string): Arch => {
  // Node docs:
  // - https://nodejs.org/api/process.html#processarch
  // Deno docs:
  // - https://doc.deno.land/deno/stable/~/Deno.build
  if (arch === 'x32') return 'x32';
  if (arch === 'x86_64' || arch === 'x64') return 'x64';
  if (arch === 'arm') return 'arm';
  if (arch === 'aarch64' || arch === 'arm64') return 'arm64';
  if (arch) return `other:${arch}`;
  return 'unknown';
};

const normalizePlatform = (platform: string): PlatformName => {
  // Node platforms:
  // - https://nodejs.org/api/process.html#processplatform
  // Deno platforms:
  // - https://doc.deno.land/deno/stable/~/Deno.build
  // - https://github.com/denoland/deno/issues/14799

  platform = platform.toLowerCase();

  // NOTE: this iOS check is untested and may not work
  // Node does not work natively on IOS, there is a fork at
  // https://github.com/nodejs-mobile/nodejs-mobile
  // however it is unknown at the time of writing how to detect if it is running
  if (platform.includes('ios')) return 'iOS';
  if (platform === 'android') return 'Android';
  if (platform === 'darwin') return 'MacOS';
  if (platform === 'win32') return 'Windows';
  if (platform === 'freebsd') return 'FreeBSD';
  if (platform === 'openbsd') return 'OpenBSD';
  if (platform === 'linux') return 'Linux';
  if (platform) return `Other:${platform}`;
  return 'Unknown';
};

let _platformHeaders: PlatformProperties;
const getPlatformHeaders = () => {
  return (_platformHeaders ??= getPlatformProperties());
};

export const safeJSON = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    return undefined;
  }
};

// https://stackoverflow.com/a/19709846
const startsWithSchemeRegexp = new RegExp('^(?:[a-z]+:)?//', 'i');
const isAbsoluteURL = (url: string): boolean => {
  return startsWithSchemeRegexp.test(url);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const validatePositiveInteger = (name: string, n: unknown): number => {
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    throw new Error(`${name} must be an integer`);
  }
  if (n < 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return n;
};

export const castToError = (err: any): Error => {
  if (err instanceof Error) return err;
  return new Error(err);
};

export const ensurePresent = <T>(value: T | null | undefined): T => {
  if (value == null) throw new Error(`Expected a value to be given but received ${value} instead.`);
  return value;
};

/**
 * Read an environment variable.
 *
 * Will return undefined if the environment variable doesn't exist or cannot be accessed.
 */
export const readEnv = (env: string): string | undefined => {
  if (typeof process !== 'undefined') {
    return process.env?.[env] ?? undefined;
  }
  if (typeof Deno !== 'undefined') {
    return Deno.env?.get?.(env);
  }
  return undefined;
};

export const coerceInteger = (value: unknown): number => {
  if (typeof value === 'number') return Math.round(value);
  if (typeof value === 'string') return parseInt(value, 10);

  throw new Error(`Could not coerce ${value} (type: ${typeof value}) into a number`);
};

export const coerceFloat = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);

  throw new Error(`Could not coerce ${value} (type: ${typeof value}) into a number`);
};

export const coerceBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return Boolean(value);
};

export const maybeCoerceInteger = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return coerceInteger(value);
};

export const maybeCoerceFloat = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return coerceFloat(value);
};

export const maybeCoerceBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return coerceBoolean(value);
};

// https://stackoverflow.com/a/34491287
export function isEmptyObj(obj: Object | null | undefined): boolean {
  if (!obj) return true;
  for (const _k in obj) return false;
  return true;
}

// https://eslint.org/docs/latest/rules/no-prototype-builtins
export function hasOwn(obj: Object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * https://stackoverflow.com/a/2117523
 */
const uuid4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const isRunningInBrowser = () => {
  return (
    // @ts-ignore
    typeof window !== 'undefined' &&
    // @ts-ignore
    typeof window.document !== 'undefined' &&
    // @ts-ignore
    typeof navigator !== 'undefined'
  );
};

export interface HeadersProtocol {
  get: (header: string) => string | null | undefined;
}
export type HeadersLike = Record<string, string | string[] | undefined> | HeadersProtocol;

export const isHeadersProtocol = (headers: any): headers is HeadersProtocol => {
  return typeof headers?.get === 'function';
};

export const getHeader = (headers: HeadersLike, key: string): string | null | undefined => {
  const lowerKey = key.toLowerCase();
  if (isHeadersProtocol(headers)) return headers.get(key) || headers.get(lowerKey);
  const value = headers[key] || headers[lowerKey];
  if (Array.isArray(value)) {
    if (value.length <= 1) return value[0];
    console.warn(`Received ${value.length} entries for the ${key} header, using the first entry.`);
    return value[0];
  }
  return value;
};

/**
 * Encodes a string to Base64 format.
 */
export const toBase64 = (str: string | null | undefined): string => {
  if (!str) return '';
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64');
  }

  if (typeof btoa !== 'undefined') {
    return btoa(str);
  }

  throw new Error('Cannot generate b64 string; Expected `Buffer` or `btoa` to be defined');
};
