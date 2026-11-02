import { type BaseAnthropic } from '../client';

import { type PromiseOrValue } from '../internal/types';
import {
  type APIResponseProps,
  type WithRequestID,
  defaultParseResponse,
  addResponseIDs,
} from '../internal/parse';
import { endApiCallSpan, guardTracing, setCreatedIDAttribute, type ApiCallResult } from '../internal/tracing';
import { isAsyncIterable } from '../internal/uploads';
import { endAnthropicApiCallSpanWhenStreamEnds, setAnthropicSpanAttributes } from '../lib/internal/tracing';

/**
 * A subclass of `Promise` providing additional helper methods
 * for interacting with the SDK.
 */
export class APIPromise<T> extends Promise<WithRequestID<T>> {
  private parsedPromise: Promise<WithRequestID<T>> | undefined;
  #client: BaseAnthropic;

  constructor(
    client: BaseAnthropic,
    private responsePromise: Promise<APIResponseProps>,
    private parseResponse: (
      client: BaseAnthropic,
      props: APIResponseProps,
    ) => PromiseOrValue<WithRequestID<T>> = defaultParseResponse,
  ) {
    super((resolve) => {
      // this is maybe a bit weird but this has to be a no-op to not implicitly
      // parse the response body; instead .then, .catch, .finally are overridden
      // to parse the response
      resolve(null as any);
    });
    this.#client = client;
  }

  /** @internal The unparsed response with its request metadata, for helpers that build one request on another. */
  _responseProps(): Promise<APIResponseProps> {
    return this.responsePromise;
  }

  _thenUnwrap<U>(transform: (data: T, props: APIResponseProps) => U): APIPromise<U> {
    return new APIPromise(this.#client, this.responsePromise, async (client, props) =>
      addResponseIDs(transform(await this.parseResponse(client, props), props), props.response),
    );
  }

  /**
   * Gets the raw `Response` instance instead of parsing the response
   * data.
   *
   * If you want to parse the response body but still get the `Response`
   * instance, you can use {@link withResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  asResponse(): Promise<Response> {
    return this.responsePromise.then((props) => {
      // A traced API call's span ends with the body. A response read this way, before any parse
      // of its body has begun, may never be parsed, so its span ends now, without the body.
      const span = props.options.__span?.span;
      if (span && !this.parsedPromise) {
        const result: ApiCallResult = { status: 'success', ...props, data: undefined };
        setAnthropicSpanAttributes(this.#client, span, result);
        guardTracing(this.#client, () => endApiCallSpan(span, result));
      }
      return props.response;
    });
  }

  /**
   * Gets the parsed response data, the raw `Response` instance and the ID of the request,
   * returned via the `request-id` header which is useful for debugging requests and resporting
   * issues to Anthropic.
   *
   * If you just want to get the raw `Response` instance without parsing it,
   * you can use {@link asResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  async withResponse(): Promise<{
    data: T;
    response: Response;
    request_id: string | null | undefined;
    workspace_id: string | null | undefined;
  }> {
    const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
    return {
      data,
      response,
      request_id: response.headers.get('request-id'),
      workspace_id: response.headers.get('anthropic-workspace-id'),
    };
  }

  private parse(): Promise<WithRequestID<T>> {
    if (!this.parsedPromise) {
      this.parsedPromise = this.responsePromise.then((props) => this.parseResponseTraced(props));
    }
    return this.parsedPromise;
  }

  /**
   * Parses the body of an API call. When the call has a span, the span ends with the parse, or,
   * when the parse returns a streamed body, when the application has read that stream.
   */
  private async parseResponseTraced(props: APIResponseProps): Promise<WithRequestID<T>> {
    const call = props.options.__span;
    if (!call) {
      return this.parseResponse(this.#client, props);
    }
    const { span } = call;
    let data: WithRequestID<T>;
    try {
      data = await this.parseResponse(this.#client, props);
    } catch (error) {
      const result: ApiCallResult = { status: 'error', ...props, error };
      setAnthropicSpanAttributes(this.#client, span, result);
      guardTracing(this.#client, () => endApiCallSpan(span, result));
      throw error;
    }
    const result: ApiCallResult = { status: 'success', ...props, data };
    guardTracing(this.#client, () => setCreatedIDAttribute(call, data));
    setAnthropicSpanAttributes(this.#client, span, result);
    if (props.options.stream && isAsyncIterable(data)) {
      guardTracing(this.#client, () =>
        endAnthropicApiCallSpanWhenStreamEnds(this.#client, span, data, props),
      );
    } else {
      guardTracing(this.#client, () => endApiCallSpan(span, result));
    }
    return data;
  }

  override then<TResult1 = WithRequestID<T>, TResult2 = never>(
    onfulfilled?: ((value: WithRequestID<T>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.parse().then(onfulfilled, onrejected);
  }

  override catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<WithRequestID<T> | TResult> {
    return this.parse().catch(onrejected);
  }

  override finally(onfinally?: (() => void) | undefined | null): Promise<WithRequestID<T>> {
    return this.parse().finally(onfinally);
  }
}
