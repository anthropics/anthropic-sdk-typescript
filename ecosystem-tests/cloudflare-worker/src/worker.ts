import Anthropic from '@anthropic-ai/sdk';

// The Worker entry wrangler bundles; test/worker.test.ts drives it through its service binding
// and separately exercises the SDK surface directly inside workerd.
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const client = new Anthropic({ baseURL: env.ANTHROPIC_BASE_URL, apiKey: env.ANTHROPIC_API_KEY });
    const prompt = new URL(request.url).searchParams.get('prompt') ?? 'Hi';
    const stream = client.messages.stream({
      model: 'mock-model',
      max_tokens: 32,
      messages: [{ role: 'user', content: prompt }],
    });
    // pipe the text deltas straight back out of the Worker as they arrive
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    stream.on('text', (delta) => void writer.write(encoder.encode(delta)));
    ctx.waitUntil(
      stream.finalMessage().then(
        () => writer.close(),
        (err) => writer.abort(err),
      ),
    );
    return new Response(readable, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
} satisfies ExportedHandler<Cloudflare.Env>;
