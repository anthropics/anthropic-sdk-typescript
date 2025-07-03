import { readFileSync } from 'fs';
import { join } from 'path';
import { _iterSSEMessages } from '@anthropic-ai/sdk/core/streaming';
import { ReadableStreamFrom } from '@anthropic-ai/sdk/internal/shims';

export function loadFixture(filename: string): string {
  const fixturePath = join(__dirname, 'fixtures', filename);
  return readFileSync(fixturePath, 'utf-8');
}

export async function parseSSEFixture(sseContent: string): Promise<unknown[]> {
  const events: unknown[] = [];

  async function* body(): AsyncGenerator<Buffer> {
    yield Buffer.from(sseContent);
  }

  const stream = _iterSSEMessages(new Response(ReadableStreamFrom(body())), new AbortController())[
    Symbol.asyncIterator
  ]();

  let event = await stream.next();
  while (!event.done) {
    if (event.value && event.value.event !== 'ping') {
      events.push(JSON.parse(event.value.data));
    }
    event = await stream.next();
  }

  return events;
}
