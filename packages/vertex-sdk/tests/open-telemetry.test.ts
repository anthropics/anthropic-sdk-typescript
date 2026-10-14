import { AnthropicVertex } from '../src/client';
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

test('spans report the Vertex AI provider and host', async () => {
  const { provider, spans } = recordingProvider();
  const client = new AnthropicVertex({
    region: 'us-east5',
    projectId: 'test-project',
    authClient: { projectId: 'test-project', getRequestHeaders: async () => new Headers() } as any,
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
    'gen_ai.provider.name': 'gcp.vertex_ai',
    'server.address': 'us-east5-aiplatform.googleapis.com',
    'server.port': 443,
    // The route is the Claude API's, whichever path the platform serves it at.
    'http.route': '/v1/messages',
  });
  const path = '/v1/projects/test-project/locations/us-east5/publishers/anthropic/models/model-a:rawPredict';
  expect(spans[0]!.attributes).toMatchObject({
    'http.request.method': 'POST',
    'url.scheme': 'https',
    'url.path': path,
    'url.full': `https://us-east5-aiplatform.googleapis.com${path}`,
  });
  expect(spans[0]!.attributes).not.toHaveProperty('url.query');
});

test('spans have the scope of this package, with its version', async () => {
  const { provider, spans } = recordingProvider();
  const client = new AnthropicVertex({
    region: 'us-east5',
    projectId: 'test-project',
    authClient: { projectId: 'test-project', getRequestHeaders: async () => new Headers() } as any,
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

  expect(spans.map((span) => span.scope)).toEqual([{ name: 'com.anthropic.sdk.typescript.vertex', version }]);
});
