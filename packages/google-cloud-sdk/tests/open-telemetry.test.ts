import { AnthropicGoogleCloud } from '../src';
import { version } from '../package.json';

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
  const client = new AnthropicGoogleCloud({
    project: 'my-project',
    location: 'us-central1',
    workspaceId: 'wrkspc_test',
    skipAuth: true,
    openTelemetry: { tracerProvider: provider },
    fetch: async () =>
      new Response(JSON.stringify({ id: 'msg_1', type: 'message', content: [], usage: {} }), {
        headers: { 'content-type': 'application/json' },
      }),
  });
  const params = { model: 'model-a', max_tokens: 1, messages: [{ role: 'user' as const, content: 'hi' }] };

  await client.messages.create(params);
  await client.withOptions({ maxRetries: 0 }).messages.create(params);

  const scope = { name: 'com.anthropic.sdk.typescript.google-cloud', version };
  expect(scopes).toEqual([scope, scope]);
});
