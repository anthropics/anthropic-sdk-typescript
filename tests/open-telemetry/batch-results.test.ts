import { SpanStatusCode } from '@opentelemetry/api';
import { makeClient, json, MESSAGE, spans, onlySpan, pathID, type Handler, setUpTracing } from './utils';

setUpTracing();

describe('OpenTelemetry spans', () => {
  describe('batch results', () => {
    const batch = {
      id: 'msgbatch_1',
      type: 'message_batch',
      processing_status: 'ended',
      results_url: 'http://localhost:4010/v1/messages/batches/msgbatch_1/results',
    };
    const line = (id: string) =>
      JSON.stringify({ custom_id: id, result: { type: 'succeeded', message: MESSAGE } }) + '\n';
    const jsonl =
      (start: (controller: ReadableStreamDefaultController<Uint8Array>) => void): Handler =>
      () =>
        new Response(new ReadableStream({ start }), {
          headers: { 'content-type': 'application/binary', 'request-id': 'req_results' },
        });

    test('the span stays open until the results have been read', async () => {
      const { client } = makeClient([
        json(batch),
        jsonl((controller) => {
          controller.enqueue(new TextEncoder().encode(line('a') + line('b')));
          controller.close();
        }),
      ]);

      const results = await client.messages.batches.results('msgbatch_1');
      expect(spans('anthropic.messages.batches.results')).toHaveLength(0);
      const ids = [];
      for await (const entry of results) {
        ids.push(entry.custom_id);
      }

      expect(ids).toEqual(['a', 'b']);
      const span = onlySpan('anthropic.messages.batches.results');
      expect(span.status.code).toBe(SpanStatusCode.OK);
      expect(span.attributes[pathID('messages.batches.results', 'message_batch_id')]).toBe('msgbatch_1');
      expect(span.attributes['http.response.status_code']).toBe(200);
    });

    test('beta batch results have their own span, after the span that retrieves the batch', async () => {
      const { client } = makeClient([
        json(batch),
        jsonl((controller) => {
          controller.enqueue(new TextEncoder().encode(line('a')));
          controller.close();
        }),
      ]);

      const results = await client.beta.messages.batches.results('msgbatch_1');
      for await (const _ of results) {
      }

      expect(onlySpan('anthropic.messages.batches.retrieve').status.code).toBe(SpanStatusCode.OK);
      const span = onlySpan('anthropic.messages.batches.results');
      expect(span.status.code).toBe(SpanStatusCode.OK);
      expect(span.attributes[pathID('beta.messages.batches.results', 'message_batch_id')]).toBe('msgbatch_1');
    });

    test('a download that fails while it is read fails the span', async () => {
      const { client } = makeClient([
        json(batch),
        jsonl((controller) => {
          controller.enqueue(new TextEncoder().encode(line('a')));
          setTimeout(() => controller.error(new TypeError('connection reset')), 0);
        }),
      ]);

      const results = await client.messages.batches.results('msgbatch_1');
      await expect(async () => {
        for await (const _ of results) {
        }
      }).rejects.toThrow('connection reset');

      const span = onlySpan('anthropic.messages.batches.results');
      expect(span.status.code).toBe(SpanStatusCode.ERROR);
      expect(span.attributes['error.type']).toBe('client_error');
    });

    test('results the application aborts without reading them leave the status unset', async () => {
      const { client } = makeClient([
        json(batch),
        jsonl((controller) => {
          controller.enqueue(new TextEncoder().encode(line('a')));
          controller.close();
        }),
      ]);

      const results = await client.messages.batches.results('msgbatch_1');
      results.controller.abort();

      expect(onlySpan('anthropic.messages.batches.results').status.code).toBe(SpanStatusCode.UNSET);
    });

    test('results the application stops reading leave the status unset', async () => {
      const { client } = makeClient([
        json(batch),
        jsonl((controller) => {
          controller.enqueue(new TextEncoder().encode(line('a') + line('b')));
          controller.close();
        }),
      ]);

      const results = await client.messages.batches.results('msgbatch_1');
      for await (const _ of results) {
        break;
      }

      const span = onlySpan('anthropic.messages.batches.results');
      expect(span.status.code).toBe(SpanStatusCode.UNSET);
      expect(span.attributes['error.type']).toBeUndefined();
    });
  });
});
