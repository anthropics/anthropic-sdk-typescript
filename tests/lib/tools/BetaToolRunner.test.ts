import Anthropic, { BetaFallbackState, type ClientOptions, type Middleware } from '@anthropic-ai/sdk';
import { mockFetch } from '../../lib/mock-fetch';
import {
  BetaMessage,
  BetaMessageParam,
  BetaContentBlock,
  BetaContentBlockParam,
  BetaStopReason,
  BetaToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/beta';
import { BetaRunnableTool, BetaToolRunContext } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { BetaRawMessageStreamEvent, ToolError } from '@anthropic-ai/sdk/resources/beta/messages';
import { Fetch } from '@anthropic-ai/sdk/internal/builtin-types';
import { SDK_HELPER_SYMBOL } from '../../../src/internal/stainless-helper-header';

const weatherTool: BetaRunnableTool<{ location: string }> = {
  type: 'custom',
  name: 'getWeather',
  description: 'Get weather',
  input_schema: { type: 'object', properties: { location: { type: 'string' } } },
  run: async ({ location }) => `Sunny in ${location}`,
  parse: (input: unknown) => input as { location: string },
};

const calculatorTool: BetaRunnableTool<{ a: number; b: number; operation: string }> = {
  type: 'custom',
  name: 'calculate',
  description: 'Perform calculations',
  input_schema: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' },
      operation: { type: 'string', enum: ['add', 'multiply'] },
    },
  },
  run: async ({ a, b, operation }) => {
    if (operation === 'add') return String(a + b);
    if (operation === 'multiply') return String(a * b);
    throw new Error(`Unknown operation: ${operation}`);
  },
  parse: (input: unknown) => input as { a: number; b: number; operation: string },
};

// Helper functions to create content blocks
function getWeatherToolUse(location: string, id: string = 'tool_1'): BetaContentBlock {
  return { type: 'tool_use', id, name: 'getWeather', input: { location } };
}

// Response content goes back as request content unchanged; the assertion is needed until the
// generated request and response types of the `tool_listing` block agree.
function assistantTurn(content: BetaContentBlock[]): BetaMessageParam {
  return { role: 'assistant', content: content as BetaContentBlockParam[] };
}

function getWeatherToolResult(location: string, id: string = 'tool_1'): BetaToolResultBlockParam {
  return { type: 'tool_result', tool_use_id: id, content: `Sunny in ${location}` };
}

function getCalculatorToolUse(
  a: number,
  b: number,
  operation: string,
  id: string = 'tool_2',
): BetaContentBlock {
  return {
    type: 'tool_use',
    id,
    name: 'calculate',
    input: { a, b, operation },
  };
}

function getCalculatorToolResult(
  a: number,
  b: number,
  operation: string,
  id: string = 'tool_2',
): BetaToolResultBlockParam {
  let result: string;
  if (operation === 'add') {
    result = String(a + b);
  } else if (operation === 'multiply') {
    result = String(a * b);
  } else {
    result = `Error: Unknown operation: ${operation}`;
  }
  return {
    type: 'tool_result',
    tool_use_id: id,
    content: result,
  };
}

function getTextContent(text?: string): BetaContentBlock {
  return {
    type: 'text',
    text: text || 'Some text content',
    citations: null,
  };
}

function assistantMessage(
  stop_reason: BetaMessage['stop_reason'],
  ...content: BetaContentBlock[]
): BetaMessage {
  return {
    id: `msg_${stop_reason}`,
    type: 'message',
    role: 'assistant',
    content,
    model: 'claude-3-5-sonnet-latest',
    stop_details: null,
    stop_reason,
    stop_sequence: null,
    container: null,
    context_management: null,
    diagnostics: null,
    usage: {
      input_tokens: 10,
      output_tokens: 20,
      output_tokens_details: null,
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      fallback_credit: null,
      server_tool_use: null,
      service_tier: null,
      inference_geo: null,
      iterations: null,
      speed: null,
    },
  };
}

function betaMessageToStreamEvents(message: BetaMessage): BetaRawMessageStreamEvent[] {
  const events: BetaRawMessageStreamEvent[] = [];

  events.push({
    type: 'message_start',
    message: {
      id: message.id,
      type: message.type,
      role: message.role,
      model: message.model,
      content: [],
      stop_details: null,
      stop_reason: null,
      stop_sequence: null,
      container: null,
      context_management: null,
      diagnostics: null,
      usage: {
        cache_creation: null,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        fallback_credit: null,
        input_tokens: message.usage.input_tokens,
        output_tokens: 0,
        output_tokens_details: null,
        server_tool_use: null,
        service_tier: null,
        inference_geo: null,
        iterations: null,
        speed: null,
      },
    },
  });

  message.content.forEach((block, index) => {
    if (block.type === 'text') {
      events.push({
        type: 'content_block_start',
        index,
        content_block: { type: 'text', text: '', citations: null },
      });

      // Text deltas - always chunked
      // Simulate chunked streaming by splitting text
      const words = block.text.split(' ');
      const chunks = [];
      for (let i = 0; i < words.length; i += 2) {
        chunks.push(words.slice(i, i + 2).join(' ') + (i + 2 < words.length ? ' ' : ''));
      }
      chunks.forEach((chunk) => {
        if (chunk) {
          events.push({
            type: 'content_block_delta',
            index,
            delta: { type: 'text_delta', text: chunk },
          });
        }
      });
    } else if (block.type === 'compaction') {
      events.push({ type: 'content_block_start', index, content_block: { ...block, content: null } });
      events.push({
        type: 'content_block_delta',
        index,
        delta: {
          type: 'compaction_delta',
          content: block.content,
          encrypted_content: block.encrypted_content,
        },
      });
    } else if (block.type === 'tool_use' || block.type === 'server_tool_use') {
      events.push({
        type: 'content_block_start',
        index,
        content_block: { ...block, input: {} },
      });

      // Input JSON deltas - always chunked
      const jsonStr = JSON.stringify(block.input);
      // Simulate chunked JSON streaming
      const chunkSize = Math.ceil(jsonStr.length / 3);
      for (let i = 0; i < jsonStr.length; i += chunkSize) {
        events.push({
          type: 'content_block_delta',
          index,
          delta: {
            type: 'input_json_delta',
            partial_json: jsonStr.slice(i, i + chunkSize),
          },
        });
      }
    } else {
      events.push({ type: 'content_block_start', index, content_block: block });
    }

    events.push({
      type: 'content_block_stop',
      index,
    });
  });

  events.push({
    type: 'message_delta',
    delta: {
      stop_details: message.stop_details,
      stop_reason: message.stop_reason,
      container: message.container,
      stop_sequence: message.stop_sequence,
    },
    context_management: null,
    usage: {
      output_tokens: message.usage?.output_tokens || 0,
      output_tokens_details: null,
      input_tokens: message.usage?.input_tokens || 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      fallback_credit: null,
      server_tool_use: null,
      iterations: null,
    },
  });

  events.push({
    type: 'message_stop',
  });

  return events;
}

// Queues `message` as the next response (JSON or SSE) and records the request body it answered.
function reply(
  handleRequest: (handler: Fetch) => void,
  bodies: Array<Record<string, unknown>>,
  message: BetaMessage,
  stream: boolean,
) {
  handleRequest(async (_req, init) => {
    bodies.push(JSON.parse(init!.body as string));
    if (!stream) {
      return new Response(JSON.stringify(message), { headers: { 'content-type': 'application/json' } });
    }
    const sse = betaMessageToStreamEvents(message)
      .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      .join('');
    return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
  });
}

// Overloaded setupTest function for both streaming and non-streaming
interface SetupTestResult<Stream extends boolean> {
  runner: Anthropic.Beta.Messages.BetaToolRunner<Stream>;
  fetch: ReturnType<typeof mockFetch>['fetch'];
  handleRequest: (fetch: Fetch) => void;
  handleAssistantMessage: (...content: BetaContentBlock[]) => BetaMessage;
  handleAssistantMessageStream: (...content: BetaContentBlock[]) => BetaMessage;
}

type ToolRunnerParams = Parameters<typeof Anthropic.Beta.Messages.prototype.toolRunner>[0];

