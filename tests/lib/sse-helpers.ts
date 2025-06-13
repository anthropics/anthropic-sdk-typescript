import { readFileSync } from 'fs';
import { join } from 'path';
import { SSEDecoder } from '../../src/core/streaming';

export function loadFixture(filename: string): string {
  const fixturePath = join(__dirname, 'fixtures', filename);
  return readFileSync(fixturePath, 'utf-8');
}

export function parseSSEFixture(sseContent: string): any[] {
  const events: any[] = [];
  const lines = sseContent.split('\n');
  const sseDecoder = new SSEDecoder();

  for (const line of lines) {
    const sse = sseDecoder.decode(line);
    if (sse && sse.event !== 'ping') {
      try {
        events.push(JSON.parse(sse.data));
      } catch (e) {
        // Skip malformed JSON data lines
        console.error(`Error parsing SSE data: ${sse.data}`, e);
      }
    }
  }

  // Process any remaining event (in case file doesn't end with empty line)
  const finalSse = sseDecoder.decode('');
  if (finalSse && finalSse.event !== 'ping') {
    try {
      events.push(JSON.parse(finalSse.data));
    } catch (e) {
      // Skip malformed JSON data lines
      console.error(`Error parsing SSE data: ${finalSse.data}`, e);
    }
  }

  return events;
}
