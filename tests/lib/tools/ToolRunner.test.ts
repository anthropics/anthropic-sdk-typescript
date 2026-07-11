import Anthropic, { BetaFallbackState, type Middleware } from '@anthropic-ai/sdk';
import { mockFetch } from '../../lib/mock-fetch';
import {
  BetaContainer,
  BetaMessage,
  BetaContentBlock,
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
    } else if (block.type === 'tool_use') {
      events.push({
        type: 'content_block_start',
        index,
        content_block: {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: '',
        },
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
      server_tool_use: null,
      iterations: null,
    },
  });

  events.push({
    type: 'message_stop',
  });

  return events;
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

function setupTest(params?: Partial<ToolRunnerParams> & { stream?: false }): SetupTestResult<false>;
function setupTest(params: Partial<ToolRunnerParams> & { stream: true }): SetupTestResult<true>;
function setupTest(params: Partial<ToolRunnerParams> = {}): SetupTestResult<boolean> {
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

  const client = new Anthropic({ apiKey: 'test-key', fetch: fetch, maxRetries: 0 });

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

const CONTAINER_ID = 'container_01Q9CzvCUGo5cSz4Harm6ngG';
const OTHER_CONTAINER_ID = 'container_01ZzKkWwXxYyAaBbCcDdEeFf';

function container(id: string): BetaContainer {
  return { id, expires_at: '2026-07-11T00:00:00Z', skills: null };
}

function assistantMessage(
  id: string,
  content: BetaContentBlock[],
  container: BetaContainer | null = null,
): BetaMessage {
  const hasToolUse = content.some((block) => block.type === 'tool_use');
  return {
    id,
    type: 'message',
    role: 'assistant',
    content,
    model: 'claude-3-5-sonnet-latest',
    stop_details: null,
    stop_reason: hasToolUse ? 'tool_use' : 'end_turn',
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
      server_tool_use: null,
      service_tier: null,
      inference_geo: null,
      iterations: null,
      speed: null,
    },
  };
}

/**
 * Records the parsed body of every outgoing request, so a test can assert on what the runner actually
 * put on the wire for each turn, and counts tool invocations so a duplicated turn is visible.
 */
