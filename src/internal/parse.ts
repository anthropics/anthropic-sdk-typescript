// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import type { FinalRequestOptions } from './request-options';
import { Stream } from '../streaming';
import { type BaseAnthropic } from '../client';
import { logger } from './utils/log';

export type APIResponseProps = {
  response: Response;
  options: FinalRequestOptions;
  controller: AbortController;
};

export async function defaultParseResponse<T>(client: BaseAnthropic, props: APIResponseProps): Promise<T> {
  const { response } = props;
  if (props.options.stream) {
    logger(client).debug('response', response.status, response.url, response.headers, response.body);

    // Note: there is an invariant here that isn't represented in the type system
    // that if you set `stream: true` the response type must also be `Stream<T>`

    if (props.options.__streamClass) {
      return props.options.__streamClass.fromSSEResponse(response, props.controller) as any;
    }

    return Stream.fromSSEResponse(response, props.controller) as any;
  }

  // fetch refuses to read the body when the status code is 204.
  if (response.status === 204) {
    return null as T;
  }

  if (props.options.__binaryResponse) {
    return response as unknown as T;
  }

  const contentType = response.headers.get('content-type');
  const isJSON =
    contentType?.includes('application/json') || contentType?.includes('application/vnd.api+json');
  if (isJSON) {
    const json = await response.json();

    logger(client).debug('response', response.status, response.url, response.headers, json);

    return json as T;
  }

  const text = await response.text();
  logger(client).debug('response', response.status, response.url, response.headers, text);

  // TODO handle blob, arraybuffer, other content types, etc.
  return text as unknown as T;
}
