import { APIPromise, createResponseHeaders } from '@anthropic-ai/sdk/core';
import Anthropic from '@anthropic-ai/sdk/index';
import { Headers } from '@anthropic-ai/sdk/_shims/index';
import { Response } from 'node-fetch';
import { compareType } from './utils/typing';

describe('response parsing', () => {
  // TODO: test unicode characters
  test('headers are case agnostic', async () => {
    const headers = createResponseHeaders(new Headers({ 'Content-Type': 'foo', Accept: 'text/plain' }));
    expect(headers['content-type']).toEqual('foo');
    expect(headers['Content-type']).toEqual('foo');
    expect(headers['Content-Type']).toEqual('foo');
    expect(headers['accept']).toEqual('text/plain');
    expect(headers['Accept']).toEqual('text/plain');
    expect(headers['Hello-World']).toBeUndefined();
  });

  test('duplicate headers are concatenated', () => {
    const headers = createResponseHeaders(
      new Headers([
        ['Content-Type', 'text/xml'],
        ['Content-Type', 'application/json'],
      ]),
    );
    expect(headers['content-type']).toBe('text/xml, application/json');
  });
});

describe('request id', () => {
  test('types', () => {
    compareType<Awaited<APIPromise<string>>, string>(true);
    compareType<Awaited<APIPromise<number>>, number>(true);
    compareType<Awaited<APIPromise<null>>, null>(true);
    compareType<Awaited<APIPromise<void>>, void>(true);
    compareType<Awaited<APIPromise<Response>>, Response>(true);
    compareType<Awaited<APIPromise<Response>>, Response>(true);
    compareType<Awaited<APIPromise<{ foo: string }>>, { foo: string } & { _request_id?: string | null }>(
      true,
    );
    compareType<Awaited<APIPromise<Array<{ foo: string }>>>, Array<{ foo: string }>>(true);
  });

  test('withResponse', async () => {
    const client = new Anthropic({
      apiKey: 'dummy',
      fetch: async () =>
        new Response(JSON.stringify({ id: 'bar' }), {
          headers: { 'request-id': 'req_xxx', 'content-type': 'application/json' },
        }),
    });

    const {
      data: message,
      response,
      request_id,
    } = await client.messages
      .create({ messages: [], model: 'claude-3-opus-20240229', max_tokens: 1024 })
      .withResponse();

    expect(request_id).toBe('req_xxx');
    expect(response.headers.get('request-id')).toBe('req_xxx');
    expect(message.id).toBe('bar');
    expect(JSON.stringify(message)).toBe('{"id":"bar"}');
  });

  test('object response', async () => {
    const client = new Anthropic({
      apiKey: 'dummy',
      fetch: async () =>
        new Response(JSON.stringify({ id: 'bar' }), {
          headers: { 'request-id': 'req_xxx', 'content-type': 'application/json' },
        }),
    });

    const rsp = await client.messages.create({
      messages: [],
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
    });
    expect(rsp.id).toBe('bar');
    expect(rsp._request_id).toBe('req_xxx');
    expect(JSON.stringify(rsp)).toBe('{"id":"bar"}');
  });

  test('envelope response', async () => {
    const promise = new APIPromise<{ data: { foo: string } }>(
      (async () => {
        return {
          response: new Response(JSON.stringify({ data: { foo: 'bar' } }), {
            headers: { 'request-id': 'req_xxx', 'content-type': 'application/json' },
          }),
          controller: {} as any,
          options: {} as any,
        };
      })(),
    )._thenUnwrap((d) => d.data);

    const rsp = await promise;
    expect(rsp.foo).toBe('bar');
    expect(rsp._request_id).toBe('req_xxx');
  });

  test('page response', async () => {
    const client = new Anthropic({
      apiKey: 'dummy',
      fetch: async () =>
        new Response(JSON.stringify({ data: [{ foo: 'bar' }] }), {
          headers: { 'request-id': 'req_xxx', 'content-type': 'application/json' },
        }),
    });

    const page = await client.beta.messages.batches.list();
    expect(page.data).toMatchObject([{ foo: 'bar' }]);
    expect((page as any)._request_id).toBeUndefined();
  });

  test('array response', async () => {
    const promise = new APIPromise<Array<{ foo: string }>>(
      (async () => {
        return {
          response: new Response(JSON.stringify([{ foo: 'bar' }]), {
            headers: { 'request-id': 'req_xxx', 'content-type': 'application/json' },
          }),
          controller: {} as any,
          options: {} as any,
        };
      })(),
    );

    const rsp = await promise;
    expect(rsp.length).toBe(1);
    expect(rsp[0]).toMatchObject({ foo: 'bar' });
    expect((rsp as any)._request_id).toBeUndefined();
  });

  test('string response', async () => {
    const promise = new APIPromise<string>(
      (async () => {
        return {
          response: new Response('hello world', {
            headers: { 'request-id': 'req_xxx', 'content-type': 'application/text' },
          }),
          controller: {} as any,
          options: {} as any,
        };
      })(),
    );

    const result = await promise;
    expect(result).toBe('hello world');
    expect((result as any)._request_id).toBeUndefined();
  });
});