function setupRecordingTest(params: Partial<ToolRunnerParams> = {}) {
  const { fetch: mockedFetch, handleRequest, handleStreamEvents } = mockFetch();
  const bodies: Record<string, any>[] = [];
  let toolRuns = 0;

  const fetch: Fetch = async (req, init) => {
    if (typeof init?.body === 'string') {
      bodies.push(JSON.parse(init.body));
    }
    return mockedFetch(req, init);
  };

  const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });

  const countingWeatherTool: BetaRunnableTool<{ location: string }> = {
    ...weatherTool,
    run: async ({ location }) => {
      toolRuns++;
      return `Sunny in ${location}`;
    },
  };

  const respond = (message: BetaMessage) => {
    handleRequest(
      async () =>
        new Response(JSON.stringify(message), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
  };
  const respondStream = (message: BetaMessage) => {
    handleStreamEvents(betaMessageToStreamEvents(message));
  };

  const runner = client.beta.messages.toolRunner({
    messages: [{ role: 'user', content: 'What is the weather?' }],
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 1000,
    tools: [countingWeatherTool],
    ...params,
  } as ToolRunnerParams);

  return { runner, bodies, respond, respondStream, toolRuns: () => toolRuns };
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
    expect(async () => await runner[Symbol.asyncIterator]().next()).rejects.toThrow(
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
      await expectEvent(iterator2, (message) => {
        expect(message.finalMessage()).resolves.toMatchObject({ content: [getTextContent()] });
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
      const runSpy = jest.fn(async () => 'should never run');
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
        messages: [
          ...params.messages,
          { role: 'assistant', content: [getWeatherToolUse('London', 'tool_2')] },
        ],
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

  describe('container', () => {
    it('forwards a server-reported container id on the next request', async () => {
      const { runner, bodies, respond } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')]));
      respond(assistantMessage('msg_2', [getWeatherToolUse('NYC')], container(CONTAINER_ID)));
      respond(assistantMessage('msg_3', [getTextContent('Done')]));

      await runner.runUntilDone();

      expect(bodies).toHaveLength(3);
      expect(bodies[0]).not.toHaveProperty('container');
      expect(bodies[1]).not.toHaveProperty('container');
      expect(bodies[2]!['container']).toBe(CONTAINER_ID);
    });

    it('forwards a server-reported container id on the next request when streaming', async () => {
      const { runner, bodies, respondStream } = setupRecordingTest({ stream: true });

      respondStream(assistantMessage('msg_1', [getWeatherToolUse('SF')]));
      respondStream(assistantMessage('msg_2', [getWeatherToolUse('NYC')], container(CONTAINER_ID)));
      respondStream(assistantMessage('msg_3', [getTextContent('Done')]));

      await runner.runUntilDone();

      expect(bodies).toHaveLength(3);
      expect(bodies[2]!['container']).toBe(CONTAINER_ID);
    });

    it("preserves the caller's container config, replacing only the id", async () => {
      const skills = [{ type: 'custom' as const, skill_id: 'skill_1', version: 'latest' }];
      const { runner, bodies, respond } = setupRecordingTest({ container: { skills } });

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')]));
      respond(assistantMessage('msg_2', [getWeatherToolUse('NYC')], container(CONTAINER_ID)));
      respond(assistantMessage('msg_3', [getTextContent('Done')]));

      await runner.runUntilDone();

      expect(bodies[0]!['container']).toEqual({ skills });
      expect(bodies[2]!['container']).toEqual({ skills, id: CONTAINER_ID });
    });

    it('forwards the latest container id when the server reports a new one', async () => {
      const { runner, bodies, respond } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')], container(CONTAINER_ID)));
      respond(assistantMessage('msg_2', [getWeatherToolUse('NYC')], container(OTHER_CONTAINER_ID)));
      respond(assistantMessage('msg_3', [getTextContent('Done')]));

      await runner.runUntilDone();

      expect(bodies[1]!['container']).toBe(CONTAINER_ID);
      expect(bodies[2]!['container']).toBe(OTHER_CONTAINER_ID);
    });

    it('keeps the captured container id when a later response reports no container', async () => {
      const { runner, bodies, respond } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')], container(CONTAINER_ID)));
      respond(assistantMessage('msg_2', [getWeatherToolUse('NYC')], null));
      respond(assistantMessage('msg_3', [getTextContent('Done')]));

      await runner.runUntilDone();

      expect(bodies[1]!['container']).toBe(CONTAINER_ID);
      expect(bodies[2]!['container']).toBe(CONTAINER_ID);
    });

    it('captures the container id when only non-message params change', async () => {
      const { runner, bodies, respond } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')], container(CONTAINER_ID)));
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      runner.setMessagesParams((params) => ({ ...params, max_tokens: 512 }));
      await iterator.next();
      await iterator.next();
      await runner.done();

      expect(bodies[1]!['container']).toBe(CONTAINER_ID);
    });

    it('captures the container id when the consumer pushes a message during the turn', async () => {
      const { runner, bodies, respond } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')], container(CONTAINER_ID)));
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      runner.pushMessages({ role: 'user', content: 'Also NYC?' });
      await iterator.next();
      await iterator.next();
      await runner.done();

      expect(bodies[1]!['container']).toBe(CONTAINER_ID);
    });

    it('keeps the container id when the consumer replaces params wholesale', async () => {
      const { runner, bodies, respond } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')], container(CONTAINER_ID)));
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      // A wholesale replacement, as the setMessagesParams docs advertise. A container id stored in the
      // params would be dropped here.
      runner.setMessagesParams({
        messages: [{ role: 'user', content: 'What is the weather?' }],
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 512,
        tools: [weatherTool],
      });
      await iterator.next();
      await iterator.next();
      await runner.done();

      expect(bodies[1]!['container']).toBe(CONTAINER_ID);
    });

    it('does not override a container id the caller set', async () => {
      const { runner, bodies, respond } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')], container(CONTAINER_ID)));
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      runner.setMessagesParams((params) => ({ ...params, container: 'container_from_caller' }));
      await iterator.next();
      await iterator.next();
      await runner.done();

      expect(bodies[1]!['container']).toBe('container_from_caller');
    });

    it('does not override an explicit null from the caller', async () => {
      const { runner, bodies, respond } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')], container(CONTAINER_ID)));
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      runner.setMessagesParams((params) => ({ ...params, container: null }));
      await iterator.next();
      await iterator.next();
      await runner.done();

      expect(bodies[1]!['container']).toBeNull();
    });

    it('does not override an id the caller set inside a container object', async () => {
      const skills = [{ type: 'custom' as const, skill_id: 'skill_1', version: 'latest' }];
      const { runner, bodies, respond } = setupRecordingTest({
        container: { id: 'container_from_caller', skills },
      });

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')], container(CONTAINER_ID)));
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      await runner.runUntilDone();

      expect(bodies[1]!['container']).toEqual({ id: 'container_from_caller', skills });
    });
  });

  describe('conversation history across setMessagesParams', () => {
    it('does not append the assistant turn after a message pushed during the same turn', async () => {
      const { runner, bodies, respond, toolRuns } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')]));
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      runner.pushMessages({ role: 'user', content: 'Also NYC?' });
      // A later param-only change must not undo the fact that the caller took over the history.
      runner.setMessagesParams((params) => ({ ...params, max_tokens: 512 }));
      await iterator.next();
      await iterator.next();
      await runner.done();

      expect(bodies[1]!['messages']).toMatchObject([{ role: 'user' }, { role: 'user' }]);
      expect(toolRuns()).toBe(0);
    });

    it('does not duplicate an assistant turn recorded by an in-place mutator', async () => {
      const { runner, bodies, respond, toolRuns } = setupRecordingTest();

      const first = assistantMessage('msg_1', [getWeatherToolUse('SF')]);
      respond(first);
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      runner.setMessagesParams((params) => {
        // Mutates the existing array rather than replacing it — the caller has still taken over.
        params.messages.push({ role: 'assistant', content: first.content });
        params.messages.push({ role: 'user', content: [getWeatherToolResult('SF')] });
        return params;
      });
      await iterator.next();
      await iterator.next();
      await runner.done();

      expect(bodies[1]!['messages']).toMatchObject([
        { role: 'user' },
        { role: 'assistant' },
        { role: 'user' },
      ]);
      expect(toolRuns()).toBe(0);
    });

    it('does not record the assistant turn when a mutator rewrites a message in place', async () => {
      const { runner, bodies, respond, toolRuns } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')]));
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      runner.setMessagesParams((params) => {
        // Same array, same length — a redaction pass, say. The caller still owns the history.
        params.messages[0] = { role: 'user', content: 'Rewritten' };
        return params;
      });
      await iterator.next();
      await iterator.next();
      await runner.done();

      expect(bodies[1]!['messages']).toMatchObject([{ role: 'user', content: 'Rewritten' }]);
      expect(toolRuns()).toBe(0);
    });

    it('does not duplicate the assistant turn when a mutator slides the window in place', async () => {
      const { runner, bodies, respond, toolRuns } = setupRecordingTest({
        messages: [
          { role: 'user', content: 'First' },
          { role: 'user', content: 'What is the weather?' },
        ],
      });

      const first = assistantMessage('msg_1', [getWeatherToolUse('SF')]);
      respond(first);
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      runner.setMessagesParams((params) => {
        // Drops the oldest turn and records the assistant one: same array, same length.
        params.messages.shift();
        params.messages.push({ role: 'assistant', content: first.content });
        return params;
      });
      await iterator.next();
      await iterator.next();
      await runner.done();

      expect(bodies[1]!['messages']).toMatchObject([
        { role: 'user' },
        { role: 'assistant' },
        { role: 'user' },
      ]);
      expect(toolRuns()).toBe(1);
    });

    it('ends the run when only params change on a turn with no tool calls', async () => {
      const { runner, bodies, respond } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getTextContent('Done')]));
      // Queued so that an unwanted second request fails an assertion rather than hanging the test.
      respond(assistantMessage('msg_2', [getTextContent('Again')]));

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      runner.setMessagesParams((params) => ({ ...params, max_tokens: 512 }));
      const result = await iterator.next();

      // The model ended its turn and there is no tool work left, so a param-only change has nothing to
      // apply to and the run is over.
      expect(result.done).toBe(true);
      expect(bodies).toHaveLength(1);
    });

    it('omits container entirely when the server never reports one', async () => {
      const { runner, bodies, respond } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')]));
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      await runner.runUntilDone();

      expect(bodies).toHaveLength(2);
      for (const body of bodies) {
        expect(body).not.toHaveProperty('container');
      }
    });

    it("leaves the caller's container id untouched when the server reports none", async () => {
      const { runner, bodies, respond } = setupRecordingTest({ container: 'container_from_caller' });

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')]));
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      await runner.runUntilDone();

      expect(bodies[0]!['container']).toBe('container_from_caller');
      expect(bodies[1]!['container']).toBe('container_from_caller');
    });

    it('records the assistant turn when setMessagesParams leaves messages untouched', async () => {
      const { runner, bodies, respond } = setupRecordingTest();

      respond(assistantMessage('msg_1', [getWeatherToolUse('SF')]));
      respond(assistantMessage('msg_2', [getTextContent('Done')]));

      const iterator = runner[Symbol.asyncIterator]();
      await iterator.next();
      runner.setMessagesParams((params) => ({ ...params, max_tokens: 512 }));
      await iterator.next();
      await iterator.next();
      await runner.done();

      expect(bodies).toHaveLength(2);
      expect(bodies[1]!['max_tokens']).toBe(512);
      expect(bodies[1]!['messages']).toMatchObject([
        { role: 'user' },
        { role: 'assistant', content: [getWeatherToolUse('SF')] },
        { role: 'user', content: [getWeatherToolResult('SF')] },
      ]);
    });
  });
});
