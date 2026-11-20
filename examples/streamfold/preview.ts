#!/usr/bin/env node

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { IncrementalJsonScanner, type JsonValue } from 'streamfold';
import { z } from 'zod/v4';
import { pathToFileURL } from 'node:url';

const WeatherReport = z.object({
  city: z.string(),
  forecast: z.array(z.object({ day: z.string(), high: z.number(), low: z.number() })),
});

export async function streamWeatherReport(
  client: Anthropic,
  onPreview: (index: number, value: JsonValue | undefined) => void,
  signal?: AbortSignal,
) {
  const stream = client.messages.stream(
    {
      model: 'claude-sonnet-5-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: 'Give an illustrative three-day weather forecast for Paris.' }],
      output_config: { format: zodOutputFormat(WeatherReport) },
    },
    { signal },
  );
  const scanners = new Map<number, IncrementalJsonScanner>();
  try {
    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block.type === 'text') {
        const scanner = new IncrementalJsonScanner({ snapshots: 'immutable' });
        scanners.set(event.index, scanner);
        if (event.content_block.text)
          onPreview(event.index, scanner.push(event.content_block.text).partialValue);
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const scanner = scanners.get(event.index);
        if (scanner) onPreview(event.index, scanner.push(event.delta.text).partialValue);
      } else if (event.type === 'content_block_stop') {
        const scanner = scanners.get(event.index);
        if (scanner) {
          scanner.finish();
          scanner.dispose();
          scanners.delete(event.index);
        }
      }
    }
    const message = await stream.finalMessage();
    if (message.parsed_output === null)
      throw new Error('The response did not contain a validated weather report.');
    return message.parsed_output;
  } finally {
    stream.abort();
    for (const scanner of scanners.values()) scanner.dispose();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  try {
    const report = await streamWeatherReport(
      new Anthropic(),
      (index, preview) => console.log('Unvalidated preview', index, JSON.stringify(preview)),
      controller.signal,
    );
    console.log('Validated report', report);
  } finally {
    process.removeListener('SIGINT', cancel);
  }
}
