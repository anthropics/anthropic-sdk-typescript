import { APIPromise } from '@anthropic-ai/sdk/api-promise';
import Anthropic from '@anthropic-ai/sdk/index';
import { compareType } from './utils/typing';

const client = new Anthropic({ apiKey: 'dummy' });

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
      .create({ messages: [], model: 'claude-opus-4-20250514', max_tokens: 1024 })
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
      model: 'claude-opus-4-20250514',
      max_tokens: 1024,
    });
    expect(rsp.id).toBe('bar');
    expect(rsp._request_id).toBe('req_xxx');
    expect(JSON.stringify(rsp)).toBe('{"id":"bar"}');
  });

  test('envelope response', async () => {
    const promise = new APIPromise<{ data: { foo: string } }>(
      client,
      (async () => {
        return {
          response: new Response(JSON.stringify({ data: { foo: 'bar' } }), {
            headers: { 'request-id': 'req_xxx', 'content-type': 'application/json' },
          }),
          controller: {} as any,
          options: {} as any,
          requestLogID: 'log_000000',
          retryOfRequestLogID: undefined,
          startTime: Date.now(),
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
      client,
      (async () => {
        return {
          response: new Response(JSON.stringify([{ foo: 'bar' }]), {
            headers: { 'request-id': 'req_xxx', 'content-type': 'application/json' },
          }),
          controller: {} as any,
          options: {} as any,
          requestLogID: 'log_000000',
          retryOfRequestLogID: undefined,
          startTime: Date.now(),
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
      client,
      (async () => {
        return {
          response: new Response('hello world', {
            headers: { 'request-id': 'req_xxx', 'content-type': 'application/text' },
          }),
          controller: {} as any,
          options: {} as any,
          requestLogID: 'log_000000',
          retryOfRequestLogID: undefined,
          startTime: Date.now(),
        };
      })(),
    );

    const result = await promise;
    expect(result).toBe('hello world');
    expect((result as any)._request_id).toBeUndefined();
  });
});
