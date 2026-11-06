/**
 * Live integration tests against the real gateway. Gated on `ANTHROPIC_LIVE=1`;
 * the regular suite never hits the network. Expects
 * `ANTHROPIC_GOOGLE_CLOUD_{PROJECT_ID,WORKSPACE_ID}` (or `..._BASE_URL`) and
 * Application Default Credentials in the environment.
 */
import { AnthropicGoogleCloud } from '../src';
import { APIError } from '@anthropic-ai/sdk';

const live = process.env['ANTHROPIC_LIVE'] === '1' ? describe : describe.skip;

const MODEL = 'claude-haiku-4-5';

const newClient = () =>
  new AnthropicGoogleCloud({
    location: process.env['ANTHROPIC_GOOGLE_CLOUD_LOCATION'] ?? 'us-central1',
    maxRetries: 1,
  });

live('AnthropicGoogleCloud — live', () => {
  vi.setConfig({ testTimeout: 60_000 });

  test('non-streaming create', async () => {
    const client = newClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Say hello in one word.' }],
    });

    expect(message.role).toBe('assistant');
    expect(message.content[0]?.type).toBe('text');
    expect(message.usage.output_tokens).toBeGreaterThan(0);
  });

  test('streaming yields the expected event sequence and accumulates a message', async () => {
    const client = newClient();
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Say hello in one word.' }],
    });

    const events: string[] = [];
    for await (const event of stream) {
      events.push(event.type);
    }

    expect(events[0]).toBe('message_start');
    expect(events).toContain('content_block_start');
    expect(events).toContain('content_block_delta');
    expect(events).toContain('content_block_stop');
    expect(events.at(-2)).toBe('message_delta');
    expect(events.at(-1)).toBe('message_stop');

    const final = await stream.finalMessage();
    expect(final.role).toBe('assistant');
    expect(final.content[0]?.type).toBe('text');
  });

  test('an unknown model surfaces a typed APIError', async () => {
    const client = newClient();
    await expect(
      client.messages.create({
        model: 'not-a-real-model',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toBeInstanceOf(APIError);
  });

  test("an organization route returns the client's own workspace", async (ctx) => {
    const client = newClient();
    if (!client.workspaceId) {
      return ctx.skip('Set ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID to run this test');
    }

    const workspace = await client.organization.workspaces.retrieve(client.workspaceId);
    expect(workspace.id).toBe(client.workspaceId);
  });

  // An explicit base URL takes every route, so there is no organization endpoint to check.
  test.skipIf(process.env['ANTHROPIC_GOOGLE_CLOUD_BASE_URL'])(
    'a user profile route lists profiles',
    async () => {
      const { response } = await newClient().userProfiles.list({ limit: 1 }).withResponse();

      expect(response.status).toBe(200);
      expect(new URL(response.url).pathname).toMatch(/\/claudeOrganization\/invoke\/v1\/user_profiles$/);
    },
  );

  test('the Managed Agents routes create, retrieve, list and archive an agent', async () => {
    const client = newClient();
    const agent = await client.beta.agents.create({ model: MODEL, name: 'sdk-live-test' });

    let archived;
    try {
      expect((await client.beta.agents.retrieve(agent.id)).id).toBe(agent.id);
      expect((await client.beta.agents.list({ limit: 1 })).data.length).toBeGreaterThan(0);
    } finally {
      archived = await client.beta.agents.archive(agent.id);
    }
    expect(archived.archived_at).toBeTruthy();
  });
});
