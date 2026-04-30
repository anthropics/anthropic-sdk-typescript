import { Readable } from 'node:stream';
import { EventStreamMarshaller } from '@smithy/eventstream-serde-node';
import { APIError } from '@anthropic-ai/sdk';
import { Stream, fromUtf8, toUtf8 } from '../src/core/streaming';

function encodeChunkFrame(payload: unknown): ReadableStream {
  const marshaller = new EventStreamMarshaller({ utf8Encoder: toUtf8, utf8Decoder: fromUtf8 });
  const inner = JSON.stringify(payload);
  const body = fromUtf8(JSON.stringify({ bytes: Buffer.from(inner).toString('base64') }));
  const serialized = marshaller.serialize(
    (async function* () {
      yield {
        headers: {
          ':message-type': { type: 'string', value: 'event' },
          ':event-type': { type: 'string', value: 'chunk' },
          ':content-type': { type: 'string', value: 'application/json' },
        },
        body,
      };
    })(),
    (msg: any) => msg,
  );
  return Readable.toWeb(Readable.from(serialized)) as ReadableStream;
}

describe('Bedrock Stream.fromSSEResponse', () => {
  test('throws APIError when a chunk frame contains an Anthropic error payload', async () => {
    const response = new Response(
      encodeChunkFrame({ type: 'error', error: { type: 'overloaded_error', message: 'test' } }),
    );
    const stream = Stream.fromSSEResponse(response, new AbortController());

    let caught: unknown;
    try {
      for await (const _ of stream) {
        // consume
      }
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(APIError);
    expect(String(caught)).not.toContain('Unexpected event order');
    expect((caught as APIError).type).toBe('overloaded_error');
  });

  test('yields normal chunk payloads unchanged', async () => {
    const response = new Response(
      encodeChunkFrame({ type: 'message_start', message: { id: 'msg_1', role: 'assistant' } }),
    );
    const stream = Stream.fromSSEResponse<any>(response, new AbortController());

    const events: any[] = [];
    for await (const ev of stream) events.push(ev);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('message_start');
  });
});
