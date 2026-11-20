import Anthropic from '@anthropic-ai/sdk';
import type { JsonValue } from 'streamfold';
import { streamWeatherReport } from '../../examples/streamfold/preview';
import { mockFetch } from './mock-fetch';

function events(chunks: string[]) {
  return [
    {
      type: 'message_start',
      message: {
        id: 'msg_fixture',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-5-5',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 8, output_tokens: 0 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ...chunks.map((text) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })),
    { type: 'content_block_stop', index: 0 },
    {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 20 },
    },
    { type: 'message_stop' },
  ];
}

test('previews incremental values without mutating earlier snapshots and validates the final report', async () => {
  const { fetch, handleStreamEvents } = mockFetch();
  handleStreamEvents(events(['{"city":"Pa', 'ris","forecast":[{"day":"Monday","high":18,"low":10}]}']));
  const previews: (JsonValue | undefined)[] = [];
  const result = await streamWeatherReport(new Anthropic({ apiKey: 'test-key', fetch }), (index, value) => {
    expect(index).toBe(0);
    previews.push(value);
  });
  expect(previews[0]).toEqual({ city: 'Pa' });
  expect(result).toEqual({ city: 'Paris', forecast: [{ day: 'Monday', high: 18, low: 10 }] });
  expect(previews[1]).toEqual(result);
});

test.each([
  ['truncated JSON', '{"city":"Paris","forecast":['],
  ['invalid schema', '{"city":12,"forecast":[]}'],
])('does not return a successful report for %s', async (_name, input) => {
  const { fetch, handleStreamEvents } = mockFetch();
  handleStreamEvents(events([input]));
  await expect(streamWeatherReport(new Anthropic({ apiKey: 'test-key', fetch }), () => {})).rejects.toThrow();
});

test('stops delivery when a preview callback fails', async () => {
  const { fetch, handleStreamEvents } = mockFetch();
  handleStreamEvents(events(['{"city":"Pa', 'ris","forecast":[]}']));
  const seen: (JsonValue | undefined)[] = [];
  const failure = new Error('preview failed');
  await expect(
    streamWeatherReport(new Anthropic({ apiKey: 'test-key', fetch }), (_index, value) => {
      seen.push(value);
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(seen).toEqual([{ city: 'Pa' }]);
});

test('cancels the request without returning a validated report', async () => {
  const { fetch, handleStreamEvents } = mockFetch();
  handleStreamEvents(events(['{"city":"Pa', 'ris","forecast":[]}']));
  const controller = new AbortController();
  await expect(
    streamWeatherReport(
      new Anthropic({ apiKey: 'test-key', fetch }),
      () => controller.abort(),
      controller.signal,
    ),
  ).rejects.toThrow();
});

test('keeps previews from different text blocks separate', async () => {
  const { fetch, handleStreamEvents } = mockFetch();
  const first = events(['{"city":"Paris","forecast":[]}']);
  const second = events(['{"city":"Tokyo","forecast":[]}'])
    .slice(1, -2)
    .map((event) => ({ ...event, index: 1 }));
  handleStreamEvents([...first.slice(0, -2), ...second, ...first.slice(-2)]);
  const previews: [number, JsonValue | undefined][] = [];
  const result = await streamWeatherReport(new Anthropic({ apiKey: 'test-key', fetch }), (index, value) =>
    previews.push([index, value]),
  );
  expect(previews).toEqual([
    [0, { city: 'Paris', forecast: [] }],
    [1, { city: 'Tokyo', forecast: [] }],
  ]);
  expect(result).toEqual({ city: 'Paris', forecast: [] });
});
