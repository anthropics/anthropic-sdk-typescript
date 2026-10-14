import { propagation } from '@opentelemetry/api';
import { AnthropicBedrock, AnthropicBedrockMantle } from '../src';
import { version } from '../package.json';

/** A tracer provider that records the attributes of the spans it starts, and their tracer's scope. */
function recordingProvider() {
  const spans: Array<{
    name: string;
    scope: { name: string; version: string | undefined };
    start: unknown;
    attributes: Record<string, unknown>;
  }> = [];
  const provider = {
    getTracer: (scopeName: string, version?: string) => ({
      startSpan(name: string, options?: { attributes?: Record<string, unknown> }) {
        const record = {
          name,
          scope: { name: scopeName, version },
          start: { ...options?.attributes },
          attributes: { ...options?.attributes },
        };
        spans.push(record);
        const span: any = {
          spanContext: () => ({ traceId: '1'.repeat(32), spanId: '2'.repeat(16), traceFlags: 1 }),
          isRecording: () => true,
          setAttribute: (key: string, value: unknown) => ((record.attributes[key] = value), span),
          setAttributes: (values: Record<string, unknown>) => (
            Object.assign(record.attributes, values), span
          ),
          setStatus: () => span,
          addEvent: () => span,
          addLink: () => span,
          addLinks: () => span,
          updateName: () => span,
          recordException: () => {},
          end: () => {},
        };
        return span;
      },
    }),
  };
  return { provider: provider as any, spans };
}

test('spans report the Bedrock provider and host', async () => {
  const { provider, spans } = recordingProvider();
  const client = new AnthropicBedrock({
    apiKey: 'test-bearer-token',
    awsRegion: 'us-east-1',
    openTelemetry: { tracerProvider: provider },
    fetch: async () =>
      new Response(JSON.stringify({ id: 'msg_1', type: 'message', content: [], usage: {} }), {
        headers: { 'content-type': 'application/json' },
      }),
  });

  await client.messages.create({
    model: 'model-a',
    max_tokens: 1,
    messages: [{ role: 'user', content: 'hi' }],
  });

  expect(spans.map((span) => span.name)).toEqual(['anthropic.messages.create']);
  // What the span starts with, which is all that a sampler sees.
  expect(spans[0]!.start).toMatchObject({
    'gen_ai.provider.name': 'aws.bedrock',
    'server.address': 'bedrock-runtime.us-east-1.amazonaws.com',
    'server.port': 443,
    // The route is the Claude API's, whichever path the platform serves it at.
    'http.route': '/v1/messages',
  });
  expect(spans[0]!.attributes).toMatchObject({
    'http.request.method': 'POST',
    'url.scheme': 'https',
    'url.path': '/model/model-a/invoke',
    'url.full': 'https://bedrock-runtime.us-east-1.amazonaws.com/model/model-a/invoke',
  });
  expect(spans[0]!.attributes).not.toHaveProperty('url.query');
});

test.each([
  ['AnthropicBedrock', (options: object) => new AnthropicBedrock(options)],
  ['AnthropicBedrockMantle', (options: object) => new AnthropicBedrockMantle(options)],
])(
  'spans of %s have the scope of this package, with its version, also from a copy of the client',
  async (_name, makeClient) => {
    const { provider, spans } = recordingProvider();
    const client = makeClient({
      apiKey: 'test-bearer-token',
      awsRegion: 'us-east-1',
      openTelemetry: { tracerProvider: provider },
      fetch: async () =>
        new Response(JSON.stringify({ id: 'msg_1', type: 'message', content: [], usage: {} }), {
          headers: { 'content-type': 'application/json' },
        }),
    });
    const params = { model: 'model-a', max_tokens: 1, messages: [{ role: 'user' as const, content: 'hi' }] };

    await client.messages.create(params);
    await client.withOptions({ maxRetries: 0 }).messages.create(params);

    const scope = { name: 'com.anthropic.sdk.typescript.bedrock', version };
    expect(spans.map((span) => span.scope)).toEqual([scope, scope]);
  },
);

describe('SigV4 and trace context', () => {
  // Stands in for the W3C trace-context and baggage propagators.
  const traceHeaders = {
    traceparent: `00-${'1'.repeat(32)}-${'2'.repeat(16)}-01`,
    tracestate: 'vendor=value',
    baggage: 'key=value',
  };

  beforeEach(() => {
    propagation.setGlobalPropagator({
      inject: (_context, carrier, setter) =>
        Object.entries(traceHeaders).forEach(([key, value]) => setter.set(carrier, key, value)),
      extract: (context) => context,
      fields: () => Object.keys(traceHeaders),
    });
  });

  afterEach(() => propagation.disable());

  const clients = {
    AnthropicBedrock: (options: object) => new AnthropicBedrock(options),
    AnthropicBedrockMantle: (options: object) => new AnthropicBedrockMantle(options),
  };

  // The client keeps them from the signer on a traced call. The signer leaves out the caller's own.
  const calls = [
    ['the trace headers', { tracerProvider: recordingProvider().provider }, undefined, true],
    ["the caller's own trace headers with tracing off", false, { headers: traceHeaders }, true],
    [
      'no trace headers with propagation: false',
      { tracerProvider: recordingProvider().provider, propagation: false },
      undefined,
      false,
    ],
  ] as const;

  describe.each(Object.entries(clients))('%s', (_name, makeClient) => {
    test.each(calls)(
      'sends %s and leaves them out of the signature',
      async (_headers, openTelemetry, requestOptions, sends) => {
        let sent = new Headers();
        const client = makeClient({
          awsRegion: 'us-east-1',
          awsAccessKey: 'AKIDEXAMPLE',
          awsSecretKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
          awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
          openTelemetry,
          fetch: async (_url: unknown, init: RequestInit = {}) => {
            sent = new Headers(init.headers);
            return new Response(JSON.stringify({ id: 'msg_1', type: 'message', content: [], usage: {} }), {
              headers: { 'content-type': 'application/json' },
            });
          },
        });

        await client.messages.create(
          { model: 'model-a', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] },
          requestOptions,
        );

        // An HTTP instrumentation may replace these headers after the request is signed.
        const signedHeaders = /SignedHeaders=([^,]+)/.exec(sent.get('authorization') ?? '')?.[1]?.split(';');
        expect(signedHeaders).toEqual(expect.arrayContaining(['host', 'x-amz-date']));
        for (const [key, value] of Object.entries(traceHeaders)) {
          expect(sent.get(key)).toBe(sends ? value : null);
          expect(signedHeaders).not.toContain(key);
        }
      },
    );
  });
});
