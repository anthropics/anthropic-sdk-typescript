import Anthropic from '@anthropic-ai/sdk';
import { mockFetch } from '../../lib/mock-fetch';
import { BetaMessage, BetaContentBlock, BetaToolResultBlockParam } from '@anthropic-ai/sdk/resources/beta';
import { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { BetaRawMessageStreamEvent } from '@anthropic-ai/sdk/resources/beta/messages';
import { Fetch } from '@anthropic-ai/sdk/internal/builtin-types';

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
      stop_reason: null,
      stop_sequence: null,
      container: null,
      context_management: null,
      usage: {
        cache_creation: null,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        input_tokens: message.usage.input_tokens,
        output_tokens: 0,
        server_tool_use: null,
        service_tier: null,
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
      stop_reason: message.stop_reason,
      container: message.container,
      stop_sequence: message.stop_sequence,
    },
    context_management: null,
    usage: {
      output_tokens: message.usage?.output_tokens || 0,
      input_tokens: message.usage?.input_tokens || 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      server_tool_use: null,
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
      stop_reason,
      stop_sequence: null,
      container: null,
      context_management: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation: null,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        server_tool_use: null,
        service_tier: null,
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
      stop_reason,
      stop_sequence: null,
      container: null,
      context_management: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation: null,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        server_tool_use: null,
        service_tier: null,
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
});
