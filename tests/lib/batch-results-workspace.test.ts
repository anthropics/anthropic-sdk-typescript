import Anthropic from '@anthropic-ai/sdk';
import { type RequestInit } from '@anthropic-ai/sdk/internal/builtin-types';
import { mockFetch } from './mock-fetch';

function queueBatchResponses(handleRequest: ReturnType<typeof mockFetch>['handleRequest']): RequestInit[] {
  const seen: RequestInit[] = [];
  handleRequest(async (_req, init) => {
    seen.push(init!);
    return new Response(
      JSON.stringify({ id: 'msgbatch_xyz', results_url: '/v1/messages/batches/msgbatch_xyz/results' }),
      { headers: { 'content-type': 'application/json' } },
    );
  });
  handleRequest(async (_req, init) => {
    seen.push(init!);
    return new Response(
      JSON.stringify({ custom_id: 'req_1', result: { type: 'succeeded', message: null } }) + '\n',
      { headers: { 'content-type': 'application/x-jsonl' } },
    );
  });
  return seen;
}

const workspaceHeader = (init: RequestInit) => new Headers(init.headers as any).get('anthropic-workspace-id');

describe('batches.results() workspace_id', () => {
  test.each([
    ['messages.batches', (client: Anthropic) => client.messages.batches],
    ['beta.messages.batches', (client: Anthropic) => client.beta.messages.batches],
  ])('%s forwards workspace_id to both the retrieve and results requests', async (_name, resource) => {
    const { fetch, handleRequest } = mockFetch();
    const client = new Anthropic({ apiKey: 'test-key', baseURL: 'http://localhost', fetch });
    const seen = queueBatchResponses(handleRequest);

    await resource(client).results('msgbatch_xyz', { workspace_id: 'ws-request' });

    expect(seen.map(workspaceHeader)).toEqual(['ws-request', 'ws-request']);
  });

  test('omits the header when workspace_id is unset', async () => {
    const { fetch, handleRequest } = mockFetch();
    const client = new Anthropic({ apiKey: 'test-key', baseURL: 'http://localhost', fetch });
    const seen = queueBatchResponses(handleRequest);

    await client.messages.batches.results('msgbatch_xyz');

    expect(seen.map(workspaceHeader)).toEqual([null, null]);
  });
});