function setupTest(
  params?: Partial<ToolRunnerParams> & { stream?: false },
  clientOptions?: ClientOptions,
): SetupTestResult<false>;
function setupTest(
  params: Partial<ToolRunnerParams> & { stream: true },
  clientOptions?: ClientOptions,
): SetupTestResult<true>;
function setupTest(
  params: Partial<ToolRunnerParams> = {},
  clientOptions: ClientOptions = {},
): SetupTestResult<boolean> {
  const { handleRequest, handleStreamEvents, fetch } = mockFetch();
  let messageIdCounter = 0;

  const handleAssistantMessage = (...content: BetaContentBlock[]) => {
    const hasToolUse = content.some((block) => block.type === 'tool_use' || block.type === 'server_tool_use');
    const stop_reason = hasToolUse ? 'tool_use' : 'end_turn';

    const message: BetaMessage = {
      id: `msg_${messageIdCounter++}`,
      type: 'message',
      role: 'assistant',
      content,
      model: 'claude-3-5-sonnet-latest',
      stop_details: null,
      stop_reason,
      stop_sequence: null,
      container: null,
      context_management: null,
      diagnostics: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        output_tokens_details: null,
        cache_creation: null,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        fallback_credit: null,
        server_tool_use: null,
        service_tier: null,
        inference_geo: null,
        iterations: null,
        speed: null,
      },
    };
    handleRequest(async () => {
      return new Response(JSON.stringify(message), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    return message;
  };

  const handleAssistantMessageStream = (...content: BetaContentBlock[]) => {
    const hasToolUse = content.some((block) => block.type === 'tool_use' || block.type === 'server_tool_use');
    const stop_reason = hasToolUse ? 'tool_use' : 'end_turn';

    const message: BetaMessage = {
      id: `msg_${messageIdCounter++}`,
      type: 'message',
      role: 'assistant',
      content,
      model: 'claude-3-5-sonnet-latest',
      stop_details: null,
      stop_reason,
      stop_sequence: null,
      container: null,
      context_management: null,
      diagnostics: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        output_tokens_details: null,
        cache_creation: null,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        fallback_credit: null,
        server_tool_use: null,
        service_tier: null,
        inference_geo: null,
        iterations: null,
        speed: null,
      },
    };

    handleStreamEvents(betaMessageToStreamEvents(message));
    return message;
  };

  const client = new Anthropic({ apiKey: 'test-key', fetch: fetch, maxRetries: 0, ...clientOptions });

  const runnerParams: ToolRunnerParams = {
    messages: params.messages || [{ role: 'user', content: 'What is the weather?' }],
    model: params.model || 'claude-3-5-sonnet-latest',
    max_tokens: params.max_tokens || 1000,
    tools: params.tools || [weatherTool],
    ...params,
  };

  const runner = client.beta.messages.toolRunner(runnerParams);

  return {
    runner,
    fetch,
    handleRequest,
    handleAssistantMessage,
    handleAssistantMessageStream,
  };
}

async function expectEvent<T>(iterator: AsyncIterator<T>, assertions?: (event: T) => void | Promise<void>) {
  const result = await iterator.next();
  expect(result.done).toBe(false);
  if (!result.done) {
    await assertions?.(result.value);
  }
}

async function expectDone<T>(iterator: AsyncIterator<T>) {
  const result = await iterator.next();
  expect(result.done).toBe(true);
  expect(result.value).toBeUndefined();
}

describe('ToolRunner', () => {
  it('throws when consumed multiple times', async () => {
    const { runner, handleAssistantMessage } = setupTest();

    // First consumption - get the iterator explicitly
    handleAssistantMessage(getTextContent());
    await runner[Symbol.asyncIterator]().next();

    // Second attempt to get iterator should throw
    handleAssistantMessage(getTextContent());
    await expect(async () => await runner[Symbol.asyncIterator]().next()).rejects.toThrow(
      'Cannot iterate over a consumed stream',
    );
  });

  describe('iterator.next()', () => {
    it('yields BetaMessage', async () => {
      const { runner, handleAssistantMessage } = setupTest();

      const iterator = runner[Symbol.asyncIterator]();

      handleAssistantMessage(getWeatherToolUse('SF'));
      await expectEvent(iterator, (message) => {
        expect(message.content).toMatchObject([getWeatherToolUse('SF')]);
      });

      handleAssistantMessage(getTextContent());
      await expectEvent(iterator, (message) => {
        expect(message.content).toMatchObject([getTextContent()]);
      });

      await expectDone(iterator);
    });

    it('yields BetaMessageStream when stream=true', async () => {
      const { runner, handleAssistantMessageStream } = setupTest({ stream: true });

      const iterator = runner[Symbol.asyncIterator]();

      // First iteration: assistant requests tool (using helper that generates proper stream events)
      handleAssistantMessageStream(getWeatherToolUse('SF'));
      await expectEvent(iterator, async (stream) => {
        expect(stream.constructor.name).toBe('BetaMessageStream');
        const events = [];
        for await (const event of stream) {
          events.push(event);
        }
        // Verify we get the expected number of events (with chunked JSON, we'll get more deltas), but we
        // should get at least 6 including
        expect(events.length).toBeGreaterThanOrEqual(6);
      });

      // Second iteration: assistant provides final response
      handleAssistantMessageStream(getTextContent());
      const result2 = await iterator.next();
      expect(result2.done).toBe(false);

      const stream2 = result2.value;
      const events2 = [];
      for await (const event of stream2) {
        events2.push(event);
      }

      // With chunked text, we'll get multiple text_delta events
      expect(events2.length).toBeGreaterThanOrEqual(6);
      const textDeltas = events2.filter((e) => e.type === 'content_block_delta');
      expect(textDeltas.length).toBeGreaterThanOrEqual(1);

      await expectDone(iterator);
    });

    it('handles multiple tools', async () => {
      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Get weather and calculate 2+3' }],
        tools: [weatherTool, calculatorTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      handleAssistantMessage(getWeatherToolUse('NYC'), getCalculatorToolUse(2, 3, 'add'));
      await expectEvent(iterator, (message) => {
        expect(message.content).toHaveLength(2);
        expect(message.content).toMatchObject([getWeatherToolUse('NYC'), getCalculatorToolUse(2, 3, 'add')]);
      });

      // Assistant provides final response
      handleAssistantMessage(getTextContent());
      await expectEvent(iterator, (message) => {
        expect(message.content).toMatchObject([getTextContent()]);
      });

      // Check that we have both tool results in the messages
      // Second message should be assistant with tool uses
      // Third message should be user with both tool results
      const messages = runner.params.messages;
      expect(messages).toHaveLength(3); // user message, assistant with tools, user with results
      expect(messages[1]).toMatchObject({
        role: 'assistant',
        content: [getWeatherToolUse('NYC'), getCalculatorToolUse(2, 3, 'add')],
      });
      expect(messages[2]).toMatchObject({
        role: 'user',
        content: [getWeatherToolResult('NYC'), getCalculatorToolResult(2, 3, 'add', 'tool_2')],
      });

      await expectDone(iterator);
    });

    it('handles missing tool', async () => {
      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Use a tool' }],
        tools: [weatherTool], // Only weather tool available
      });

      const iterator = runner[Symbol.asyncIterator]();

      // Assistant requests a tool that doesn't exist
      handleAssistantMessage({
        type: 'tool_use',
        id: 'tool_1',
        name: 'unknownTool',
        input: { param: 'value' },
      });
      await expectEvent(iterator, (message) => {
        expect(message.content[0]).toMatchObject({
          type: 'tool_use',
          name: 'unknownTool',
        });
      });

      // The tool response should contain an error
      handleAssistantMessage(getTextContent());
      await expectEvent(iterator, (message) => {
        expect(message.content).toMatchObject([getTextContent()]);
      });

      await expectDone(iterator);
    });

    it('treats a tool_use for a mid-conversation removed tool like an undefined tool', async () => {
      const run = vi.fn(async ({ location }: { location: string }) => `Sunny in ${location}`);
      const trackedWeatherTool: BetaRunnableTool<{ location: string }> = { ...weatherTool, run };

      // Baseline: the model calls a tool that was never defined in `tools`.
      const undefinedRun = setupTest({
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [calculatorTool],
      });
      const undefinedIterator = undefinedRun.runner[Symbol.asyncIterator]();
      undefinedRun.handleAssistantMessage(getWeatherToolUse('SF'));
      await expectEvent(undefinedIterator);
      undefinedRun.handleAssistantMessage(getTextContent());
      await expectEvent(undefinedIterator);
      await expectDone(undefinedIterator);
      const undefinedResult = undefinedRun.runner.params.messages[2];

      // The tool is defined, but a preceding system message withdrew it.
      const { runner, handleAssistantMessage } = setupTest({
        messages: [
          { role: 'user', content: 'What is the weather?' },
          {
            role: 'system',
            content: [{ type: 'tool_removal', tool: { type: 'tool_reference', name: 'getWeather' } }],
          },
        ],
        tools: [trackedWeatherTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      handleAssistantMessage(getWeatherToolUse('SF'));
      await expectEvent(iterator);

      handleAssistantMessage(getTextContent());
      await expectEvent(iterator, (message) => {
        expect(message.content).toMatchObject([getTextContent()]);
      });

      expect(run).not.toHaveBeenCalled();
      expect(runner.params.messages).toHaveLength(4); // user, system removal, assistant tool_use, user tool_result
      expect(runner.params.messages[3]).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_1',
            content: `Error: Tool 'getWeather' not found`,
            is_error: true,
          },
        ],
      });
      // Removed tools produce exactly the same result as tools that were never defined.
      expect(runner.params.messages[3]).toEqual(undefinedResult);

      await expectDone(iterator);
    });

    it('re-enables a removed tool after a later tool_addition', async () => {
      const run = vi.fn(async ({ location }: { location: string }) => `Sunny in ${location}`);
      const trackedWeatherTool: BetaRunnableTool<{ location: string }> = { ...weatherTool, run };

      const { runner, handleAssistantMessage } = setupTest({
        messages: [
          { role: 'user', content: 'What is the weather?' },
          {
            role: 'system',
            content: [{ type: 'tool_removal', tool: { type: 'tool_reference', name: 'getWeather' } }],
          },
          {
            role: 'system',
            content: [{ type: 'tool_addition', tool: { type: 'tool_reference', name: 'getWeather' } }],
          },
        ],
        tools: [trackedWeatherTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      handleAssistantMessage(getWeatherToolUse('SF'));
      await expectEvent(iterator);

      handleAssistantMessage(getTextContent());
      await expectEvent(iterator);

      expect(run).toHaveBeenCalledWith({ location: 'SF' }, expect.anything());
      expect(runner.params.messages.at(-1)).toMatchObject({
        role: 'user',
        content: [getWeatherToolResult('SF')],
      });

      await expectDone(iterator);
    });

    it('re-enables a removed tool after a later tool_addition that carries its definition', async () => {
      const run = vi.fn(async ({ location }: { location: string }) => `Sunny in ${location}`);
      const trackedWeatherTool: BetaRunnableTool<{ location: string }> = { ...weatherTool, run };

      const { runner, handleAssistantMessage } = setupTest({
        messages: [
          { role: 'user', content: 'What is the weather?' },
          {
            role: 'system',
            content: [{ type: 'tool_removal', tool: { type: 'tool_reference', name: 'getWeather' } }],
          },
          {
            role: 'system',
            content: [
              {
                type: 'tool_addition',
                tool: {
                  type: 'tool_definition',
                  definition: { type: 'mcp_toolset', mcp_server_name: 'docs' },
                },
              },
              {
                type: 'tool_addition',
                tool: {
                  type: 'tool_definition',
                  definition: {
                    name: 'getWeather',
                    description: 'Get weather',
                    input_schema: weatherTool.input_schema,
                  },
                },
              },
            ],
          },
        ],
        tools: [trackedWeatherTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      handleAssistantMessage(getWeatherToolUse('SF'));
      await expectEvent(iterator);

      handleAssistantMessage(getTextContent());
      await expectEvent(iterator);

      expect(run).toHaveBeenCalledWith({ location: 'SF' }, expect.anything());

      await expectDone(iterator);
    });

    it('honors a tool_removal carried in a compaction block', async () => {
      const run = vi.fn(async ({ location }: { location: string }) => `Sunny in ${location}`);
      const trackedWeatherTool: BetaRunnableTool<{ location: string }> = { ...weatherTool, run };

      const { runner, handleAssistantMessage } = setupTest({
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'compaction',
                content: 'Earlier turns, summarized.',
                tool_changes: [
                  { type: 'tool_removal', tool: { type: 'tool_reference', name: 'getWeather' } },
                ],
              },
            ],
          },
          { role: 'user', content: 'What is the weather?' },
        ],
        tools: [trackedWeatherTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      handleAssistantMessage(getWeatherToolUse('SF'));
      await expectEvent(iterator);

      handleAssistantMessage(getTextContent());
      await expectEvent(iterator);

      expect(run).not.toHaveBeenCalled();
      expect(runner.params.messages[3]).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_1',
            content: `Error: Tool 'getWeather' not found`,
            is_error: true,
          },
        ],
      });

      await expectDone(iterator);
    });

    it('handles tool execution errors', async () => {
      const errorTool: BetaRunnableTool<{ shouldFail: boolean }> = {
        type: 'custom',
        name: 'errorTool',
        description: 'Tool that can fail',
        input_schema: { type: 'object', properties: { shouldFail: { type: 'boolean' } } },
        run: async ({ shouldFail }) => {
          if (shouldFail) throw new Error('Tool execution failed');
          return 'Success';
        },
        parse: (input: unknown) => input as { shouldFail: boolean },
      };

      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Test error handling' }],
        tools: [errorTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      // Assistant requests the error tool with failure flag
      handleAssistantMessage({
        type: 'tool_use',
        id: 'tool_1',
        name: 'errorTool',
        input: { shouldFail: true },
      });
      await expectEvent(iterator, (message) => {
        expect(message.content[0]).toMatchObject({
          type: 'tool_use',
          name: 'errorTool',
        });
      });

      // Assistant handles the error
      handleAssistantMessage(getTextContent());
      await expectEvent(iterator, (message) => {
        expect(message.content[0]).toMatchObject(getTextContent());
      });

      // Check that the tool error was properly added to the messages
      expect(runner.params.messages).toHaveLength(3);
      expect(runner.params.messages[2]).toMatchObject({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_1',
            content: expect.stringContaining('Error: Tool execution failed'),
            is_error: true,
          },
        ],
      });

      await expectDone(iterator);
    });

    it('handles ToolError with structured content', async () => {
      const toolErrorTool: BetaRunnableTool<{ shouldFail: boolean }> = {
        type: 'custom',
        name: 'toolErrorTool',
        description: 'Tool that throws ToolError',
        input_schema: { type: 'object', properties: { shouldFail: { type: 'boolean' } } },
        run: async ({ shouldFail }) => {
          if (shouldFail) {
            throw new ToolError([
              { type: 'text', text: 'Something went wrong' },
              { type: 'text', text: 'Here are more details' },
            ]);
          }
          return 'Success';
        },
        parse: (input: unknown) => input as { shouldFail: boolean },
      };

      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Test ToolError handling' }],
        tools: [toolErrorTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      // Assistant requests the tool with failure flag
      handleAssistantMessage({
        type: 'tool_use',
        id: 'tool_1',
        name: 'toolErrorTool',
        input: { shouldFail: true },
      });
      await expectEvent(iterator, (message) => {
        expect(message.content[0]).toMatchObject({
          type: 'tool_use',
          name: 'toolErrorTool',
        });
      });

      // Assistant handles the error
      handleAssistantMessage(getTextContent());
      await expectEvent(iterator, (message) => {
        expect(message.content[0]).toMatchObject(getTextContent());
      });

      // Check that the ToolError content was properly added to the messages
      expect(runner.params.messages).toHaveLength(3);
      expect(runner.params.messages[2]).toMatchObject({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_1',
            content: [
              { type: 'text', text: 'Something went wrong' },
              { type: 'text', text: 'Here are more details' },
            ],
            is_error: true,
          },
        ],
      });

      await expectDone(iterator);
    });

    it('handles api errors streaming', async () => {
      const { runner, handleRequest, handleAssistantMessageStream } = setupTest({
        messages: [{ role: 'user', content: 'Test error handling' }],
        tools: [weatherTool],
        stream: true,
      });

      handleRequest(async () => {
        return new Response(null, {
          status: 400,
        });
      });
      const iterator1 = runner[Symbol.asyncIterator]();
      await expectEvent(iterator1, async (stream) => {
        await expect(stream.finalMessage()).rejects.toThrow('400');
      });
      await expect(iterator1.next()).rejects.toThrow('400');
      await expectDone(iterator1);

      // We let you consume the iterator again to continue the conversation when there is an error.
      handleAssistantMessageStream(getTextContent());
      const iterator2 = runner[Symbol.asyncIterator]();
      await expectEvent(iterator2, async (message) => {
        await expect(message.finalMessage()).resolves.toMatchObject({ content: [getTextContent()] });
      });
      await expectDone(iterator2);
    });

    it('handles api errors', async () => {
      const { runner, handleRequest, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Test error handling' }],
        tools: [weatherTool],
      });

      handleRequest(async () => {
        return new Response(null, {
          status: 500,
        });
      });
      const iterator1 = runner[Symbol.asyncIterator]();
      await expect(iterator1.next()).rejects.toThrow('500');
      await expectDone(iterator1);

      // We let you consume the iterator again to continue the conversation when there is an error.
      handleAssistantMessage(getTextContent());
      const iterator2 = runner[Symbol.asyncIterator]();
      await expectEvent(iterator2, (message) => {
        expect(message.content).toMatchObject([getTextContent()]);
      });
      await expectDone(iterator2);
    });

    it('respects max_iterations parameter', async () => {
      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Use tools repeatedly' }],
        max_iterations: 2, // Limit to 2 iterations
      });

      const iterator = runner[Symbol.asyncIterator]();

      // First iteration
      handleAssistantMessage(getWeatherToolUse('Paris'));
      await expectEvent(iterator, (message) => {
        expect(message.content).toMatchObject([getWeatherToolUse('Paris')]);
      });

      // Second iteration (should be the last)
      handleAssistantMessage(getWeatherToolUse('Berlin', 'tool_2'));
      await expectEvent(iterator, (message) => {
        expect(message.content).toMatchObject([getWeatherToolUse('Berlin', 'tool_2')]);
      });

      // Should stop here due to max_iterations
      await expectDone(iterator);

      // When max_iterations is reached, the iterator completes even if tools were requested.
      // The final message would be the last tool_use message from the assistant,
      // but no further iterations occur to execute those tools.
      const messages = runner.params.messages;
      expect(messages).toHaveLength(5);
      await expect(runner.runUntilDone()).resolves.toMatchObject({
        role: 'assistant',
        content: [getWeatherToolUse('Berlin', 'tool_2')],
      });
    });

    it('does not execute tools and ends the loop when the turn is refusal-terminated', async () => {
      const runSpy = vi.fn(async () => 'should never run');
      const spiedWeatherTool: BetaRunnableTool<{ location: string }> = { ...weatherTool, run: runSpy };
      const { runner, handleRequest } = setupTest({ tools: [spiedWeatherTool] });

      // A refusal can cut the turn off after a tool_use block has started, so the message can
      // carry a tool_use with partial input — the runner must treat the turn as terminal.
      const refusalMessage: BetaMessage = {
        id: 'msg_refusal',
        type: 'message',
        role: 'assistant',
        content: [getWeatherToolUse('SF')],
        model: 'claude-3-5-sonnet-latest',
        stop_details: null,
        stop_reason: 'refusal',
        stop_sequence: null,
        container: null,
        context_management: null,
        diagnostics: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          output_tokens_details: null,
          cache_creation: null,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
          fallback_credit: null,
          server_tool_use: null,
          service_tier: null,
          inference_geo: null,
          iterations: null,
          speed: null,
        },
      };
      handleRequest(async () => {
        return new Response(JSON.stringify(refusalMessage), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      });

      const iterator = runner[Symbol.asyncIterator]();

      handleRequest(async () => {
        throw new Error('Runner made a request after a refusal-terminated turn');
      });
      await expectEvent(iterator, (message) => {
        expect(message.stop_reason).toBe('refusal');
      });

      // The refusal turn is final: no tool execution, no follow-up request.
      await expectDone(iterator);
      expect(runSpy).not.toHaveBeenCalled();
      expect(runner.params.messages).toHaveLength(2);
      await expect(runner.runUntilDone()).resolves.toMatchObject({ stop_reason: 'refusal' });
    });
  });

  describe('tool_removal / tool_addition via param-mutation APIs', () => {
    const removeWeatherTool: Anthropic.Beta.Messages.BetaMessageParam = {
      role: 'system',
      content: [{ type: 'tool_removal', tool: { type: 'tool_reference', name: 'getWeather' } }],
    };
    const addWeatherTool: Anthropic.Beta.Messages.BetaMessageParam = {
      role: 'system',
      content: [{ type: 'tool_addition', tool: { type: 'tool_reference', name: 'getWeather' } }],
    };
    const notFoundResult = {
      type: 'tool_result',
      tool_use_id: 'tool_1',
      content: `Error: Tool 'getWeather' not found`,
      is_error: true,
    };

    it('honors a tool_removal added via pushMessages() between turns on the next assistant tool_use', async () => {
      const run = vi.fn(async ({ location }: { location: string }) => `Sunny in ${location}`);
      const trackedWeatherTool: BetaRunnableTool<{ location: string }> = { ...weatherTool, run };

      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [trackedWeatherTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      // Turn 1 is text-only. Mutating while suspended at the yield keeps the loop going and
      // hands the history to the caller (the assistant turn is not auto-pushed).
      const firstTurn = handleAssistantMessage(getTextContent('Which tool should I use?'));
      await expectEvent(iterator);
      runner.pushMessages(assistantTurn(firstTurn.content), removeWeatherTool, {
        role: 'user',
        content: 'Try the weather tool anyway.',
      });

      // Turn 2: the model still emits a tool_use for the withdrawn tool.
      handleAssistantMessage(getWeatherToolUse('SF'));
      await expectEvent(iterator);

      handleAssistantMessage(getTextContent());
      await expectEvent(iterator, (message) => {
        expect(message.content).toMatchObject([getTextContent()]);
      });

      expect(run).not.toHaveBeenCalled();
      // user, assistant text, system removal, user, assistant tool_use, user tool_result
      expect(runner.params.messages).toHaveLength(6);
      expect(runner.params.messages[5]).toEqual({ role: 'user', content: [notFoundResult] });

      await expectDone(iterator);
    });

    // Mutating during the yield turns off automatic tool dispatch for that turn; the API
    // guarantees the removal is honored when the caller then requests the tool response
    // itself via generateToolResponse().
    it('honors a tool_removal supplied via setMessagesParams() during the tool_use turn when the caller calls generateToolResponse()', async () => {
      const run = vi.fn(async ({ location }: { location: string }) => `Sunny in ${location}`);
      const trackedWeatherTool: BetaRunnableTool<{ location: string }> = { ...weatherTool, run };

      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [trackedWeatherTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      let toolUseTurn!: BetaMessage;
      handleAssistantMessage(getWeatherToolUse('SF'));
      await expectEvent(iterator, (message) => {
        toolUseTurn = message;
      });

      // Withdraw the tool while suspended at the yield, keeping the assistant turn in history
      // so the runner appends the tool_result once it resumes.
      runner.setMessagesParams((params) => ({
        ...params,
        messages: [...params.messages, removeWeatherTool, assistantTurn(toolUseTurn.content)],
      }));

      const toolResponse = await runner.generateToolResponse();
      expect(toolResponse).toEqual({ role: 'user', content: [notFoundResult] });
      expect(run).not.toHaveBeenCalled();

      handleAssistantMessage(getTextContent());
      await expectEvent(iterator, (message) => {
        expect(message.content).toMatchObject([getTextContent()]);
      });

      expect(run).not.toHaveBeenCalled();
      // user, system removal, assistant tool_use, user tool_result
      expect(runner.params.messages).toHaveLength(4);
      expect(runner.params.messages[3]).toEqual({ role: 'user', content: [notFoundResult] });

      await expectDone(iterator);
    });

    it('re-enables execution after a tool_addition added via pushMessages() between turns', async () => {
      const run = vi.fn(async ({ location }: { location: string }) => `Sunny in ${location}`);
      const trackedWeatherTool: BetaRunnableTool<{ location: string }> = { ...weatherTool, run };

      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'What is the weather?' }, removeWeatherTool],
        tools: [trackedWeatherTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      // Turn 1 is text-only; re-add the tool while suspended at the yield.
      const firstTurn = handleAssistantMessage(getTextContent('That tool is unavailable.'));
      await expectEvent(iterator);
      runner.pushMessages(assistantTurn(firstTurn.content), addWeatherTool, {
        role: 'user',
        content: 'It is available again — check SF.',
      });

      handleAssistantMessage(getWeatherToolUse('SF'));
      await expectEvent(iterator);

      handleAssistantMessage(getTextContent());
      await expectEvent(iterator);

      expect(run).toHaveBeenCalledWith({ location: 'SF' }, expect.anything());
      // user, system removal, assistant text, system addition, user, assistant tool_use, user tool_result
      expect(runner.params.messages).toHaveLength(7);
      expect(runner.params.messages[6]).toMatchObject({
        role: 'user',
        content: [getWeatherToolResult('SF')],
      });

      await expectDone(iterator);
    });
  });

  describe('.addTools() / .removeTools()', () => {
    const lookupDefinition = {
      type: 'custom' as const,
      name: 'lookup',
      description: 'Look something up',
      input_schema: { type: 'object' as const, properties: { query: { type: 'string' } } },
    };
    const lookupTool: BetaRunnableTool<{ query: string }> = {
      ...lookupDefinition,
      run: async ({ query }) => `Found ${query}`,
      parse: (input: unknown) => input as { query: string },
    };
    const { run: _run, parse: _parse, ...weatherDefinition } = weatherTool;

    const lookupToolUse = (id: string): BetaContentBlock => ({
      type: 'tool_use',
      id,
      name: 'lookup',
      input: { query: 'tides' },
    });
    const addition = (definition: unknown) => ({
      type: 'tool_addition',
      tool: { type: 'tool_definition', definition },
    });
    const removal = (name: string) => ({ type: 'tool_removal', tool: { type: 'tool_reference', name } });
    const toolChanges = (...content: unknown[]) => ({ role: 'system', content });
    const notFound = (name: string, id: string) => ({
      type: 'tool_result',
      tool_use_id: id,
      content: `Error: Tool '${name}' not found`,
      is_error: true,
    });
    const firstMessage = { role: 'user' as const, content: 'What is the weather?' };
    const sent = (body: Record<string, unknown> | undefined) => body!['messages'] as unknown[];

    // Drives the runner to the end, calling `onTurn` with each turn's index before its tool calls are run.
    async function runTurns(
      runner: Anthropic.Beta.Messages.BetaToolRunner<boolean>,
      onTurn: (turn: number) => void,
    ) {
      let turn = 0;
      for await (const _ of runner) {
        onTurn(turn++);
      }
    }

    it.each([false, true])(
      'sends an added tool after the tool results of the turn and runs it from then on (stream=%s)',
      async (stream) => {
        const { runner, handleRequest } = stream ? setupTest({ stream: true }) : setupTest();
        const bodies: Array<Record<string, unknown>> = [];
        const weatherTurn = assistantMessage('tool_use', getWeatherToolUse('SF'));
        const lookupTurn = assistantMessage('tool_use', lookupToolUse('tool_2'));

        reply(handleRequest, bodies, weatherTurn, stream);
        reply(handleRequest, bodies, lookupTurn, stream);
        reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), stream);
        await runTurns(runner, (turn) => {
          if (turn === 0) runner.addTools(lookupTool);
        });

        expect(bodies).toHaveLength(3);
        expect(sent(bodies[0])).toEqual([firstMessage]);
        expect(sent(bodies[1])).toEqual([
          firstMessage,
          { role: 'assistant', content: weatherTurn.content },
          { role: 'user', content: [getWeatherToolResult('SF')] },
          toolChanges(addition(lookupDefinition)),
        ]);
        expect(sent(bodies[2]).slice(4)).toEqual([
          { role: 'assistant', content: lookupTurn.content },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool_2', content: 'Found tides' }] },
        ]);
        for (const body of bodies) {
          expect(body['tools']).toEqual([weatherDefinition]);
        }
      },
    );

    it.each([
      ['the tool', weatherTool],
      ['its name', 'getWeather'],
    ])('refuses a call already in the turn being handled to a tool removed by %s', async (_, tool) => {
      const run = vi.fn(weatherTool.run);
      const { runner, handleRequest } = setupTest({ tools: [{ ...weatherTool, run }] });
      const bodies: Array<Record<string, unknown>> = [];
      const weatherTurn = assistantMessage('tool_use', getWeatherToolUse('SF'));

      reply(handleRequest, bodies, weatherTurn, false);
      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      await runTurns(runner, (turn) => {
        if (turn === 0) runner.removeTools(tool);
      });

      expect(run).not.toHaveBeenCalled();
      expect(sent(bodies[1])).toEqual([
        firstMessage,
        { role: 'assistant', content: weatherTurn.content },
        { role: 'user', content: [notFound('getWeather', 'tool_1')] },
        toolChanges(removal('getWeather')),
      ]);
      expect(bodies[1]!['tools']).toEqual(bodies[0]!['tools']);
    });

    it('keeps removed tools removed when their tool_removal blocks leave the history, until added again', async () => {
      const runWeather = vi.fn(weatherTool.run);
      const runLookup = vi.fn(lookupTool.run);
      const { runner, handleRequest } = setupTest({
        tools: [{ ...weatherTool, run: runWeather }, calculatorTool],
      });
      const bodies: Array<Record<string, unknown>> = [];
      const bothTurn = assistantMessage('tool_use', getWeatherToolUse('SF'), lookupToolUse('tool_2'));

      runner.removeTools('getWeather');
      runner.addTools({ ...lookupTool, run: runLookup });
      runner.removeTools('lookup');
      reply(handleRequest, bodies, assistantMessage('tool_use', getCalculatorToolUse(1, 2, 'add')), false);
      reply(handleRequest, bodies, bothTurn, false);
      reply(handleRequest, bodies, assistantMessage('tool_use', getWeatherToolUse('LA', 'tool_3')), false);
      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      await runTurns(runner, (turn) => {
        if (turn === 1) {
          runner.setMessagesParams((params) => ({
            ...params,
            messages: [firstMessage, { role: 'assistant', content: bothTurn.content }],
          }));
          runner.addTools({ ...weatherTool, run: runWeather });
        }
      });

      expect(runLookup).not.toHaveBeenCalled();
      expect(sent(bodies[2])).toEqual([
        firstMessage,
        { role: 'assistant', content: bothTurn.content },
        { role: 'user', content: [notFound('getWeather', 'tool_1'), notFound('lookup', 'tool_2')] },
        toolChanges(addition(weatherDefinition)),
      ]);
      expect(runWeather).toHaveBeenCalledTimes(1);
      expect(runWeather).toHaveBeenCalledWith({ location: 'LA' }, expect.anything());
    });

    it('replaces a runnable tool of the same name from the next request', async () => {
      const { runner, handleRequest } = setupTest();
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, assistantMessage('tool_use', getWeatherToolUse('SF')), false);
      reply(handleRequest, bodies, assistantMessage('tool_use', getWeatherToolUse('LA', 'tool_2')), false);
      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      await runTurns(runner, (turn) => {
        if (turn === 0) runner.addTools({ ...weatherTool, run: async () => 'Raining' });
      });

      expect(sent(bodies[1]).slice(-2)).toEqual([
        { role: 'user', content: [getWeatherToolResult('SF')] },
        toolChanges(addition(weatherDefinition)),
      ]);
      expect(sent(bodies[2]).at(-1)).toEqual({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tool_2', content: 'Raining' }],
      });
    });

    it('sends every change made before the first request in call order, without collapsing an add and a remove', async () => {
      const { runner, handleRequest } = setupTest();
      const bodies: Array<Record<string, unknown>> = [];

      runner.addTools(lookupTool);
      runner.removeTools(lookupTool);
      runner.removeTools('getWeather');
      runner.addTools(weatherTool);
      reply(
        handleRequest,
        bodies,
        assistantMessage('tool_use', getWeatherToolUse('SF'), lookupToolUse('tool_2')),
        false,
      );
      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      await runner.runUntilDone();

      expect(sent(bodies[0])).toEqual([
        firstMessage,
        toolChanges(
          addition(lookupDefinition),
          removal('lookup'),
          removal('getWeather'),
          addition(weatherDefinition),
        ),
      ]);
      expect(bodies[0]!['tools']).toEqual([weatherDefinition]);
      expect(sent(bodies[1]).at(-1)).toEqual({
        role: 'user',
        content: [getWeatherToolResult('SF'), notFound('lookup', 'tool_2')],
      });
    });

    it('sends a raw definition as given and never runs a call to it, even under the name of a runnable tool', async () => {
      const run = vi.fn(weatherTool.run);
      const { runner, handleRequest } = setupTest({ tools: [{ ...weatherTool, run }] });
      const bodies: Array<Record<string, unknown>> = [];
      const webSearch = { type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: 3 };
      const mcpToolset = { type: 'mcp_toolset' as const, mcp_server_name: 'docs' };

      runner.addTools(webSearch, mcpToolset, weatherDefinition);
      reply(handleRequest, bodies, assistantMessage('tool_use', getWeatherToolUse('SF')), false);
      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      await runner.runUntilDone();

      expect(sent(bodies[0])[1]).toEqual(
        toolChanges(addition(webSearch), addition(mcpToolset), addition(weatherDefinition)),
      );
      expect(run).not.toHaveBeenCalled();
      expect(sent(bodies[1]).at(-1)).toEqual({ role: 'user', content: [notFound('getWeather', 'tool_1')] });
    });

    it('keeps running a tool that shares its name with the server of an added MCP toolset', async () => {
      const { runner, handleRequest } = setupTest();
      const bodies: Array<Record<string, unknown>> = [];

      runner.addTools({ type: 'mcp_toolset', mcp_server_name: 'getWeather' });
      reply(handleRequest, bodies, assistantMessage('tool_use', getWeatherToolUse('SF')), false);
      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      await runner.runUntilDone();

      expect(sent(bodies[1]).at(-1)).toEqual({ role: 'user', content: [getWeatherToolResult('SF')] });
    });

    it.each([false, true])(
      'holds changes made during a paused turn until it has been resumed (stream=%s)',
      async (stream) => {
        const { runner, handleRequest } = stream ? setupTest({ stream: true }) : setupTest();
        const bodies: Array<Record<string, unknown>> = [];
        const pausedTurn = assistantMessage('pause_turn', getTextContent('Let me look that up.'));
        const weatherTurn = assistantMessage('tool_use', getWeatherToolUse('SF'));

        reply(handleRequest, bodies, pausedTurn, stream);
        reply(handleRequest, bodies, weatherTurn, stream);
        reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), stream);
        await runTurns(runner, (turn) => {
          if (turn === 0) runner.addTools(lookupTool);
        });

        expect(sent(bodies[1])).toEqual([firstMessage, { role: 'assistant', content: pausedTurn.content }]);
        expect(sent(bodies[2])).toEqual([
          firstMessage,
          { role: 'assistant', content: pausedTurn.content },
          { role: 'assistant', content: weatherTurn.content },
          { role: 'user', content: [getWeatherToolResult('SF')] },
          toolChanges(addition(lookupDefinition)),
        ]);
      },
    );

    it('does not hold changes after a turn that stopped on compaction', async () => {
      const { runner, handleRequest } = setupTest();
      const bodies: Array<Record<string, unknown>> = [];
      const compactedTurn = assistantMessage('compaction', {
        type: 'compaction',
        content: 'Summary of the conversation so far.',
        encrypted_content: null,
      });

      reply(handleRequest, bodies, compactedTurn, false);
      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      await runTurns(runner, (turn) => {
        if (turn === 0) runner.addTools(lookupTool);
      });

      expect(sent(bodies[1])).toEqual([
        firstMessage,
        { role: 'assistant', content: compactedTurn.content },
        toolChanges(addition(lookupDefinition)),
      ]);
    });

    it('sends changes made in a turn before the compaction request that follows it', async () => {
      const { runner, handleRequest } = setupTest();
      const bodies: Array<Record<string, unknown>> = [];
      const weatherTurn = assistantMessage('tool_use', getWeatherToolUse('SF'));
      const compaction = { type: 'compaction', content: 'Summary so far.', encrypted_content: null };

      reply(handleRequest, bodies, weatherTurn, false);
      reply(handleRequest, bodies, assistantMessage('compaction', compaction as BetaContentBlock), false);
      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      await runTurns(runner, (turn) => {
        if (turn === 0) {
          runner.addTools(lookupTool);
          runner.compactBeforeNextTurn();
        }
      });

      expect(bodies).toHaveLength(3);
      expect(bodies[1]!['compaction']).toEqual({ type: 'summarize' });
      expect(sent(bodies[1])).toEqual([
        firstMessage,
        { role: 'assistant', content: weatherTurn.content },
        { role: 'user', content: [getWeatherToolResult('SF')] },
        toolChanges(addition(lookupDefinition)),
      ]);
    });

    it('keeps a tool removed by a system message in the history removed after a compaction', async () => {
      const run = vi.fn(weatherTool.run);
      const { runner, handleRequest } = setupTest({
        tools: [{ ...weatherTool, run }],
        messages: [
          firstMessage,
          {
            role: 'system',
            content: [{ type: 'tool_removal', tool: { type: 'tool_reference', name: 'getWeather' } }],
          },
        ],
      });
      const bodies: Array<Record<string, unknown>> = [];
      const compaction = { type: 'compaction', content: 'Summary so far.', encrypted_content: null };

      runner.compactBeforeNextTurn();
      reply(handleRequest, bodies, assistantMessage('compaction', compaction as BetaContentBlock), false);
      reply(handleRequest, bodies, assistantMessage('tool_use', getWeatherToolUse('SF')), false);
      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      await runner.runUntilDone();

      expect(run).not.toHaveBeenCalled();
      expect(sent(bodies[2]).at(-1)).toEqual({ role: 'user', content: [notFound('getWeather', 'tool_1')] });
    });

    it('keeps a tool removed by a system message in the history removed after compactionControl compacts', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const run = vi.fn(weatherTool.run);
      const { runner, handleRequest } = setupTest({
        tools: [{ ...weatherTool, run }],
        messages: [
          firstMessage,
          {
            role: 'system',
            content: [{ type: 'tool_removal', tool: { type: 'tool_reference', name: 'getWeather' } }],
          },
        ],
        compactionControl: { enabled: true, contextTokenThreshold: 100 },
      });
      const bodies: Array<Record<string, unknown>> = [];
      const long = assistantMessage('end_turn', getTextContent());
      long.usage.input_tokens = 1000;

      reply(handleRequest, bodies, long, false);
      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent('Summary so far.')), false);
      reply(handleRequest, bodies, assistantMessage('tool_use', getWeatherToolUse('SF')), false);
      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      await runner.runUntilDone();

      expect(run).not.toHaveBeenCalled();
      expect(sent(bodies[3]).at(-1)).toEqual({ role: 'user', content: [notFound('getWeather', 'tool_1')] });
      warn.mockRestore();
    });

    it('never sends changes still pending when the run ends', async () => {
      const { runner, handleRequest } = setupTest();
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      handleRequest(async () => {
        throw new Error('Runner made a request just to send pending tool changes');
      });
      await runTurns(runner, () => runner.addTools(lookupTool));

      expect(bodies).toHaveLength(1);
      expect(runner.params.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    });

    it('does not add a beta header', async () => {
      const { runner, handleRequest } = setupTest();
      let betaHeader: string | null | undefined;

      runner.addTools(lookupTool);
      handleRequest(async (_req, init) => {
        betaHeader = new Headers(init?.headers).get('anthropic-beta');
        return new Response(JSON.stringify(assistantMessage('end_turn', getTextContent())), {
          headers: { 'content-type': 'application/json' },
        });
      });
      await runner.runUntilDone();

      expect(betaHeader).toBeNull();
    });

    it('accepts a runnable tool given by value in the initial messages', async () => {
      const { runner, handleRequest } = setupTest({
        messages: [
          { role: 'user', content: 'What is the weather?' },
          {
            role: 'system',
            content: [{ type: 'tool_addition', tool: { type: 'tool_definition', definition: lookupTool } }],
          },
        ],
      });
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      await runner.runUntilDone();

      expect(sent(bodies[0])[1]).toEqual(toolChanges(addition(lookupDefinition)));
    });
  });

  describe('iterator.return()', () => {
    it('stops iteration', async () => {
      const { runner, handleAssistantMessage } = setupTest();

      const iterator = runner[Symbol.asyncIterator]();

      handleAssistantMessage(getWeatherToolUse('SF'));

      // Get first message
      await expectEvent(iterator);

      // Call return to cleanup
      const returnResult = await iterator.return?.();
      expect(returnResult?.done).toBe(true);
      expect(returnResult?.value).toBeUndefined();

      // Further calls should indicate done
      await expectDone(iterator);
    });
  });

  describe('.setMessagesParams()', () => {
    it('updates parameters for next iteration', async () => {
      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Initial message' }],
        max_tokens: 100,
      });

      // Update parameters before iteration
      runner.setMessagesParams({
        messages: [{ role: 'user', content: 'Updated message' }],
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 200,
        tools: [weatherTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      handleAssistantMessage(getTextContent());
      await expectEvent(iterator, (message) => {
        expect(message.content[0]).toMatchObject(getTextContent());
      });

      // Verify params were updated
      expect(runner.params.max_tokens).toBe(200);
      expect(runner.params.messages[0]?.content).toBe('Updated message');

      await expectDone(iterator);
    });

    it('allows you to update append custom tool_use blocks', async () => {
      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Get weather' }],
      });

      const iterator = runner[Symbol.asyncIterator]();

      // First iteration: assistant requests tool
      handleAssistantMessage(getWeatherToolUse('Paris'));
      await expectEvent(iterator, (message) => {
        expect(message.content).toMatchObject([getWeatherToolUse('Paris')]);
      });

      // Verify generateToolResponse returns the tool result for Paris
      const toolResponse = await runner.generateToolResponse();
      expect(toolResponse).toMatchObject({
        role: 'user',
        content: [getWeatherToolResult('Paris')],
      });

      // Update params to append a custom tool_use block to messages
      runner.setMessagesParams((params) => ({
        ...params,
        messages: [...params.messages, assistantTurn([getWeatherToolUse('London', 'tool_2')])],
      }));

      // Assistant provides final response incorporating both tool results
      handleAssistantMessage(getTextContent());
      await expectEvent(iterator, (message) => {
        expect(message.content[0]).toMatchObject(getTextContent());
      });

      // Verify the messages were properly appended
      // The messages array should have: initial user message + custom assistant + custom tool_use
      expect(runner.params.messages).toHaveLength(3);
      expect(runner.params.messages[1]).toMatchObject({
        role: 'assistant',
        content: [getWeatherToolUse('London', 'tool_2')],
      });
      // Verify the third message has the London tool_result
      // (responded to automatically by the ToolRunner)
      expect(runner.params.messages[2]).toMatchObject({
        role: 'user',
        content: [getWeatherToolResult('London', 'tool_2')],
      });
      await expectDone(iterator);
    });
  });

  describe('container propagation', () => {
    const container = { id: 'container_123', expires_at: '2030-01-01T00:00:00Z', skills: [] };

    function containerMessage(...content: BetaContentBlock[]): BetaMessage {
      return {
        id: 'msg_container',
        type: 'message',
        role: 'assistant',
        content,
        model: 'claude-3-5-sonnet-latest',
        stop_details: null,
        stop_reason: content.some((block) => block.type === 'tool_use') ? 'tool_use' : 'end_turn',
        stop_sequence: null,
        container,
        context_management: null,
        diagnostics: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          output_tokens_details: null,
          cache_creation: null,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
          fallback_credit: null,
          server_tool_use: null,
          service_tier: null,
          inference_geo: null,
          iterations: null,
          speed: null,
        },
      };
    }

    it.each([false, true])(
      'forwards the response container id to the next request (stream=%s)',
      async (stream) => {
        const { runner, handleRequest } = stream ? setupTest({ stream: true }) : setupTest();
        const bodies: Array<Record<string, unknown>> = [];

        reply(handleRequest, bodies, containerMessage(getWeatherToolUse('SF')), stream);
        reply(handleRequest, bodies, containerMessage(getTextContent()), stream);
        await runner.runUntilDone();

        expect(bodies).toHaveLength(2);
        expect(bodies[0]).not.toHaveProperty('container');
        expect(bodies[1]!['container']).toBe('container_123');
      },
    );

    it('fills in the id on an object-form container param without dropping its other fields', async () => {
      const skills = [{ type: 'anthropic' as const, skill_id: 'pptx', version: 'latest' }];
      const { runner, handleRequest } = setupTest({ container: { skills } });
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, containerMessage(getWeatherToolUse('SF')), false);
      reply(handleRequest, bodies, containerMessage(getTextContent()), false);
      await runner.runUntilDone();

      expect(bodies[0]!['container']).toEqual({ skills });
      expect(bodies[1]!['container']).toEqual({ skills, id: 'container_123' });
    });

    it('leaves a caller-provided container id untouched', async () => {
      const { runner, handleRequest } = setupTest({ container: 'container_mine' });
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, containerMessage(getWeatherToolUse('SF')), false);
      reply(handleRequest, bodies, containerMessage(getTextContent()), false);
      await runner.runUntilDone();

      expect(bodies.map((body) => body['container'])).toEqual(['container_mine', 'container_mine']);
    });
  });

  describe('pause_turn', () => {
    const pausedTurn = () =>
      assistantMessage('pause_turn', getTextContent('Let me look that up.'), {
        type: 'server_tool_use',
        id: 'srvtoolu_1',
        name: 'web_search',
        input: { query: 'weather in SF' },
      });

    it.each([false, true])(
      'sends the paused turn back so the server resumes it (stream=%s)',
      async (stream) => {
        const { runner, handleRequest } = stream ? setupTest({ stream: true }) : setupTest();
        const bodies: Array<Record<string, unknown>> = [];
        const paused = pausedTurn();

        reply(handleRequest, bodies, paused, stream);
        reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), stream);
        handleRequest(async () => {
          throw new Error('Runner made a request after the resumed turn ended');
        });

        await expect(runner.runUntilDone()).resolves.toMatchObject({
          id: 'msg_end_turn',
          stop_reason: 'end_turn',
        });
        expect(bodies).toHaveLength(2);
        expect(bodies[1]!['messages']).toEqual([
          { role: 'user', content: 'What is the weather?' },
          { role: 'assistant', content: paused.content },
        ]);
        expect(runner.params.messages).toHaveLength(3);
      },
    );

    it('stops at max_iterations when the server keeps pausing', async () => {
      const { runner, handleRequest } = setupTest({ max_iterations: 3 });
      const bodies: Array<Record<string, unknown>> = [];

      for (let i = 0; i < 3; i++) {
        reply(handleRequest, bodies, pausedTurn(), false);
      }
      handleRequest(async () => {
        throw new Error('Runner made a request past max_iterations');
      });

      await expect(runner.runUntilDone()).resolves.toMatchObject({ stop_reason: 'pause_turn' });
      expect(bodies).toHaveLength(3);
    });
  });

  describe('compaction', () => {
    const compactedTurn = () =>
      assistantMessage('compaction', {
        type: 'compaction',
        content: 'Summary of the conversation so far.',
        encrypted_content: null,
      });

    it.each([false, true])(
      'sends the compaction turn back so the server continues it (stream=%s)',
      async (stream) => {
        const { runner, handleRequest } = stream ? setupTest({ stream: true }) : setupTest();
        const bodies: Array<Record<string, unknown>> = [];
        const compacted = compactedTurn();

        reply(handleRequest, bodies, compacted, stream);
        reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), stream);
        handleRequest(async () => {
          throw new Error('Runner made a request after the continued turn ended');
        });

        await expect(runner.runUntilDone()).resolves.toMatchObject({
          id: 'msg_end_turn',
          stop_reason: 'end_turn',
        });
        expect(bodies).toHaveLength(2);
        expect(bodies[1]!['messages']).toEqual([
          { role: 'user', content: 'What is the weather?' },
          { role: 'assistant', content: compacted.content },
        ]);
        expect(runner.params.messages).toHaveLength(3);
      },
    );
  });

  describe('.compactBeforeNextTurn()', () => {
    const question = { role: 'user', content: 'What is the weather?' };
    const compactionBlock = (content: string | null = 'Summary so far.', signature = 'sig_01') =>
      ({ type: 'compaction', content, encrypted_content: null, signature }) satisfies BetaContentBlock;
    const compacted = (content?: string, signature?: string) =>
      assistantMessage('compaction', compactionBlock(content, signature));
    const toolTurn = () => assistantMessage('tool_use', getWeatherToolUse('SF'));
    const finalTurn = () => assistantMessage('end_turn', getTextContent());
    const historyAfterToolTurn = () => [
      question,
      { role: 'assistant', content: [getWeatherToolUse('SF')] },
      { role: 'user', content: [getWeatherToolResult('SF')] },
    ];
    const compactionBlockAlone = () => [{ role: 'assistant', content: [compactionBlock()] }];

    function failOnAnotherRequest(handleRequest: (handler: Fetch) => void) {
      handleRequest(async () => {
        throw new Error('Runner made an unexpected request');
      });
    }

    // Runs to the end, handing each message to `onMessage`, and returns the stop reasons it yielded.
    async function run(
      runner: AsyncIterable<BetaMessage | { finalMessage(): Promise<BetaMessage> }>,
      onMessage: (message: BetaMessage) => void,
    ) {
      const stopReasons: Array<BetaMessage['stop_reason']> = [];
      for await (const item of runner) {
        const message = 'finalMessage' in item ? await item.finalMessage() : item;
        stopReasons.push(message.stop_reason);
        onMessage(message);
      }
      return stopReasons;
    }

    const testLogger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    it.each([false, true])('is sent once the tool calls have run (stream=%s)', async (stream) => {
      const context_management = { edits: [{ type: 'clear_tool_uses_20250919' as const }] };
      // The compaction request is not a model turn, so both real turns still fit.
      const params = { context_management, max_iterations: 2 };
      const { runner, handleRequest } = stream ? setupTest({ ...params, stream: true }) : setupTest(params);
      const bodies: Array<Record<string, unknown>> = [];
      // A block type this SDK version doesn't model has to go back with the rest of the response.
      const listing = { type: 'mcp_tool_listing', mcp_server_name: 'docs', tools: [] };
      const compaction = assistantMessage(
        'compaction',
        compactionBlock(),
        listing as unknown as BetaContentBlock,
      );

      reply(handleRequest, bodies, toolTurn(), stream);
      reply(handleRequest, bodies, compaction, stream);
      reply(handleRequest, bodies, finalTurn(), stream);
      failOnAnotherRequest(handleRequest);

      const yielded: BetaMessage[] = [];
      const stopReasons = await run(runner, (message) => {
        yielded.push(message);
        if (message.stop_reason === 'tool_use') {
          runner.compactBeforeNextTurn({ type: 'summarize', instructions: 'Keep the city.' });
        }
      });

      expect(stopReasons).toEqual(['tool_use', 'compaction', 'end_turn']);
      expect(yielded[1]).toMatchObject({ id: compaction.id, content: compaction.content });
      expect(bodies).toHaveLength(3);
      const [first, compactionRequest, after] = [bodies[0]!, bodies[1]!, bodies[2]!];
      expect(first).not.toHaveProperty('compaction');
      expect(compactionRequest['compaction']).toEqual({ type: 'summarize', instructions: 'Keep the city.' });
      expect(compactionRequest).not.toHaveProperty('context_management');
      expect(compactionRequest['messages']).toEqual(historyAfterToolTurn());
      expect(compactionRequest['stream']).toBe(stream);
      expect(after['messages']).toEqual([{ role: 'assistant', content: [compactionBlock(), listing] }]);
      expect(after).not.toHaveProperty('compaction');
      expect(after['context_management']).toEqual(context_management);
      expect(runner.params.messages).toHaveLength(2);
    });

    const format = { type: 'json_schema' as const, schema: { type: 'object', properties: {} } };

    it.each([
      {
        name: 'tool_choice any, output_config.format',
        replyOnly: {
          stop_sequences: ['END'],
          tool_choice: { type: 'any' as const },
          output_config: { effort: 'low' as const, format },
        },
        kept: { output_config: { effort: 'low' } },
      },
      {
        name: 'tool_choice tool, output_format',
        replyOnly: {
          stop_sequences: ['END'],
          tool_choice: { type: 'tool' as const, name: 'getWeather' },
          output_format: format,
        },
        sent: {
          stop_sequences: ['END'],
          tool_choice: { type: 'tool', name: 'getWeather' },
          output_config: { format },
        },
        kept: {},
      },
      {
        name: 'tool_choice auto stays',
        replyOnly: { tool_choice: { type: 'auto' as const } },
        kept: { tool_choice: { type: 'auto' } },
      },
      {
        name: 'fallbacks[].output_config.format',
        replyOnly: {
          fallbacks: [
            { model: 'claude-3-5-haiku-latest', output_config: { effort: 'low' as const, format } },
          ],
        },
        kept: { fallbacks: [{ model: 'claude-3-5-haiku-latest', output_config: { effort: 'low' } }] },
      },
    ])(
      'leaves reply-only params off the compaction request only ($name)',
      async ({ replyOnly, sent = replyOnly, kept }) => {
        const { runner, handleRequest } = setupTest({
          ...replyOnly,
          system: 'Be brief.',
          betas: ['compact-2026-09-04'],
        });
        const requests: Array<{ body: Record<string, unknown>; betas: string | null }> = [];
        for (const message of [toolTurn(), compacted(), finalTurn()]) {
          handleRequest(async (_req, init) => {
            requests.push({
              body: JSON.parse(init!.body as string),
              betas: new Headers(init!.headers as Record<string, string>).get('anthropic-beta'),
            });
            return new Response(JSON.stringify(message), { headers: { 'content-type': 'application/json' } });
          });
        }
        failOnAnotherRequest(handleRequest);

        await run(runner, (message) => {
          if (message.stop_reason === 'tool_use') {
            runner.compactBeforeNextTurn();
          }
        });

        const replyOnlyKeys = [
          'stop_sequences',
          'tool_choice',
          'output_config',
          'output_format',
          'fallbacks',
        ];
        const replyOnlyIn = (body: Record<string, unknown>) =>
          Object.fromEntries(replyOnlyKeys.filter((key) => key in body).map((key) => [key, body[key]]));
        const [first, compactionRequest, after] = requests.map((request) => request.body);

        expect(replyOnlyIn(first!)).toEqual(sent);
        expect(replyOnlyIn(compactionRequest!)).toEqual(kept);
        expect(replyOnlyIn(after!)).toEqual(sent);
        expect(compactionRequest).toMatchObject({
          compaction: { type: 'summarize' },
          max_tokens: 1000,
          system: 'Be brief.',
          tools: first!['tools'],
        });
        expect(requests.map((request) => request.betas)).toEqual(Array(3).fill('compact-2026-09-04'));
      },
    );

    it('sends only the betas the caller passed', async () => {
      const betaHeaders: Array<string | null> = [];
      const answer = (handleRequest: (handler: Fetch) => void, message: BetaMessage) =>
        handleRequest(async (_req, init) => {
          betaHeaders.push(new Headers(init!.headers as Record<string, string>).get('anthropic-beta'));
          return new Response(JSON.stringify(message), { headers: { 'content-type': 'application/json' } });
        });

      for (const betas of [undefined, ['compact-2026-09-04']]) {
        const { runner, handleRequest } = setupTest(betas ? { betas } : {});
        answer(handleRequest, compacted());
        answer(handleRequest, finalTurn());
        runner.compactBeforeNextTurn();
        await runner.runUntilDone();
      }

      expect(betaHeaders).toEqual([null, null, 'compact-2026-09-04', 'compact-2026-09-04']);
    });

    it('is the first request when called before iterating', async () => {
      const { runner, handleRequest } = setupTest();
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, compacted(), false);
      reply(handleRequest, bodies, finalTurn(), false);
      failOnAnotherRequest(handleRequest);

      // An edit made before the compaction request is part of what gets summarized.
      runner.pushMessages({ role: 'user', content: 'And in NYC?' });
      runner.compactBeforeNextTurn();
      await expect(runner.runUntilDone()).resolves.toMatchObject({ stop_reason: 'end_turn' });

      expect(bodies.map((body) => body['compaction'])).toEqual([{ type: 'summarize' }, undefined]);
      expect(bodies[0]!['messages']).toEqual([question, { role: 'user', content: 'And in NYC?' }]);
      expect(bodies[1]!['messages']).toEqual(compactionBlockAlone());
    });

    it('replaces the pending compaction when called again', async () => {
      const { runner, handleRequest } = setupTest();
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, toolTurn(), false);
      reply(handleRequest, bodies, compacted(), false);
      reply(handleRequest, bodies, finalTurn(), false);
      failOnAnotherRequest(handleRequest);

      await run(runner, (message) => {
        if (message.stop_reason === 'tool_use') {
          runner.compactBeforeNextTurn({ type: 'summarize', instructions: 'Keep the city.' });
          runner.compactBeforeNextTurn({ type: 'summarize', instructions: 'Keep the units.' });
        }
      });

      expect(bodies.map((body) => body['compaction'])).toEqual([
        undefined,
        { type: 'summarize', instructions: 'Keep the units.' },
        undefined,
      ]);
    });

    const pausedTurn = () =>
      assistantMessage('pause_turn', getTextContent('Let me look that up.'), {
        type: 'server_tool_use',
        id: 'srvtoolu_1',
        name: 'web_search',
        input: { query: 'weather in SF' },
      });
    const badRequest = async () =>
      new Response(
        JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Bad request' } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );

    // The older pause_after_compaction turn (`compaction`) is resumed the same way as `pause_turn`.
    it.each(['pause_turn', 'compaction'] as const)(
      'waits for a paused turn (%s) to finish',
      async (stop_reason) => {
        const { runner, handleRequest } = setupTest();
        const bodies: Array<Record<string, unknown>> = [];
        const paused = stop_reason === 'pause_turn' ? pausedTurn() : compacted('Earlier summary.', 'sig_00');

        reply(handleRequest, bodies, paused, false);
        reply(handleRequest, bodies, toolTurn(), false);
        reply(handleRequest, bodies, compacted(), false);
        reply(handleRequest, bodies, finalTurn(), false);
        failOnAnotherRequest(handleRequest);

        let yielded = 0;
        await run(runner, () => {
          if (++yielded === 1) {
            runner.compactBeforeNextTurn();
          }
        });

        expect(bodies.map((body) => body['compaction'])).toEqual([
          undefined,
          undefined,
          { type: 'summarize' },
          undefined,
        ]);
        expect(bodies[1]!['messages']).toEqual([question, { role: 'assistant', content: paused.content }]);
        expect((bodies[2]!['messages'] as unknown[]).at(-1)).toEqual({
          role: 'user',
          content: [getWeatherToolResult('SF')],
        });
        expect(bodies[3]!['messages']).toEqual(compactionBlockAlone());
      },
    );

    it('still waits for the paused turn when the request resuming it failed', async () => {
      const { runner, handleRequest } = setupTest();
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, pausedTurn(), false);
      handleRequest(badRequest);
      await expect(run(runner, () => runner.compactBeforeNextTurn())).rejects.toThrow(
        Anthropic.BadRequestError,
      );

      reply(handleRequest, bodies, finalTurn(), false);
      reply(handleRequest, bodies, compacted(), false);
      failOnAnotherRequest(handleRequest);
      await run(runner, () => {});

      expect(bodies.map((body) => body['compaction'])).toEqual([undefined, undefined, { type: 'summarize' }]);
    });

    it.each([false, true])(
      'is sent on the final turn before the runner stops (stream=%s)',
      async (stream) => {
        // The final answer is also the last iteration allowed; the compaction still goes out.
        const { runner, handleRequest } =
          stream ? setupTest({ max_iterations: 1, stream: true }) : setupTest({ max_iterations: 1 });
        const bodies: Array<Record<string, unknown>> = [];
        const final = finalTurn();

        reply(handleRequest, bodies, final, stream);
        reply(handleRequest, bodies, compacted(), stream);
        failOnAnotherRequest(handleRequest);

        const stopReasons = await run(runner, (message) => {
          if (message.stop_reason === 'end_turn') {
            runner.compactBeforeNextTurn();
          }
        });

        expect(stopReasons).toEqual(['end_turn', 'compaction']);
        expect(bodies[1]!['compaction']).toEqual({ type: 'summarize' });
        expect(bodies[1]!['messages']).toEqual([question, { role: 'assistant', content: final.content }]);
        expect(runner.params.messages).toEqual(compactionBlockAlone());
        await expect(runner.done()).resolves.toMatchObject({ stop_reason: 'compaction' });
      },
    );

    it('is skipped with a warning when the final turn has tool calls that never ran', async () => {
      const logger = testLogger();
      const { runner, handleRequest } = setupTest({}, { logger });
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, assistantMessage('max_tokens', getWeatherToolUse('SF')), false);
      failOnAnotherRequest(handleRequest);

      const stopReasons = await run(runner, () => runner.compactBeforeNextTurn());

      expect(stopReasons).toEqual(['max_tokens']);
      expect(bodies).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('The pending compaction was skipped'));
    });

    it('is dropped when max_iterations ends the run after a tool turn', async () => {
      const logger = testLogger();
      const { runner, handleRequest } = setupTest({ max_iterations: 1 }, { logger });
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, toolTurn(), false);
      failOnAnotherRequest(handleRequest);

      await run(runner, () => runner.compactBeforeNextTurn());

      expect(bodies).toHaveLength(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it.each([
      // A failed compaction: the block is there, without a summary.
      ['a block without content', assistantMessage('compaction', compactionBlock(null))],
      // Or nothing at all, with the summarization call's own stop reason.
      ['no content', assistantMessage('max_tokens')],
    ])('keeps the history and warns when the response has %s', async (_, response) => {
      const logger = testLogger();
      const { runner, handleRequest } = setupTest({}, { logger });
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, toolTurn(), false);
      reply(handleRequest, bodies, response, false);
      reply(handleRequest, bodies, finalTurn(), false);
      failOnAnotherRequest(handleRequest);

      let yielded = 0;
      await run(runner, () => {
        // The second call is made on the compaction response, so it is ignored: no retry is sent.
        if (++yielded <= 2) {
          runner.compactBeforeNextTurn();
        }
      });

      expect(bodies).toHaveLength(3);
      expect(bodies[2]!['messages']).toEqual(bodies[1]!['messages']);
      expect(bodies[2]).not.toHaveProperty('compaction');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Compaction produced no summary'));
    });

    it('resolves to the final answer when a final-turn compaction produces no summary', async () => {
      const { runner, handleRequest } = setupTest({}, { logger: testLogger() });
      const final = finalTurn();

      reply(handleRequest, [], final, false);
      reply(handleRequest, [], assistantMessage('max_tokens'), false);
      failOnAnotherRequest(handleRequest);

      const stopReasons = await run(runner, (message) => {
        if (message.stop_reason === 'end_turn') {
          runner.compactBeforeNextTurn();
        }
      });

      expect(stopReasons).toEqual(['end_turn', 'max_tokens']);
      await expect(runner.done()).resolves.toMatchObject({ id: final.id, stop_reason: 'end_turn' });
      expect(runner.params.messages).toEqual([question, { role: 'assistant', content: final.content }]);
    });

    it('ignores a call made on the compaction response', async () => {
      const edits: Array<{ type: 'compact_20260112' }> = [];
      const { runner, handleRequest } = setupTest({ context_management: { edits } });
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, toolTurn(), false);
      reply(handleRequest, bodies, compacted(), false);
      reply(handleRequest, bodies, finalTurn(), false);
      failOnAnotherRequest(handleRequest);

      // A token threshold keeps firing on the compaction response, whose usage counts what it summarized.
      const stopReasons = await run(runner, (message) => {
        if (message.stop_reason === 'compaction') {
          // A call that is going to be ignored doesn't throw either.
          edits.push({ type: 'compact_20260112' });
        }
        if (message.stop_reason !== 'end_turn') {
          runner.compactBeforeNextTurn();
        }
      });

      expect(stopReasons).toEqual(['tool_use', 'compaction', 'end_turn']);
      expect(bodies.map((body) => body['compaction'])).toEqual([undefined, { type: 'summarize' }, undefined]);
    });

    it('refuses to replace the messages while the conversation is being compacted', async () => {
      const { runner, handleRequest } = setupTest();
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, toolTurn(), false);
      reply(handleRequest, bodies, compacted(), false);
      reply(handleRequest, bodies, finalTurn(), false);

      await run(runner, (message) => {
        if (message.stop_reason === 'tool_use') {
          runner.compactBeforeNextTurn();
        } else if (message.stop_reason === 'compaction') {
          const refusal = "Message params can't be changed while the conversation is being compacted";
          expect(() => runner.pushMessages({ role: 'user', content: 'And in NYC?' })).toThrow(refusal);
          expect(() => runner.setMessagesParams((params) => ({ ...params, messages: [] }))).toThrow(refusal);
          // Other params can still change, and the change is kept after the history is replaced.
          runner.setMessagesParams((params) => ({ ...params, max_tokens: 2048 }));
        }
      });

      expect(bodies[2]!['messages']).toEqual(compactionBlockAlone());
      expect(bodies[2]!['max_tokens']).toBe(2048);
    });

    it('has no tool results to give for the compaction response', async () => {
      const { runner, handleRequest } = setupTest();

      reply(handleRequest, [], toolTurn(), false);
      reply(handleRequest, [], compacted(), false);

      const iterator = runner[Symbol.asyncIterator]();
      await expectEvent(iterator, () => runner.compactBeforeNextTurn());
      await expectEvent(iterator, async (message) => {
        expect(message.stop_reason).toBe('compaction');
        await expect(runner.generateToolResponse()).resolves.toBeNull();
      });
    });

    it('lets the messages change again after a compaction request fails', async () => {
      const { runner, handleRequest } = setupTest();

      reply(handleRequest, [], toolTurn(), false);
      handleRequest(badRequest);

      await expect(
        run(runner, (message) => {
          if (message.stop_reason === 'tool_use') {
            runner.compactBeforeNextTurn();
          }
        }),
      ).rejects.toThrow(Anthropic.BadRequestError);

      runner.pushMessages({ role: 'user', content: 'And in NYC?' });
      expect(runner.params.messages).toHaveLength(4);
    });

    it('lets the messages change again after leaving the loop on the compaction response', async () => {
      const { runner, handleRequest } = setupTest();

      reply(handleRequest, [], toolTurn(), false);
      reply(handleRequest, [], compacted(), false);

      for await (const message of runner) {
        if (message.stop_reason === 'compaction') {
          break;
        }
        runner.compactBeforeNextTurn();
      }

      runner.pushMessages({ role: 'user', content: 'And in NYC?' });
      expect(runner.params.messages).toHaveLength(4);
    });

    it('refuses `compaction` in the runner params', () => {
      const refusal =
        '`compaction` cannot be set on a tool runner: every request in the loop would compact again. ' +
        'Call `runner.compactBeforeNextTurn()` when the conversation should be compacted instead.';
      const compaction = { type: 'summarize' as const };

      // @ts-expect-error `compaction` is left out of the runner's params type
      expect(() => setupTest({ compaction })).toThrow(refusal);

      const { runner } = setupTest();
      expect(() => runner.setMessagesParams((params) => ({ ...params, compaction }))).toThrow(refusal);
      expect(() => runner.setMessagesParams({ ...runner.params, compaction } as ToolRunnerParams)).toThrow(
        refusal,
      );
      expect(runner.params).not.toHaveProperty('compaction');
    });

    it('is refused while context_management has a compaction edit', async () => {
      const compactionEdit = { type: 'compact_20260112' as const };
      const context_management = { edits: [compactionEdit] };
      const refusal = 'has a compaction edit';

      expect(() => setupTest({ context_management }).runner.compactBeforeNextTurn()).toThrow(refusal);

      // Once a compaction is scheduled, the setter refuses the edit too...
      const edits: Array<typeof compactionEdit> = [];
      const { runner, handleRequest } = setupTest({ context_management: { edits } });
      failOnAnotherRequest(handleRequest);
      runner.compactBeforeNextTurn();
      expect(() => runner.setMessagesParams((params) => ({ ...params, context_management }))).toThrow(
        refusal,
      );
      // ...and an edit made to the caller's own params object is caught when the request would be sent.
      edits.push(compactionEdit);
      await expect(runner.runUntilDone()).rejects.toThrow(refusal);
    });
  });

  describe('next step from stop_reason', () => {
    type NextStep = 'run_tools' | 'resume' | 'stop';
    // A Record over the union makes tsc reject a stop reason missing from this table.
    const expected: Record<BetaStopReason, NextStep> = {
      tool_use: 'run_tools',
      pause_turn: 'resume',
      compaction: 'resume',
      end_turn: 'stop',
      stop_sequence: 'stop',
      max_tokens: 'stop',
      model_context_window_exceeded: 'stop',
      refusal: 'stop',
    };
    const cases: Array<[BetaMessage['stop_reason'], NextStep]> = [
      ...(Object.entries(expected) as Array<[BetaStopReason, NextStep]>),
      [null, 'stop'],
      ['some_future_reason' as BetaStopReason, 'stop'],
    ];

    // Every first turn carries a client tool_use block; only `run_tools` may execute it.
    it.each(cases)('%s → %s', async (stop_reason, nextStep) => {
      const runSpy = vi.fn(async ({ location }: { location: string }) => `Sunny in ${location}`);
      const { runner, handleRequest } = setupTest({ tools: [{ ...weatherTool, run: runSpy }] });
      const bodies: Array<Record<string, unknown>> = [];
      const first = assistantMessage(stop_reason, getWeatherToolUse('SF'));

      reply(handleRequest, bodies, first, false);
      if (nextStep !== 'stop') {
        reply(handleRequest, bodies, assistantMessage('end_turn', getTextContent()), false);
      }
      handleRequest(async () => {
        throw new Error('Runner made an unexpected request');
      });

      const final = await runner.runUntilDone();

      const followUp = {
        run_tools: [
          { role: 'user', content: 'What is the weather?' },
          { role: 'assistant', content: first.content },
          { role: 'user', content: [getWeatherToolResult('SF')] },
        ],
        resume: [
          { role: 'user', content: 'What is the weather?' },
          { role: 'assistant', content: first.content },
        ],
        stop: undefined,
      }[nextStep];
      expect(bodies.map((body) => body['messages'])[1]).toEqual(followUp);
      expect(bodies).toHaveLength(nextStep === 'stop' ? 1 : 2);
      expect(runSpy).toHaveBeenCalledTimes(nextStep === 'run_tools' ? 1 : 0);
      expect(final.id).toBe(nextStep === 'stop' ? first.id : 'msg_end_turn');
    });

    it('does not execute the tool call of a max_tokens-truncated turn', async () => {
      const runSpy = vi.fn(async () => {
        throw new Error('truncated tool call must not run');
      });
      const { runner, handleRequest } = setupTest({ tools: [{ ...weatherTool, run: runSpy }] });
      const bodies: Array<Record<string, unknown>> = [];

      reply(handleRequest, bodies, assistantMessage('max_tokens', getWeatherToolUse('SF')), false);
      handleRequest(async () => {
        throw new Error('Runner made a request after a max_tokens turn');
      });

      await expect(runner.runUntilDone()).resolves.toMatchObject({ stop_reason: 'max_tokens' });
      expect(bodies).toHaveLength(1);
      expect(runSpy).not.toHaveBeenCalled();
      expect(runner.params.messages).toHaveLength(2);
    });
  });

  describe('.runUntilDone()', () => {
    it('consumes iterator if not started', async () => {
      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Test done method' }],
      });

      handleAssistantMessage(getTextContent());
      const finalMessage = await runner.runUntilDone();
      expect(finalMessage.content[0]).toMatchObject(getTextContent());
    });
  });

  describe('.done()', () => {
    it('waits for completion when iterator is consumed', async () => {
      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Test done method' }],
      });

      // Start consuming in background
      const consumePromise = (async () => {
        for await (const _ of runner) {
          // Just consume
        }
      })();

      handleAssistantMessage(getTextContent());
      const finalMessage = await runner.done();
      expect(finalMessage.content[0]).toMatchObject(getTextContent());

      await consumePromise;
    });
  });

  describe('.generateToolResponse()', () => {
    it('returns tool response for last message', async () => {
      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Get weather' }],
      });

      const iterator = runner[Symbol.asyncIterator]();

      // First message create call should respond with a tool use.
      handleAssistantMessage(getWeatherToolUse('Miami'));
      await iterator.next();
      // When we call generateToolResponse, assert that we respond with the tool result.
      const toolResponse = await runner.generateToolResponse();
      expect(toolResponse).toMatchObject({ role: 'user', content: [getWeatherToolResult('Miami')] });
      // At this point we should still only have the initial user message
      // The assistant message gets added after the yield completes
      expect(runner.params.messages.length).toBe(1);

      // Ending the tool loop with an assistant message should work as expected.
      handleAssistantMessage(getTextContent());
      await iterator.next();
      await expectDone(iterator);
    });

    it('calls tools at most once', async () => {
      let weatherToolCallCount = 0;
      const trackingWeatherTool: BetaRunnableTool<{ location: string }> = {
        type: 'custom',
        name: 'getWeather',
        description: 'Get weather',
        input_schema: { type: 'object', properties: { location: { type: 'string' } } },
        run: async ({ location }) => {
          weatherToolCallCount++;
          return `Sunny in ${location}`;
        },
        parse: (input: unknown) => input as { location: string },
      };

      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Get weather' }],
        tools: [trackingWeatherTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      // Assistant requests tool
      handleAssistantMessage(getWeatherToolUse('Boston'));
      await iterator.next();

      // Tools are executed automatically in the ToolRunner after receiving tool_use blocks
      // The generateToolResponse is called internally, which should trigger the tool
      // Let's call it manually to verify caching behavior
      const response1 = await runner.generateToolResponse();
      expect(weatherToolCallCount).toBe(1); // Tool should be called once
      expect(response1).toMatchObject({
        role: 'user',
        content: [getWeatherToolResult('Boston')],
      });
      const response2 = await runner.generateToolResponse();
      expect(weatherToolCallCount).toBe(1); // Still 1, cached
      expect(response2).toMatchObject({
        role: 'user',
        content: [getWeatherToolResult('Boston')],
      });

      // Final response should be an assistant response.
      handleAssistantMessage(getTextContent());
      await iterator.next();

      // At this point, the iterator should be completely consumed.
      await expectDone(iterator);

      // Since we've never called setMessagesParams(), we should expect the tool to only be called once since it should
      // all be cached. Note, that the caching mechanism here should be async-safe.
      expect(weatherToolCallCount).toBe(1);
    });

    it('returns null when no tools need execution', async () => {
      const { runner, handleAssistantMessage } = setupTest({
        messages: [{ role: 'user', content: 'Just chat' }],
      });

      const iterator = runner[Symbol.asyncIterator]();

      handleAssistantMessage(getTextContent());
      await iterator.next();

      // Since the previous block is a text response, we should expect generateToolResponse to return null
      const toolResponse = await runner.generateToolResponse();
      expect(toolResponse).toBeNull();
      await expectDone(iterator);
    });
  });

  describe('x-stainless-helper header', () => {
    it('includes BetaToolRunner for regular tools', async () => {
      const { fetch, handleRequest } = mockFetch();
      const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });

      let capturedHelperHeader: string | null = null;
      handleRequest(async (_req, init) => {
        const headers = init?.headers;
        if (headers instanceof Headers) {
          capturedHelperHeader = headers.get('x-stainless-helper');
        }
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'end_turn',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      const runner = client.beta.messages.toolRunner({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [weatherTool],
      });

      await runner.runUntilDone();

      expect(capturedHelperHeader).toBe('BetaToolRunner');
    });

    it('includes BetaToolRunner,mcpTool for MCP tools', async () => {
      const { fetch, handleRequest } = mockFetch();
      const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });

      // Create an MCP-like tool with the symbol
      const mcpMarkedTool = {
        type: 'custom' as const,
        name: 'getMCPWeather',
        description: 'Get weather from MCP',
        input_schema: { type: 'object' as const, properties: { location: { type: 'string' } } },
        run: async ({ location }: { location: string }) => `Sunny in ${location}`,
        parse: (input: unknown) => input as { location: string },
        [SDK_HELPER_SYMBOL]: 'mcpTool',
      };

      let capturedHelperHeader: string | null = null;
      handleRequest(async (_req, init) => {
        const headers = init?.headers;
        if (headers instanceof Headers) {
          capturedHelperHeader = headers.get('x-stainless-helper');
        }
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'end_turn',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      const runner = client.beta.messages.toolRunner({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [mcpMarkedTool],
      });

      await runner.runUntilDone();

      expect(capturedHelperHeader).toBe('mcpTool, BetaToolRunner');
    });

    it('includes only BetaToolRunner,mcpTool once for multiple MCP tools', async () => {
      const { fetch, handleRequest } = mockFetch();
      const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });

      // Create multiple MCP-like tools
      const mcpTool1 = {
        type: 'custom' as const,
        name: 'tool1',
        input_schema: { type: 'object' as const },
        run: async () => 'result1',
        [SDK_HELPER_SYMBOL]: 'mcpTool',
      };

      const mcpTool2 = {
        type: 'custom' as const,
        name: 'tool2',
        input_schema: { type: 'object' as const },
        run: async () => 'result2',
        [SDK_HELPER_SYMBOL]: 'mcpTool',
      };

      let capturedHelperHeader: string | null = null;
      handleRequest(async (_req, init) => {
        const headers = init?.headers;
        if (headers instanceof Headers) {
          capturedHelperHeader = headers.get('x-stainless-helper');
        }
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'end_turn',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      const runner = client.beta.messages.toolRunner({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [mcpTool1, mcpTool2],
      });

      await runner.runUntilDone();

      // mcpTool should appear only once even with multiple MCP tools
      expect(capturedHelperHeader).toBe('mcpTool, BetaToolRunner');
    });

    it('includes BetaToolRunner,mcpTool for mixed tools (MCP and regular)', async () => {
      const { fetch, handleRequest } = mockFetch();
      const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });

      const mcpMarkedTool = {
        type: 'custom' as const,
        name: 'mcpTool',
        input_schema: { type: 'object' as const },
        run: async () => 'mcp result',
        [SDK_HELPER_SYMBOL]: 'mcpTool',
      };

      let capturedHelperHeader: string | null = null;
      handleRequest(async (_req, init) => {
        const headers = init?.headers;
        if (headers instanceof Headers) {
          capturedHelperHeader = headers.get('x-stainless-helper');
        }
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'end_turn',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      const runner = client.beta.messages.toolRunner({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [weatherTool, mcpMarkedTool], // Mix of regular and MCP tools
      });

      await runner.runUntilDone();

      // Should include both BetaToolRunner and mcpTool
      expect(capturedHelperHeader).toBe('mcpTool, BetaToolRunner');
    });

    it('preserves x-stainless-helper header when signal is passed via constructor options', async () => {
      const { fetch, handleRequest } = mockFetch();
      const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });

      const controller = new AbortController();
      let capturedHelperHeader: string | null = null;
      handleRequest(async (_req, init) => {
        const headers = init?.headers;
        if (headers instanceof Headers) {
          capturedHelperHeader = headers.get('x-stainless-helper');
        }
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'end_turn',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      const runner = client.beta.messages.toolRunner(
        {
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Hello' }],
          tools: [weatherTool],
        },
        { signal: controller.signal },
      );

      await runner.runUntilDone();
      expect(capturedHelperHeader).toBe('BetaToolRunner');
    });

    it('includes message helpers when using marked messages', async () => {
      const { fetch, handleRequest } = mockFetch();
      const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });

      // Create a message marked with the symbol (simulating mcpMessage)
      const markedMessage = {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'Hello', [SDK_HELPER_SYMBOL]: 'mcpContent' }],
        [SDK_HELPER_SYMBOL]: 'mcpMessage',
      };

      let capturedHelperHeader: string | null = null;
      handleRequest(async (_req, init) => {
        const headers = init?.headers;
        if (headers instanceof Headers) {
          capturedHelperHeader = headers.get('x-stainless-helper');
        }
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'end_turn',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      const runner = client.beta.messages.toolRunner({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1000,
        messages: [markedMessage],
        tools: [weatherTool],
      });

      await runner.runUntilDone();

      // Should include BetaToolRunner, mcpMessage, and mcpContent
      expect(capturedHelperHeader).toContain('BetaToolRunner');
      expect(capturedHelperHeader).toContain('mcpMessage');
      expect(capturedHelperHeader).toContain('mcpContent');
    });
  });

  describe('abort signal support', () => {
    it('passes abort signal and toolUseBlock to tool run method', async () => {
      let capturedContext: BetaToolRunContext | undefined = undefined;

      const signalTool: BetaRunnableTool<{ value: string }> = {
        type: 'custom',
        name: 'signalTool',
        description: 'Tool that captures signal',
        input_schema: { type: 'object', properties: { value: { type: 'string' } } },
        run: async (args, context) => {
          capturedContext = context;
          return `Received: ${args.value}`;
        },
        parse: (input: unknown) => input as { value: string },
      };

      const { fetch, handleRequest } = mockFetch();
      const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });
      const controller = new AbortController();

      // First response: tool use
      handleRequest(async () => {
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'tool_1', name: 'signalTool', input: { value: 'hello' } }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'tool_use',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Second response: final text
      handleRequest(async () => {
        return new Response(
          JSON.stringify({
            id: 'msg_2',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Done!', citations: null }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'end_turn',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      const runner = client.beta.messages.toolRunner(
        {
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test signal' }],
          tools: [signalTool],
        },
        { signal: controller.signal },
      );

      await runner.runUntilDone();

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.signal).toBe(controller.signal);
      expect(capturedContext!.toolUseBlock).toMatchObject({
        type: 'tool_use',
        id: 'tool_1',
        name: 'signalTool',
        input: { value: 'hello' },
      });
    });

    it('passes undefined signal when no signal is provided', async () => {
      let capturedContext: BetaToolRunContext | undefined = undefined;

      const signalTool: BetaRunnableTool<{ value: string }> = {
        type: 'custom',
        name: 'signalTool',
        description: 'Tool that captures signal',
        input_schema: { type: 'object', properties: { value: { type: 'string' } } },
        run: async (_args, context) => {
          capturedContext = context;
          return 'done';
        },
        parse: (input: unknown) => input as { value: string },
      };

      const { runner, handleAssistantMessage } = setupTest({
        tools: [signalTool],
      });

      const iterator = runner[Symbol.asyncIterator]();

      handleAssistantMessage({
        type: 'tool_use',
        id: 'tool_1',
        name: 'signalTool',
        input: { value: 'test' },
      });
      await iterator.next();

      handleAssistantMessage(getTextContent());
      await iterator.next();
      await expectDone(iterator);

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.signal).toBeUndefined();
      expect(capturedContext!.toolUseBlock).toMatchObject({
        type: 'tool_use',
        id: 'tool_1',
        name: 'signalTool',
      });
    });
  });

  describe('.setRequestOptions()', () => {
    it('updates options with direct object and preserves helper headers', async () => {
      let capturedContext: BetaToolRunContext | undefined = undefined;
      let capturedHelperHeader: string | null = null;

      const signalTool: BetaRunnableTool<{ value: string }> = {
        type: 'custom',
        name: 'signalTool',
        description: 'Tool that captures signal',
        input_schema: { type: 'object', properties: { value: { type: 'string' } } },
        run: async (_args, context) => {
          capturedContext = context;
          return 'done';
        },
        parse: (input: unknown) => input as { value: string },
      };

      const { fetch, handleRequest } = mockFetch();
      const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });
      const controller = new AbortController();

      // First response: tool use
      handleRequest(async (_req, init) => {
        const headers = init?.headers;
        if (headers instanceof Headers) {
          capturedHelperHeader = headers.get('x-stainless-helper');
        }
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'tool_1', name: 'signalTool', input: { value: 'hello' } }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'tool_use',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Second response: final text
      handleRequest(async () => {
        return new Response(
          JSON.stringify({
            id: 'msg_2',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Done!', citations: null }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'end_turn',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Create runner without signal initially
      const runner = client.beta.messages.toolRunner({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Test' }],
        tools: [signalTool],
      });

      // Set signal via setRequestOptions
      runner.setRequestOptions({ signal: controller.signal });

      await runner.runUntilDone();

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.signal).toBe(controller.signal);
      // setRequestOptions with direct object should not drop the helper header
      expect(capturedHelperHeader).toContain('BetaToolRunner');
    });

    it('updates options with mutator function', async () => {
      let capturedContext: BetaToolRunContext | undefined = undefined;

      const signalTool: BetaRunnableTool<{ value: string }> = {
        type: 'custom',
        name: 'signalTool',
        description: 'Tool that captures signal',
        input_schema: { type: 'object', properties: { value: { type: 'string' } } },
        run: async (_args, context) => {
          capturedContext = context;
          return 'done';
        },
        parse: (input: unknown) => input as { value: string },
      };

      const { fetch, handleRequest } = mockFetch();
      const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });
      const controller = new AbortController();

      // First response: tool use
      handleRequest(async () => {
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'tool_1', name: 'signalTool', input: { value: 'hello' } }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'tool_use',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Second response: final text
      handleRequest(async () => {
        return new Response(
          JSON.stringify({
            id: 'msg_2',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Done!', citations: null }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'end_turn',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      const runner = client.beta.messages.toolRunner({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Test' }],
        tools: [signalTool],
      });

      // Set signal via mutator function
      runner.setRequestOptions((prev) => ({
        ...prev,
        signal: controller.signal,
      }));

      await runner.runUntilDone();

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.signal).toBe(controller.signal);
    });
  });

  describe('fallbackState request option', () => {
    it('forwards the same fallbackState to every turn', async () => {
      const seenStates: (BetaFallbackState | undefined)[] = [];
      const middleware: Middleware = (request, next, ctx) => {
        seenStates.push(ctx.options?.fallbackState);
        return next(request);
      };

      const { fetch, handleRequest } = mockFetch();
      const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0, middleware: [middleware] });

      // First response: tool use
      handleRequest(async () => {
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'tool_1', name: 'getWeather', input: { location: 'SF' } }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'tool_use',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Second response: final text
      handleRequest(async () => {
        return new Response(
          JSON.stringify({
            id: 'msg_2',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Done!', citations: null }],
            model: 'claude-3-5-sonnet-latest',
            stop_reason: 'end_turn',
            stop_sequence: null,
            container: null,
            context_management: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      const fallbackState = new BetaFallbackState();
      const runner = client.beta.messages.toolRunner(
        {
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
          tools: [weatherTool],
        },
        { fallbackState },
      );

      await runner.runUntilDone();

      expect(seenStates).toHaveLength(2);
      expect(seenStates[0]).toBe(fallbackState);
      expect(seenStates[1]).toBe(fallbackState);
    });
  });
});
