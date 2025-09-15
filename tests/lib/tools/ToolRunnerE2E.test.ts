import { Anthropic } from '../../../src';
import { betaZodTool } from '../../../src/helpers/beta/zod';
import * as z from 'zod';
import nock from 'nock';
import { gunzipSync } from 'zlib';
import { RequestInfo } from '@anthropic-ai/sdk/internal/builtin-types';

describe('toolRunner integration tests', () => {
  let client: Anthropic;
  let globalNockDone: (() => void) | undefined;

  beforeAll(async () => {
    // Configure nock for recording/playback
    nock.back.fixtures = __dirname + '/nockFixtures';

    const isRecording = process.env['NOCK_RECORD'] === 'true';
    let apiKey = '';
    if (isRecording) {
      apiKey = process.env['ANTHROPIC_API_KEY']!;
      if (!apiKey) {
        throw new Error('you have to have an API key to run new snapshots');
      }

      nock.back.setMode('record');

      // Configure nock to save readable JSON responses
      nock.back.setMode('record');
      nock.recorder.rec({
        dont_print: true,
        output_objects: true,
        enable_reqheaders_recording: true,
      });
    } else {
      apiKey = 'test-api-key';
      nock.back.setMode('lockdown');
    }

    // Set up global nock recording/playback with custom transformer
    const nockBack = await nock.back('ToolRunner.json', {
      // Custom transformer to decompress gzipped responses
      afterRecord: (scopes) => {
        return scopes.map((scope) => {
          const rawHeaders = (scope as any).rawHeaders as Record<string, string> | undefined;
          if (
            scope.response &&
            Array.isArray(scope.response) &&
            rawHeaders &&
            rawHeaders['content-encoding'] === 'gzip'
          ) {
            try {
              // Decompress the gzipped response
              const compressed = Buffer.from(scope.response[0], 'hex');
              const decompressed = gunzipSync(compressed);
              const jsonResponse = JSON.parse(decompressed.toString());

              // Replace with readable JSON
              scope.response = jsonResponse;

              // Remove gzip header since we decompressed
              delete rawHeaders['content-encoding'];
            } catch (e) {
              // Keep original if decompression fails
              console.error('Failed to decompress response:', e);
            }
          }
          return scope;
        });
      },
    });
    globalNockDone = nockBack.nockDone;

    // Create a nock-compatible fetch function
    const nockCompatibleFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // Use the global fetch (Node.js 18+ or undici) which nock can intercept
      const globalFetch = globalThis.fetch;
      if (!globalFetch) {
        throw new Error(
          'Global fetch is not available. Ensure you are using Node.js 18+ or have undici available.',
        );
      }
      return globalFetch(input, init);
    };

    client = new Anthropic({
      apiKey: apiKey,
      fetch: nockCompatibleFetch,
    });
  });

  afterAll(() => {
    if (globalNockDone) {
      globalNockDone();
    }
  });

  // Helper functions for creating common test tools
  function createTestTool(
    customConfig: Partial<{
      name: string;
      inputSchema: z.ZodType;
      description: string;
      run: (args: any) => any;
    }> = {},
  ) {
    return betaZodTool({
      name: 'test_tool',
      inputSchema: z.object({ value: z.string() }),
      description: 'A test tool',
      run: () => 'Tool result',
      ...customConfig,
    });
  }

  function createCounterTool() {
    return betaZodTool({
      name: 'test_tool',
      inputSchema: z.object({ count: z.number() }),
      description: 'A test tool',
      run: (args) => `Called with ${args.count}`,
    });
  }

  it('should answer tools and run until completion', async () => {
    const tool = createTestTool();

    const runner = client.beta.messages.toolRunner({
      model: 'claude-sonnet-4-0',
      max_tokens: 1000,
      max_iterations: 5, // High limit, should stop before reaching it
      messages: [
        { role: 'user', content: 'Use the test_tool with value "test", then provide a final response' },
      ],
      tools: [tool],
    });

    const messages = [];
    for await (const message of runner) {
      messages.push(message);
    }

    // Should have exactly 2 messages: tool use + final response
    expect(messages).toHaveLength(2);

    // First message should contain one tool use
    const firstMessage = messages[0]!;
    expect(firstMessage.role).toBe('assistant');
    expect(firstMessage.content).toHaveLength(2); // text + tool_use

    const toolUseBlocks = firstMessage.content.filter((block) => block.type === 'tool_use');
    expect(toolUseBlocks).toHaveLength(1);
    expect(toolUseBlocks[0]!.name).toBe('test_tool');
    expect(toolUseBlocks[0]!.input).toEqual({ value: 'test' });
    expect(firstMessage.stop_reason).toBe('tool_use');

    // Second message should be final response
    const secondMessage = messages[1]!;
    expect(secondMessage.role).toBe('assistant');
    expect(secondMessage.content).toHaveLength(1);
    expect(secondMessage.content[0]!.type).toBe('text');
    expect(secondMessage.stop_reason).toBe('end_turn');
  });

  describe('max_iterations', () => {
    it('should respect max_iterations limit', async () => {
      const tool = createCounterTool();

      const runner = client.beta.messages.toolRunner({
        model: 'claude-sonnet-4-0',
        max_tokens: 1000,
        max_iterations: 2,
        messages: [
          { role: 'user', content: 'Use the test_tool with count 1, then use it again with count 2' },
        ],
        tools: [tool],
      });

      const messages = [];
      for await (const message of runner) {
        messages.push(message);
      }

      // Should have exactly 2 messages due to max_iterations limit
      expect(messages).toHaveLength(2);

      // First message should contain tool uses
      const firstMessage = messages[0]!;
      expect(firstMessage.role).toBe('assistant');
      expect(firstMessage.content).toHaveLength(3); // text + 2 tool_use blocks

      const toolUseBlocks = firstMessage.content.filter((block) => block.type === 'tool_use');
      expect(toolUseBlocks).toHaveLength(2);
      expect(toolUseBlocks[0]!.name).toBe('test_tool');
      expect(toolUseBlocks[0]!.input).toEqual({ count: 1 });
      expect(toolUseBlocks[1]!.name).toBe('test_tool');
      expect(toolUseBlocks[1]!.input).toEqual({ count: 2 });

      // Second message should be final response
      const secondMessage = messages[1]!;
      expect(secondMessage.role).toBe('assistant');
      expect(secondMessage.content).toHaveLength(1);
      expect(secondMessage.content[0]!.type).toBe('text');
      expect(secondMessage.stop_reason).toBe('end_turn');
    });
  });

  describe('done()', () => {
    it('should consume the iterator and return final message', async () => {
      const tool = createTestTool({ inputSchema: z.object({ input: z.string() }) });

      const runner = client.beta.messages.toolRunner({
        model: 'claude-sonnet-4-0',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: 'Use the test_tool with input "test", then provide a final response' },
        ],
        tools: [tool],
      });

      const finalMessage = await runner.runUntilDone();

      // Final message should be the last text-only response
      expect(finalMessage.role).toBe('assistant');
      expect(finalMessage.content).toHaveLength(1);
      expect(finalMessage.content[0]).toHaveProperty('type', 'text');
      expect(finalMessage.stop_reason).toBe('end_turn');
    });
  });

  describe('setMessagesParams()', () => {
    it('should update parameters using direct assignment', async () => {
      const tool = createTestTool();

      const runner = client.beta.messages.toolRunner({
        model: 'claude-sonnet-4-0',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [tool],
      });

      // Update parameters
      runner.setMessagesParams({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        messages: [{ role: 'user', content: 'Updated message' }],
        tools: [tool],
      });

      const params = runner.params;
      expect(params.model).toBe('claude-3-5-haiku-20241022');
      expect(params.max_tokens).toBe(500);
      expect(params.messages).toEqual([{ role: 'user', content: 'Updated message' }]);
    });
  });
});
