# Offline checks for the Loom memory example

These checks compile and execute the complete program extracted from [loom.md](loom.md). Both real clients use injected HTTP responses. They verify native memory-tool dispatch and application scope, not a running server's authorization or persistence.

The same fixed extractor and project configuration are used by the installation recipe and required CI job.

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Agent } from '@clickhouse/loom';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { runMemoryPrompt } from './loom-memory.ts';

type RequestBody = {
  messages: Array<{ role: string; content: unknown }>;
  tools: Array<{ name: string; type: string }>;
  tool_choice: { type: string; disable_parallel_tool_use: boolean };
};

function response(content: unknown[], stopReason = 'end_turn'): Response {
  return Response.json({
    id: 'msg_memory_test',
    type: 'message',
    role: 'assistant',
    model: 'example-model',
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  });
}

function provider(commands: unknown[]) {
  const requests: RequestBody[] = [];
  let index = 0;
  const client = new Anthropic({
    apiKey: 'synthetic-example-key',
    maxRetries: 0,
    fetch: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)) as RequestBody);
      if (index % 2 === 0) {
        const input = commands[index / 2];
        if (input === undefined) throw new Error('Unexpected model request');
        index++;
        return response([{ type: 'tool_use', id: `tool_${index}`, name: 'memory', input }], 'tool_use');
      }
      index++;
      return response([{ type: 'text', text: 'Synthetic response.' }]);
    },
  });
  return { client, requests };
}

function storage(refuseWrite = false) {
  const documents = new Map<string, string>();
  const calls: Array<{ op: string; body: Record<string, unknown> }> = [];
  const agent = new Agent('example-org', 'example-namespace', 'claude-memory-example', {
    baseUrl: 'https://loom.example',
    apiKey: 'synthetic-example-token',
    logLevel: 'off',
    retry: { maxAttempts: 1 },
    fetch: async (url, init) => {
      const op = new URL(url).pathname;
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      calls.push({ op, body });
      const uri = String(body['source_uri']);
      if (op === '/v1/knowledge.upsert') {
        if (refuseWrite) return Response.json({ detail: 'Not authorized' }, { status: 403 });
        documents.set(uri, String(body['content']));
        return Response.json({});
      }
      if (op === '/v1/knowledge.get') {
        return Response.json({ found: documents.has(uri), source_uri: uri, content: documents.get(uri) });
      }
      if (op === '/v1/knowledge.list') {
        const prefixes = body['uri_prefix'] as string[];
        return Response.json({
          rows: [...documents.keys()]
            .filter((path) => prefixes.some((prefix) => path.startsWith(prefix)))
            .map((source_uri) => ({ source_uri })),
          next_cursor: null,
        });
      }
      throw new Error('Unexpected storage operation');
    },
  });
  return { agent, calls, documents };
}

function result(request: RequestBody | undefined): { is_error?: boolean; content?: unknown } {
  const last = request?.messages.at(-1)?.content;
  if (!Array.isArray(last) || last.length !== 1) throw new Error('Expected one native tool result');
  return last[0] as { is_error?: boolean; content?: unknown };
}

const create = {
  command: 'create',
  path: '/memories/preferences.md',
  file_text: 'I prefer tea.',
  org: 'model-cannot-select-this-org',
  namespace: 'model-cannot-select-this-namespace',
};
const view = { command: 'view', path: '/memories/preferences.md' };

// Keep these offline checks independent of the developer's optional mentor setting.
const mentorBrief = process.env['LOOM_MENTOR_BRIEF'];
before(() => {
  process.env['LOOM_MENTOR_BRIEF'] = 'off';
});
after(() => {
  if (mentorBrief === undefined) delete process.env['LOOM_MENTOR_BRIEF'];
  else process.env['LOOM_MENTOR_BRIEF'] = mentorBrief;
});

test('native dispatch shares a document across fresh histories with fixed application scope', async () => {
  const { client, requests } = provider([create, view]);
  const { agent, calls, documents } = storage();
  await runMemoryPrompt(client, agent, 'Remember my preference.', 'example-model', 'example-store');
  await runMemoryPrompt(client, agent, 'Read my preference.', 'example-model', 'example-store');
  assert.deepEqual(requests[0]?.tools, [{ name: 'memory', type: 'memory_20250818' }]);
  for (const request of requests) {
    assert.deepEqual(request.tool_choice, { type: 'auto', disable_parallel_tool_use: true });
  }
  assert.deepEqual(requests[0]?.messages, [{ role: 'user', content: 'Remember my preference.' }]);
  assert.deepEqual(requests[2]?.messages, [{ role: 'user', content: 'Read my preference.' }]);
  assert.notEqual(result(requests[1]).is_error, true);
  assert.match(String(result(requests[3]).content), /I prefer tea\./);
  assert.equal(documents.get('loom-memory://example-store/memories/preferences.md'), 'I prefer tea.');
  assert.ok(calls.length > 0);
  for (const { body } of calls) {
    assert.equal(body['org'], 'example-org');
    assert.equal(body['namespace'], 'example-namespace');
  }
});

test('a path outside memories is a native tool error before storage I/O', async () => {
  const { client, requests } = provider([{ command: 'view', path: '/memories/../../outside' }]);
  const { agent, calls } = storage();
  await runMemoryPrompt(client, agent, 'Read an invalid path.', 'example-model', 'example-store');
  assert.equal(result(requests[1]).is_error, true);
  assert.deepEqual(calls, []);
});

test('a refused write is returned as a native error and writes no document', async () => {
  const { client, requests } = provider([create]);
  const { agent, calls, documents } = storage(true);
  await runMemoryPrompt(client, agent, 'Remember my preference.', 'example-model', 'example-store');
  assert.equal(result(requests[1]).is_error, true);
  assert.deepEqual(
    calls.map(({ op }) => op),
    ['/v1/knowledge.get', '/v1/knowledge.list', '/v1/knowledge.upsert'],
  );
  assert.equal(documents.size, 0);
});

test('another store does not read the first store through the memory tool', async () => {
  const { client, requests } = provider([create, view]);
  const { agent, calls } = storage();
  await runMemoryPrompt(client, agent, 'Remember my preference.', 'example-model', 'first-store');
  const firstCallCount = calls.length;
  await runMemoryPrompt(client, agent, 'Read my preference.', 'example-model', 'second-store');
  assert.equal(result(requests[3]).is_error, true);
  assert.ok(!String(result(requests[3]).content).includes('I prefer tea.'));
  for (const { body } of calls.slice(firstCallCount)) {
    if (body['source_uri']) assert.ok(String(body['source_uri']).startsWith('loom-memory://second-store/'));
    if (body['uri_prefix'])
      assert.deepEqual(body['uri_prefix'], ['loom-memory://second-store/memories/preferences.md/']);
  }
});

test('an invalid application store refuses before either client makes a request', async () => {
  const { client, requests } = provider([]);
  const { agent, calls } = storage();
  await assert.rejects(runMemoryPrompt(client, agent, 'Read memory.', 'example-model', 'invalid/store'));
  assert.deepEqual(requests, []);
  assert.deepEqual(calls, []);
});
```
