import { propagation, trace } from '@opentelemetry/api';
import { AnthropicAws } from '../src';
import { version } from '../package.json';

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

afterEach(() => {
  propagation.disable();
  trace.disable();
});

// The client keeps them from the signer on a traced call. The signer leaves out the caller's own.
test.each([
  ['the trace headers', { tracerProvider: trace.getTracerProvider() }, undefined, true],
  ["the caller's own trace headers with tracing off", false as const, { headers: traceHeaders }, true],
  ['no trace headers with propagation: false', { propagation: false }, undefined, false],
])(
  'sends %s and leaves them out of the SigV4 signature',
  async (_name, openTelemetry, requestOptions, sends) => {
    let sent = new Headers();
    const client = new AnthropicAws({
      awsRegion: 'us-east-1',
      workspaceId: 'wrkspc_1',
      awsAccessKey: 'AKIDEXAMPLE',
      awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      openTelemetry,
      fetch: async (_url, init = {}) => {
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

/** A tracer provider that records the scope of the tracer of each span it starts. */
function scopeRecordingProvider() {
  const scopes: Array<{ name: string; version: string | undefined }> = [];
  const provider = {
    getTracer: (name: string, version?: string) => ({
      startSpan() {
        scopes.push({ name, version });
        const span: any = {
          spanContext: () => ({ traceId: '1'.repeat(32), spanId: '2'.repeat(16), traceFlags: 1 }),
          isRecording: () => true,
          setAttribute: () => span,
          setAttributes: () => span,
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
  return { provider: provider as any, scopes };
}

test('spans have the scope of this package, with its version, also from a copy of the client', async () => {
  const { provider, scopes } = scopeRecordingProvider();
  const client = new AnthropicAws({
    awsRegion: 'us-east-1',
    workspaceId: 'wrkspc_1',
    apiKey: 'test-key',
    openTelemetry: { tracerProvider: provider },
    fetch: async () =>
      new Response(JSON.stringify({ id: 'msg_1', type: 'message', content: [], usage: {} }), {
        headers: { 'content-type': 'application/json' },
      }),
  });
  const params = { model: 'model-a', max_tokens: 1, messages: [{ role: 'user' as const, content: 'hi' }] };

  await client.messages.create(params);
  await client.withOptions({ maxRetries: 0 }).messages.create(params);

  const scope = { name: 'com.anthropic.sdk.typescript.aws', version };
  expect(scopes).toEqual([scope, scope]);
});

test('a copy of the client keeps what the client read from the environment variable', async () => {
  const { provider, scopes } = scopeRecordingProvider();
  // The variable is for a client without the option, whose spans go to the registered provider.
  trace.setGlobalTracerProvider(provider);
  process.env['ANTHROPIC_OPEN_TELEMETRY'] = 'false';
  let client: AnthropicAws;
  try {
    client = new AnthropicAws({
      awsRegion: 'us-east-1',
      workspaceId: 'wrkspc_1',
      apiKey: 'test-key',
      fetch: async () =>
        new Response(JSON.stringify({ id: 'msg_1', type: 'message', content: [], usage: {} }), {
          headers: { 'content-type': 'application/json' },
        }),
    });
  } finally {
    delete process.env['ANTHROPIC_OPEN_TELEMETRY'];
  }
  const params = { model: 'model-a', max_tokens: 1, messages: [{ role: 'user' as const, content: 'hi' }] };

  await client.withOptions({ maxRetries: 0 }).messages.create(params);
  expect(scopes).toEqual([]);

  const { openTelemetry } = client;
  await client
    .withOptions({
      openTelemetry: { ...openTelemetry, traces: { ...openTelemetry.traces, contentMode: 'content' } },
    })
    .messages.create(params);
  expect(scopes).toEqual([]);

  await client.withOptions({ openTelemetry: { ...openTelemetry, traces: true } }).messages.create(params);
  expect(scopes).toHaveLength(1);
});
