import http from 'node:http';
import type { AddressInfo } from 'node:net';
import v8 from 'node:v8';
import vm from 'node:vm';
import { INVALID_SPAN_CONTEXT, trace } from '@opentelemetry/api';
import Anthropic from '@anthropic-ai/sdk';
import type { Stream } from '@anthropic-ai/sdk/core/streaming';
import { startApiCallSpan } from '@anthropic-ai/sdk/internal/tracing';

test('garbage collection closes an unread stream that was dropped, not one that is held', async () => {
  v8.setFlagsFromString('--expose-gc');
  const gc: () => void = vm.runInNewContext('gc');

  // Left open, so that only the client can close them.
  const responses: http.ServerResponse[] = [];
  const server = http.createServer((_, res) => {
    responses.push(res);
    res.write('data: {}\n\n');
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  onTestFinished(() => server.close().closeAllConnections());

  const span = trace.wrapSpanContext(INVALID_SPAN_CONTEXT);
  vi.spyOn(span, 'isRecording').mockReturnValue(true);
  const tracer = trace.getTracer('test');
  vi.spyOn(tracer, 'startSpan').mockReturnValue(span);
  const client = new Anthropic({
    baseURL: `http://localhost:${(server.address() as AddressInfo).port}`,
    apiKey: 'my-anthropic-api-key',
    openTelemetry: { tracerProvider: { getTracer: () => tracer } },
  });
  const request = () =>
    client.get<Stream<unknown>>('/', { stream: true, __span: startApiCallSpan(client, 'test') });

  const held = await request();
  // In its own frame, so that this one cannot keep the stream alive.
  await (async () => void (await request()))();
  await expect.poll(() => (gc(), responses[1]!.destroyed), { timeout: 20_000 }).toBe(true);

  expect(responses[0]!.destroyed).toBe(false);
  held.controller.abort();
}, 30_000);
