import { readFileSync } from 'fs';
import { join } from 'path';

export function loadFixture(filename: string): string {
  const fixturePath = join(__dirname, 'fixtures', filename);
  return readFileSync(fixturePath, 'utf-8');
}

export function parseSSEFixture(sseContent: string): any[] {
  const events: any[] = [];
  const lines = sseContent.split('\n');
  let currentEvent: any = {};

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      // If we have a complete event, push it
      if (currentEvent.type && currentEvent.data) {
        events.push(currentEvent.data);
      }
      currentEvent = { type: line.substring(7) };
    } else if (line.startsWith('data: ')) {
      const dataStr = line.substring(6).trim();
      if (dataStr) {
        try {
          currentEvent.data = JSON.parse(dataStr);
        } catch (e) {
          // Skip malformed JSON data lines
        }
      }
    } else if (line.trim() === '') {
      // Empty line indicates end of event
      if (currentEvent.type && currentEvent.data) {
        events.push(currentEvent.data);
        currentEvent = {};
      }
    }
  }

  // Push the last event if it exists
  if (currentEvent.type && currentEvent.data) {
    events.push(currentEvent.data);
  }

  return events;
}
