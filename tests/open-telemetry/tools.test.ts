import { context, trace, SpanKind, SpanStatusCode, type Attributes } from '@opentelemetry/api';
import { BasicTracerProvider, SamplingDecision, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import Anthropic, { type OpenTelemetryOptions } from '@anthropic-ai/sdk';
import { SessionToolRunner } from '@anthropic-ai/sdk/lib/tools/SessionToolRunner';
import { setContentAttributes } from '@anthropic-ai/sdk/lib/internal/tracing/content';
import { mcpTool } from '@anthropic-ai/sdk/helpers/beta/mcp';
import type { BetaRunnableToolset } from '@anthropic-ai/sdk/lib/tools/BetaRunnableToolset';
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError';
import {
  exporter,
  pathID,
  provider,
  tracer,
  makeClient,
  json,
  sse,
  MESSAGE,
  PARAMS,
  STREAM_EVENTS,
  spans,
  onlySpan,
  parentId,
  setUpTracing,
} from './utils';
import TOOL_SIZE_LIMIT_CASES from './tool-size-limit-cases.json';

setUpTracing();

describe('OpenTelemetry spans', () => {
  describe('tool runner', () => {
    const toolUseMessage = {
      ...MESSAGE,
      id: 'msg_tool',
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: {} }],
    };

    const toolUseEvents = [
      { type: 'message_start', message: { ...toolUseMessage, content: [] } },
      { type: 'content_block_start', index: 0, content_block: toolUseMessage.content[0] },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'tool_use', stop_sequence: null },
        usage: { output_tokens: 5 },
      },
      { type: 'message_stop' },
    ];

    function weatherTool(
      run: () => Promise<NonNullable<Anthropic.Beta.BetaToolResultBlockParam['content']>>,
    ) {
      return {
        type: 'custom' as const,
        name: 'get_weather',
        input_schema: { type: 'object' as const, properties: {} },
        run,
      };
    }

    test('the tool runner span contains each API call and each tool execution', async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);
      let toolParent: string | undefined;

      await client.beta.messages
        .toolRunner(
          {
            ...PARAMS,
            tools: [
              weatherTool(async () => {
                toolParent = trace.getActiveSpan()?.spanContext().spanId;
                return 'sunny';
              }),
            ],
          },
          { openTelemetry: { conversationId: 'conv-2' } },
        )
        .runUntilDone();

      const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
      expect(toolRunnerSpan.kind).toBe(SpanKind.INTERNAL);
      expect(toolRunnerSpan.status.code).toBe(SpanStatusCode.OK);
      expect(toolRunnerSpan.attributes).toEqual({
        'gen_ai.operation.name': 'invoke_agent',
        'gen_ai.provider.name': 'anthropic',
        'gen_ai.request.model': 'model-a',
        'gen_ai.conversation.id': 'conv-2',
      });

      const calls = spans('anthropic.messages.create');
      expect(calls).toHaveLength(2);
      for (const call of calls) {
        expect(parentId(call)).toBe(toolRunnerSpan.spanContext().spanId);
        expect(call.attributes['gen_ai.conversation.id']).toBe('conv-2');
      }
      expect(calls.map((call) => call.attributes['anthropic.message.stop_reason'])).toEqual([
        'tool_use',
        'end_turn',
      ]);

      const tool = onlySpan('anthropic.custom_tool_use get_weather');
      expect(tool.kind).toBe(SpanKind.INTERNAL);
      expect(parentId(tool)).toBe(toolRunnerSpan.spanContext().spanId);
      expect(toolParent).toBe(tool.spanContext().spanId);
      expect(tool.status.code).toBe(SpanStatusCode.OK);
      expect(tool.attributes).toEqual({
        'gen_ai.operation.name': 'execute_tool',
        'gen_ai.provider.name': 'anthropic',
        'gen_ai.tool.name': 'get_weather',
        'gen_ai.tool.call.id': 'toolu_1',
        'gen_ai.tool.type': 'function',
        // The runner's conversation ID, and no Session: this is the Messages tool runner.
        'gen_ai.conversation.id': 'conv-2',
      });
    });

    test.each([false, true])(
      'only the API calls of a loop have the attributes of an HTTP request, with stream: %s',
      async (stream) => {
        const { client } = makeClient(
          stream ? [sse(toolUseEvents), sse(STREAM_EVENTS)] : [json(toolUseMessage), json(MESSAGE)],
        );

        const runner = client.beta.messages.toolRunner({
          ...PARAMS,
          stream,
          tools: [weatherTool(async () => 'mild')],
        });
        for await (const message of runner) {
          if (Symbol.asyncIterator in message) {
            for await (const _ of message) {
            }
          }
        }

        const http = (attributes: Attributes) =>
          Object.keys(attributes).filter((name) => name.startsWith('http.') || name.startsWith('url.'));
        const calls = spans('anthropic.messages.create');
        expect(calls).toHaveLength(2);
        for (const call of calls) {
          expect(call.kind).toBe(SpanKind.CLIENT);
          expect(call.attributes).toMatchObject({
            'http.request.method': 'POST',
            'http.route': '/v1/messages',
            'url.path': '/v1/messages',
            'url.full': 'http://localhost:4010/v1/messages',
          });
        }
        expect(http(onlySpan('anthropic.messages.tool_runner').attributes)).toEqual([]);
        expect(http(onlySpan('anthropic.custom_tool_use get_weather').attributes)).toEqual([]);
      },
    );

    test('the tool runner span starts with its attributes, for a sampler to decide on', async () => {
      const seen: Array<{ name: string; attributes: Attributes }> = [];
      const sampling = new BasicTracerProvider({
        sampler: {
          shouldSample: (_context, _traceId, name, _kind, attributes) => {
            seen.push({ name, attributes });
            return { decision: SamplingDecision.RECORD_AND_SAMPLED };
          },
          toString: () => 'a sampler that records what it is given',
        },
        spanProcessors: [new SimpleSpanProcessor(exporter)],
      });
      const { client } = makeClient([json(MESSAGE)], { openTelemetry: { tracerProvider: sampling } });

      await client.beta.messages
        .toolRunner(
          {
            ...PARAMS,
            tools: [],
            output_config: { format: { type: 'json_schema', schema: { type: 'object' } } },
          },
          { openTelemetry: { conversationId: 'conv-2' } },
        )
        .runUntilDone();

      const attributes = {
        'gen_ai.operation.name': 'invoke_agent',
        'gen_ai.provider.name': 'anthropic',
        'gen_ai.request.model': 'model-a',
        'gen_ai.output.type': 'json',
        'gen_ai.conversation.id': 'conv-2',
      };
      expect(seen.filter(({ name }) => name === 'anthropic.messages.tool_runner')).toEqual([
        { name: 'anthropic.messages.tool_runner', attributes },
      ]);
      expect(onlySpan('anthropic.messages.tool_runner').attributes).toEqual(attributes);
    });

    test('a tool span that does not record reads none of the tool result for content', async () => {
      // How often a run of the loop reads the text of the tool's result, which the next request reads too.
      async function readsOfTheResult(openTelemetry: OpenTelemetryOptions): Promise<number> {
        let reads = 0;
        const block = Object.defineProperty({ type: 'text' as const, text: '' }, 'text', {
          enumerable: true,
          get: () => (reads++, 'sunny'),
        });
        const { client } = makeClient([json(toolUseMessage), json(MESSAGE)], { openTelemetry });
        await client.beta.messages
          .toolRunner({ ...PARAMS, tools: [weatherTool(async () => [block])] })
          .runUntilDone();
        return reads;
      }
      const notRecording = new BasicTracerProvider({
        sampler: {
          shouldSample: () => ({ decision: SamplingDecision.NOT_RECORD }),
          toString: () => 'a sampler that records nothing',
        },
      });

      const withoutContent = await readsOfTheResult({ traces: { contentMode: 'metadata_only' } });
      const recorded = await readsOfTheResult({ traces: { contentMode: 'content' } });
      const notRecorded = await readsOfTheResult({
        tracerProvider: notRecording,
        traces: { contentMode: 'content' },
      });

      expect(recorded).toBeGreaterThan(withoutContent);
      expect(notRecorded).toBe(withoutContent);
    });

    test('a loop driven from several contexts keeps its API calls and tool executions under the tool runner span', async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);
      const runner = client.beta.messages.toolRunner({
        ...PARAMS,
        tools: [weatherTool(async () => 'sunny')],
      });
      const messages = runner[Symbol.asyncIterator]();

      await tracer.startActiveSpan('app.outer', async (outer) => {
        // The first turn starts the loop: the tool runner span is a child of the span current here.
        await tracer.startActiveSpan('app.caller_1', async (caller) => {
          expect((await messages.next()).done).toBe(false);
          caller.end();
        });
        // Work the application does between turns is its own, not the loop's.
        tracer.startSpan('app.between').end();
        // The second turn runs the tool and makes the second API call, resumed from another context.
        await tracer.startActiveSpan('app.caller_2', async (caller) => {
          expect((await messages.next()).done).toBe(false);
          caller.end();
        });
        expect((await messages.next()).done).toBe(true);
        outer.end();
      });

      const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
      expect(parentId(toolRunnerSpan)).toBe(onlySpan('app.caller_1').spanContext().spanId);
      expect(toolRunnerSpan.status.code).toBe(SpanStatusCode.OK);
      const calls = spans('anthropic.messages.create');
      expect(calls).toHaveLength(2);
      for (const call of calls) {
        expect(parentId(call)).toBe(toolRunnerSpan.spanContext().spanId);
      }
      expect(parentId(onlySpan('anthropic.custom_tool_use get_weather'))).toBe(
        toolRunnerSpan.spanContext().spanId,
      );
      expect(parentId(onlySpan('app.between'))).toBe(onlySpan('app.outer').spanContext().spanId);
      expect(parentId(onlySpan('app.caller_2'))).toBe(onlySpan('app.outer').spanContext().spanId);
    });

    test("the runner's own code between two messages runs with the tool runner span current", async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);
      // Stands in for other instrumentation: the runner reads the tool's name when it looks the
      // tool up, and every read starts a span.
      const tool = {
        ...weatherTool(async () => 'sunny'),
        get name() {
          tracer.startSpan('instrumented.read').end();
          return 'get_weather';
        },
      };
      const runner = client.beta.messages.toolRunner({ ...PARAMS, tools: [tool] });
      exporter.reset();
      const messages = runner[Symbol.asyncIterator]();

      for (const caller of ['app.caller_1', 'app.caller_2', 'app.caller_3']) {
        await tracer.startActiveSpan(caller, async (span) => {
          await messages.next();
          span.end();
        });
      }

      const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
      const inside = new Set([toolRunnerSpan.spanContext().spanId]);
      for (const span of spans()) {
        if (inside.has(parentId(span) ?? '')) inside.add(span.spanContext().spanId);
      }
      const reads = spans('instrumented.read');
      expect(reads.length).toBeGreaterThan(0);
      // The lookup of the tool happens in the second turn, which `app.caller_2` resumed.
      expect(reads.map(parentId)).toContain(toolRunnerSpan.spanContext().spanId);
      for (const read of reads) {
        expect(inside).toContain(parentId(read));
      }
    });

    test("the application's code between two messages runs with its own span current", async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);
      const runner = client.beta.messages.toolRunner({
        ...PARAMS,
        tools: [weatherTool(async () => 'sunny')],
      });

      const current: Array<string | undefined> = [];
      await tracer.startActiveSpan('app', async (app) => {
        for await (const _ of runner) {
          current.push(trace.getActiveSpan()?.spanContext().spanId);
        }
        app.end();
      });

      const appId = onlySpan('app').spanContext().spanId;
      expect(current).toEqual([appId, appId]);
      expect(parentId(onlySpan('anthropic.messages.tool_runner'))).toBe(appId);
    });

    test('the request that compactBeforeNextTurn() schedules is under the tool runner span', async () => {
      const compactionMessage = {
        ...MESSAGE,
        id: 'msg_compaction',
        content: [{ type: 'compaction', content: 'summary', encrypted_content: null }],
        usage: {
          ...MESSAGE.usage,
          iterations: [
            {
              type: 'compaction',
              input_tokens: 100,
              cache_read_input_tokens: 10,
              cache_creation_input_tokens: 5,
              cache_creation: null,
              output_tokens: 30,
            },
          ],
        },
      };
      const { client } = makeClient([json(MESSAGE), json(compactionMessage)]);
      const runner = client.beta.messages.toolRunner({ ...PARAMS, tools: [] });

      await tracer.startActiveSpan('app', async (app) => {
        for await (const message of runner) {
          if (message.id === MESSAGE.id) runner.compactBeforeNextTurn();
        }
        app.end();
      });

      const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
      const calls = spans('anthropic.messages.create');
      expect(calls).toHaveLength(2);
      for (const call of calls) {
        expect(parentId(call)).toBe(toolRunnerSpan.spanContext().spanId);
      }
      // Only the compaction's response has a compaction among its iterations.
      expect(calls.map((call) => call.attributes['anthropic.usage.compaction.input_tokens'])).toEqual([
        undefined,
        115,
      ]);
      expect(calls.map((call) => call.attributes['anthropic.usage.compaction.output_tokens'])).toEqual([
        undefined,
        30,
      ]);
    });

    test("tools the application runs with generateToolResponse() are under the application's current span", async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);
      const tools = [weatherTool(async () => 'sunny')];
      const runner = client.beta.messages.toolRunner({ ...PARAMS, tools });
      const messages = runner[Symbol.asyncIterator]();

      // While a loop runs: the span is a child of the span that is current where the application
      // calls the method, and the loop does not run the tool again.
      await messages.next();
      await tracer.startActiveSpan('app.during', async (span) => {
        await runner.generateToolResponse();
        span.end();
      });
      await messages.next();
      await messages.next();

      // No loop is running: the conversation already ends with the tool call.
      const idle = client.beta.messages.toolRunner(
        {
          ...PARAMS,
          tools,
          messages: [...PARAMS.messages, { role: 'assistant', content: toolUseMessage.content as never }],
        },
        { openTelemetry: { conversationId: 'conv-idle' } },
      );
      await tracer.startActiveSpan('app.idle', async (span) => {
        await idle.generateToolResponse();
        span.end();
      });

      const [during, whileIdle] = spans('anthropic.custom_tool_use get_weather');
      expect(spans('anthropic.custom_tool_use get_weather')).toHaveLength(2);
      expect(parentId(during!)).toBe(onlySpan('app.during').spanContext().spanId);
      expect(parentId(whileIdle!)).toBe(onlySpan('app.idle').spanContext().spanId);
      // A tool span has the runner's conversation ID inside a loop or not, and none when it is unset.
      expect(whileIdle!.attributes['gen_ai.conversation.id']).toBe('conv-idle');
      expect(during!.attributes).not.toHaveProperty('gen_ai.conversation.id');
      expect(spans('anthropic.messages.create')).toHaveLength(2);
      for (const call of spans('anthropic.messages.create')) {
        expect(call.attributes).not.toHaveProperty('gen_ai.conversation.id');
      }
    });

    test('a tool the application runs with generateToolResponse() while no span is current has a root span', async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);
      const runner = client.beta.messages.toolRunner({
        ...PARAMS,
        tools: [weatherTool(async () => 'sunny')],
      });

      // The tool runner span is open while the loop's body runs, but it is not current there.
      for await (const _ of runner) {
        await runner.generateToolResponse();
      }

      const tool = onlySpan('anthropic.custom_tool_use get_weather');
      expect(parentId(tool)).toBeUndefined();
      expect(tool.spanContext().traceId).not.toBe(
        onlySpan('anthropic.messages.tool_runner').spanContext().traceId,
      );
    });

    test('a loop whose parameters set a JSON output format reports the json output type', async () => {
      const format = { type: 'json_schema' as const, schema: { type: 'object' } };
      const other = { type: 'other' } as never;
      const { client } = makeClient([json(MESSAGE), json(MESSAGE), json(MESSAGE), json(MESSAGE)]);

      await client.beta.messages.toolRunner({ ...PARAMS, tools: [], output_config: { format } });
      await client.beta.messages.toolRunner({ ...PARAMS, tools: [], output_format: format });
      await client.beta.messages.toolRunner({ ...PARAMS, tools: [], output_config: { format: other } });
      await client.beta.messages.toolRunner({ ...PARAMS, tools: [], output_format: other });

      const toolRunnerSpans = spans('anthropic.messages.tool_runner');
      expect(toolRunnerSpans.map((span) => span.attributes['gen_ai.output.type'])).toEqual([
        'json',
        'json',
        undefined,
        undefined,
      ]);
      expect(spans('anthropic.messages.create').map((call) => call.attributes['gen_ai.output.type'])).toEqual(
        ['json', 'json', undefined, undefined],
      );
    });

    test('a tool the MCP helper made runs in an anthropic.mcp_tool_use span', async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);
      const mcpClient = { callTool: async () => ({ content: [{ type: 'text' as const, text: 'sunny' }] }) };

      await client.beta.messages
        .toolRunner({
          ...PARAMS,
          tools: [mcpTool({ name: 'get_weather', inputSchema: { type: 'object' } }, mcpClient)],
        })
        .runUntilDone();

      const tool = onlySpan('anthropic.mcp_tool_use get_weather');
      expect(tool.kind).toBe(SpanKind.INTERNAL);
      expect(parentId(tool)).toBe(onlySpan('anthropic.messages.tool_runner').spanContext().spanId);
      expect(tool.status.code).toBe(SpanStatusCode.OK);
      expect(tool.attributes).toEqual({
        'gen_ai.operation.name': 'execute_tool',
        'gen_ai.provider.name': 'anthropic',
        'gen_ai.tool.name': 'get_weather',
        'gen_ai.tool.call.id': 'toolu_1',
        'gen_ai.tool.type': 'function',
      });
      expect(spans().filter((span) => span.name.startsWith('anthropic.custom_tool_use'))).toHaveLength(0);
    });

    test('a tool span has the description in the tool definition, with content off too', async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);

      await client.beta.messages
        .toolRunner({
          ...PARAMS,
          tools: [{ ...weatherTool(async () => 'sunny'), description: 'Gets the weather of a city.' }],
        })
        .runUntilDone();

      const tool = onlySpan('anthropic.custom_tool_use get_weather');
      expect(tool.attributes['gen_ai.tool.description']).toBe('Gets the weather of a city.');
      expect(tool.attributes).not.toHaveProperty('gen_ai.tool.call.arguments');
      expect(onlySpan('anthropic.messages.tool_runner').attributes).not.toHaveProperty(
        'gen_ai.tool.description',
      );
    });

    test('a tool whose definition has an empty description, or cannot have one, has none on its span', async () => {
      const bashUseMessage = {
        ...toolUseMessage,
        content: [...toolUseMessage.content, { type: 'tool_use', id: 'toolu_2', name: 'bash', input: {} }],
      };
      const { client } = makeClient([json(bashUseMessage), json(MESSAGE)]);

      await client.beta.messages
        .toolRunner({
          ...PARAMS,
          tools: [
            { ...weatherTool(async () => 'sunny'), description: '' },
            {
              type: 'bash_20250124',
              name: 'bash',
              parse: (input: unknown) => input,
              run: async () => 'done',
            },
          ],
        })
        .runUntilDone();

      expect(onlySpan('anthropic.custom_tool_use get_weather').attributes).not.toHaveProperty(
        'gen_ai.tool.description',
      );
      expect(onlySpan('anthropic.custom_tool_use bash').attributes).not.toHaveProperty(
        'gen_ai.tool.description',
      );
    });

    test("a tool the MCP helper made has the MCP server's description", async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);
      const mcpClient = { callTool: async () => ({ content: [{ type: 'text' as const, text: 'sunny' }] }) };
      const definition = {
        name: 'get_weather',
        description: 'Weather, from the server.',
        inputSchema: { type: 'object' as const },
      };

      await client.beta.messages
        .toolRunner({ ...PARAMS, tools: [mcpTool(definition, mcpClient)] })
        .runUntilDone();

      expect(onlySpan('anthropic.mcp_tool_use get_weather').attributes['gen_ai.tool.description']).toBe(
        'Weather, from the server.',
      );
    });

    test('a streaming loop ends the span of each streamed API call', async () => {
      const { client } = makeClient([sse(toolUseEvents), sse(STREAM_EVENTS)]);

      const runner = client.beta.messages.toolRunner({
        ...PARAMS,
        stream: true,
        tools: [weatherTool(async () => 'mild')],
      });
      for await (const stream of runner) {
        for await (const _ of stream) {
        }
      }

      const calls = spans('anthropic.messages.create');
      expect(calls.map((span) => span.status.code)).toEqual([SpanStatusCode.OK, SpanStatusCode.OK]);
      // Each request of the loop reports its own stop reason. The tool runner span has none.
      expect(calls.map((span) => span.attributes['anthropic.message.stop_reason'])).toEqual([
        'tool_use',
        'end_turn',
      ]);
      expect(onlySpan('anthropic.custom_tool_use get_weather').status.code).toBe(SpanStatusCode.OK);
      const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
      expect(toolRunnerSpan.status.code).toBe(SpanStatusCode.OK);
      expect(toolRunnerSpan.attributes).not.toHaveProperty('anthropic.message.stop_reason');
      for (const span of spans()) {
        expect(span.attributes).not.toHaveProperty('gen_ai.response.finish_reasons');
      }
    });

    test.each([
      ['', false],
      [', also with runToolsEagerly', true],
    ])(
      'with contentMode: content, a streaming loop records the content of each streamed API call%s',
      async (_name, runToolsEagerly) => {
        const { client } = makeClient([sse(toolUseEvents), sse(STREAM_EVENTS)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        const runner = client.beta.messages.toolRunner({
          ...PARAMS,
          stream: true,
          runToolsEagerly,
          tools: [weatherTool(async () => 'mild')],
        });
        for await (const stream of runner) {
          for await (const _ of stream) {
          }
        }

        // One span for each request: the stream helper records on the span that the request uses.
        const calls = spans('anthropic.messages.create');
        expect(calls).toHaveLength(2);
        for (const call of calls) {
          expect(parentId(call)).toBe(onlySpan('anthropic.messages.tool_runner').spanContext().spanId);
        }
        const outputs = calls.map((span) =>
          JSON.parse(String(span.attributes['gen_ai.output.messages'] ?? null)),
        );
        expect(outputs).toEqual([
          [
            {
              role: 'assistant',
              parts: [{ type: 'tool_call', id: 'toolu_1', name: 'get_weather', arguments: {} }],
            },
          ],
          [{ role: 'assistant', parts: [{ type: 'text', content: 'hello' }] }],
        ]);
      },
    );

    test('with contentMode: content, a streamed API call of the loop that ends before message_stop records what its stream accumulated', async () => {
      const { client } = makeClient([sse(toolUseEvents), sse(STREAM_EVENTS.slice(0, 3))], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      const runner = client.beta.messages.toolRunner({
        ...PARAMS,
        stream: true,
        tools: [weatherTool(async () => 'mild')],
      });
      await expect(async () => {
        for await (const stream of runner) {
          for await (const _ of stream) {
          }
        }
      }).rejects.toThrow();

      const calls = spans('anthropic.messages.create');
      expect(calls.map((span) => span.attributes['error.type'])).toEqual([undefined, 'api_error']);
      expect(JSON.parse(String(calls[1]!.attributes['gen_ai.output.messages'] ?? null))).toEqual([
        { role: 'assistant', parts: [{ type: 'text', content: 'hello' }] },
      ]);
    });

    describe('with runToolsEagerly', () => {
      const secondToolUse = { type: 'tool_use', id: 'toolu_2', name: 'get_weather', input: {} };
      const twoToolUseEvents = [
        { type: 'message_start', message: { ...toolUseMessage, content: [] } },
        { type: 'content_block_start', index: 0, content_block: toolUseMessage.content[0] },
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: secondToolUse },
        { type: 'content_block_stop', index: 1 },
        {
          type: 'message_delta',
          delta: { stop_reason: 'tool_use', stop_sequence: null },
          usage: { output_tokens: 5 },
        },
        { type: 'message_stop' },
      ];

      test('each tool that starts while the reply streams runs in one span, under the tool runner span', async () => {
        const { client, requests } = makeClient([sse(twoToolUseEvents), sse(STREAM_EVENTS)]);
        const currentInTool: Array<string | undefined> = [];
        let startedWhileStreaming: number | undefined;

        const runner = client.beta.messages.toolRunner({
          ...PARAMS,
          stream: true,
          runToolsEagerly: true,
          tools: [
            weatherTool(async () => {
              currentInTool.push(trace.getActiveSpan()?.spanContext().spanId);
              return 'mild';
            }),
          ],
        });
        for await (const stream of runner) {
          await stream.finalMessage();
          startedWhileStreaming ??= currentInTool.length;
        }

        // Both calls had started before the loop collected their results for the second request.
        expect(startedWhileStreaming).toBe(2);
        expect(requests[1]!.body.messages.at(-1).content).toEqual([
          { type: 'tool_result', tool_use_id: 'toolu_1', content: 'mild' },
          { type: 'tool_result', tool_use_id: 'toolu_2', content: 'mild' },
        ]);

        const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
        expect(toolRunnerSpan.status.code).toBe(SpanStatusCode.OK);
        const tools = spans('anthropic.custom_tool_use get_weather');
        expect(tools.map((tool) => tool.attributes['gen_ai.tool.call.id'])).toEqual(['toolu_1', 'toolu_2']);
        expect(currentInTool).toEqual(tools.map((tool) => tool.spanContext().spanId));
        for (const tool of tools) {
          expect(tool.attributes['gen_ai.operation.name']).toBe('execute_tool');
          expect(tool.status.code).toBe(SpanStatusCode.OK);
          expect(parentId(tool)).toBe(toolRunnerSpan.spanContext().spanId);
        }
        const calls = spans('anthropic.messages.create');
        expect(calls).toHaveLength(2);
        for (const call of calls) {
          expect(parentId(call)).toBe(toolRunnerSpan.spanContext().spanId);
          expect(call.attributes).not.toHaveProperty('gen_ai.input.messages');
          expect(call.attributes).not.toHaveProperty('gen_ai.output.messages');
        }
      });

      test('a tool that throws while the reply streams fails its span but not the loop', async () => {
        const { client } = makeClient([sse(toolUseEvents), sse(STREAM_EVENTS)]);

        await client.beta.messages
          .toolRunner({
            ...PARAMS,
            stream: true,
            runToolsEagerly: true,
            tools: [
              weatherTool(async () => {
                throw new Error('no weather today');
              }),
            ],
          })
          .runUntilDone();

        const tool = onlySpan('anthropic.custom_tool_use get_weather');
        expect(tool.status.code).toBe(SpanStatusCode.ERROR);
        expect(tool.attributes['error.type']).toBe('tool_error');
        expect(onlySpan('anthropic.messages.tool_runner').status.code).toBe(SpanStatusCode.OK);
      });

      test("generateToolResponse() starts no second span for a call that has started, and runs a held call under the application's current span", async () => {
        const { client } = makeClient([sse(twoToolUseEvents), sse(STREAM_EVENTS)]);
        let runs = 0;
        const runner = client.beta.messages.toolRunner({
          ...PARAMS,
          stream: true,
          runToolsEagerly: true,
          tools: [
            weatherTool(async () => {
              runs++;
              return 'mild';
            }),
          ],
        });

        for await (const stream of runner) {
          stream.on('contentBlock', (block) => {
            if (block.type === 'tool_use' && block.id === 'toolu_2') runner.deferToolCall(block);
          });
          const message = await stream.finalMessage();
          if (message.stop_reason === 'tool_use') {
            await tracer.startActiveSpan('app.during', async (span) => {
              await runner.generateToolResponse();
              await runner.generateToolResponse();
              span.end();
            });
          }
        }

        expect(runs).toBe(2);
        const [started, held] = spans('anthropic.custom_tool_use get_weather');
        expect(spans('anthropic.custom_tool_use get_weather')).toHaveLength(2);
        expect(started!.attributes['gen_ai.tool.call.id']).toBe('toolu_1');
        expect(parentId(started!)).toBe(onlySpan('anthropic.messages.tool_runner').spanContext().spanId);
        expect(held!.attributes['gen_ai.tool.call.id']).toBe('toolu_2');
        expect(parentId(held!)).toBe(onlySpan('app.during').spanContext().spanId);
      });
    });

    describe('a runnable toolset', () => {
      const memberCall = (id: string, name: string, family = 'browser') => ({
        type: 'tool_use',
        id,
        name,
        toolset_name: family,
        input: { url: 'https://example.com' },
      });
      const twoMemberCalls = {
        ...toolUseMessage,
        content: [memberCall('toolu_1', 'navigate'), memberCall('toolu_2', 'screenshot')],
      };
      const twoMemberCallEvents = [
        { type: 'message_start', message: { ...twoMemberCalls, content: [] } },
        { type: 'content_block_start', index: 0, content_block: twoMemberCalls.content[0] },
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: twoMemberCalls.content[1] },
        { type: 'content_block_stop', index: 1 },
        {
          type: 'message_delta',
          delta: { stop_reason: 'tool_use', stop_sequence: null },
          usage: { output_tokens: 5 },
        },
        { type: 'message_stop' },
      ];

      function browserToolset(run: BetaRunnableToolset['run']): BetaRunnableToolset {
        return { type: 'browser_toolset_20260801', run };
      }

      test('each member call that the loop runs has a tool span named after the member, under the tool runner span', async () => {
        const { client } = makeClient([json(twoMemberCalls), json(MESSAGE)]);
        const currentInMember: Array<string | undefined> = [];

        await client.beta.messages
          .toolRunner(
            {
              ...PARAMS,
              tools: [
                browserToolset(async (_ctx, toolUse) => {
                  currentInMember.push(trace.getActiveSpan()?.spanContext().spanId);
                  return [{ type: 'text', text: `${toolUse.name} done` }];
                }),
              ],
            },
            { openTelemetry: { conversationId: 'conv-3' } },
          )
          .runUntilDone();

        const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
        const members = [
          onlySpan('anthropic.custom_tool_use navigate'),
          onlySpan('anthropic.custom_tool_use screenshot'),
        ];
        expect(currentInMember).toEqual(members.map((member) => member.spanContext().spanId));
        for (const member of members) {
          expect(member.kind).toBe(SpanKind.INTERNAL);
          expect(member.status.code).toBe(SpanStatusCode.OK);
          expect(parentId(member)).toBe(toolRunnerSpan.spanContext().spanId);
        }
        // A toolset's definition has no description, and its member's content is not recorded by default.
        expect(members[0]!.attributes).toEqual({
          'gen_ai.operation.name': 'execute_tool',
          'gen_ai.provider.name': 'anthropic',
          'gen_ai.tool.name': 'navigate',
          'anthropic.toolset.name': 'browser',
          'gen_ai.tool.call.id': 'toolu_1',
          'gen_ai.tool.type': 'function',
          'gen_ai.conversation.id': 'conv-3',
        });
        expect(members[1]!.attributes).toMatchObject({
          'gen_ai.tool.name': 'screenshot',
          'gen_ai.tool.call.id': 'toolu_2',
        });
        expect(spans('anthropic.messages.create')).toHaveLength(2);
      });

      test('a member call that starts while the reply streams runs in one span, under the tool runner span', async () => {
        const { client } = makeClient([sse(twoMemberCallEvents), sse(STREAM_EVENTS)]);
        const started: string[] = [];
        let startedWhileStreaming: number | undefined;

        const runner = client.beta.messages.toolRunner({
          ...PARAMS,
          stream: true,
          runToolsEagerly: true,
          tools: [
            browserToolset(async (_ctx, toolUse) => {
              started.push(toolUse.name);
              return [{ type: 'text', text: 'done' }];
            }),
          ],
        });
        for await (const stream of runner) {
          await stream.finalMessage();
          startedWhileStreaming ??= started.length;
        }

        // A toolset runs its calls one at a time, so at least the first had started before the loop collected the results.
        expect(startedWhileStreaming).toBeGreaterThanOrEqual(1);
        expect(started).toEqual(['navigate', 'screenshot']);
        const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
        expect(toolRunnerSpan.status.code).toBe(SpanStatusCode.OK);
        for (const [name, id] of [
          ['navigate', 'toolu_1'],
          ['screenshot', 'toolu_2'],
        ]) {
          const member = onlySpan(`anthropic.custom_tool_use ${name}`);
          expect(member.attributes['gen_ai.tool.call.id']).toBe(id);
          expect(member.status.code).toBe(SpanStatusCode.OK);
          expect(parentId(member)).toBe(toolRunnerSpan.spanContext().spanId);
        }
      });

      test("a member call the application runs with generateToolResponse() is under the application's current span", async () => {
        const { client } = makeClient([]);
        const runner = client.beta.messages.toolRunner({
          ...PARAMS,
          tools: [browserToolset(async () => [{ type: 'text', text: 'done' }])],
          messages: [
            ...PARAMS.messages,
            { role: 'assistant', content: [memberCall('toolu_1', 'navigate')] as never },
          ],
        });

        await tracer.startActiveSpan('app.idle', async (span) => {
          await runner.generateToolResponse();
          span.end();
        });

        const member = onlySpan('anthropic.custom_tool_use navigate');
        expect(member.attributes['gen_ai.tool.call.id']).toBe('toolu_1');
        expect(parentId(member)).toBe(onlySpan('app.idle').spanContext().spanId);
        expect(spans('anthropic.messages.tool_runner')).toEqual([]);
      });

      test("a member's error result fails its span, and the later calls that are not executed have no span", async () => {
        const { client, requests } = makeClient([json(twoMemberCalls), json(MESSAGE)]);

        await client.beta.messages
          .toolRunner({
            ...PARAMS,
            tools: [
              browserToolset(async () => {
                throw new ToolError('no such page');
              }),
            ],
          })
          .runUntilDone();

        expect(requests[1]!.body.messages.at(-1).content).toEqual([
          expect.objectContaining({ tool_use_id: 'toolu_1', is_error: true }),
          expect.objectContaining({ tool_use_id: 'toolu_2', is_error: true }),
        ]);
        const member = onlySpan('anthropic.custom_tool_use navigate');
        expect(member.status.code).toBe(SpanStatusCode.ERROR);
        expect(member.attributes['error.type']).toBe('tool_error');
        expect(spans('anthropic.custom_tool_use screenshot')).toEqual([]);
        expect(onlySpan('anthropic.messages.tool_runner').status.code).toBe(SpanStatusCode.OK);
      });

      test('a member call of a toolset that the application did not supply has no span', async () => {
        const otherFamily = {
          ...toolUseMessage,
          content: [memberCall('toolu_1', 'navigate'), memberCall('toolu_2', 'left_click', 'computer')],
        };
        const { client, requests } = makeClient([json(otherFamily), json(MESSAGE)]);

        await client.beta.messages
          .toolRunner({
            ...PARAMS,
            tools: [browserToolset(async () => [{ type: 'text', text: 'done' }])],
          })
          .runUntilDone();

        expect(requests[1]!.body.messages.at(-1).content[1]).toMatchObject({
          tool_use_id: 'toolu_2',
          is_error: true,
        });
        expect(onlySpan('anthropic.custom_tool_use navigate').status.code).toBe(SpanStatusCode.OK);
        expect(spans('anthropic.custom_tool_use left_click')).toEqual([]);
      });

      test('with contentMode: content, a member span records its arguments and the result sent back', async () => {
        const { client } = makeClient(
          [json({ ...toolUseMessage, content: [memberCall('toolu_1', 'navigate')] }), json(MESSAGE)],
          {
            openTelemetry: { traces: { contentMode: 'content' } },
          },
        );

        await client.beta.messages
          .toolRunner({
            ...PARAMS,
            tools: [browserToolset(async () => [{ type: 'text', text: 'loaded' }])],
          })
          .runUntilDone();

        const member = onlySpan('anthropic.custom_tool_use navigate');
        expect(member.attributes['gen_ai.tool.call.arguments']).toBe('{"url":"https://example.com"}');
        expect(member.attributes['anthropic.tool_result.content']).toBe('[{"type":"text","text":"loaded"}]');
      });

      test('a member run the application aborts leaves its span unset, and records no result', async () => {
        const controller = new AbortController();
        const { client } = makeClient(
          [json({ ...toolUseMessage, content: [memberCall('toolu_1', 'navigate')] })],
          { openTelemetry: { traces: { contentMode: 'content' } } },
        );

        const done = client.beta.messages
          .toolRunner(
            {
              ...PARAMS,
              tools: [
                browserToolset(async () => {
                  controller.abort();
                  throw new DOMException('aborted', 'AbortError');
                }),
              ],
            },
            { signal: controller.signal },
          )
          .runUntilDone();
        await expect(done).rejects.toBeInstanceOf(Anthropic.APIUserAbortError);

        const member = onlySpan('anthropic.custom_tool_use navigate');
        expect(member.status.code).toBe(SpanStatusCode.UNSET);
        expect(member.attributes['error.type']).toBeUndefined();
        expect(member.attributes).not.toHaveProperty('anthropic.tool_result.content');
      });
    });

    test('a tool span is named after the tool, also when the name is empty', async () => {
      const unnamed = {
        ...toolUseMessage,
        content: [{ type: 'tool_use', id: 'toolu_1', name: '', input: {} }],
      };
      const { client } = makeClient([json(unnamed), json(MESSAGE)]);

      await client.beta.messages
        .toolRunner({ ...PARAMS, tools: [{ ...weatherTool(async () => 'mild'), name: '' }] })
        .runUntilDone();

      // The fixed part, then a space and the value of `gen_ai.tool.name`.
      expect(onlySpan('anthropic.custom_tool_use ').attributes['gen_ai.tool.name']).toBe('');
    });

    test('a tool that throws fails its span but not the loop', async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)]);

      await client.beta.messages
        .toolRunner({
          ...PARAMS,
          tools: [
            weatherTool(async () => {
              throw new Error('no weather today');
            }),
          ],
        })
        .runUntilDone();

      const tool = onlySpan('anthropic.custom_tool_use get_weather');
      expect(tool.status.code).toBe(SpanStatusCode.ERROR);
      expect(tool.attributes['error.type']).toBe('tool_error');
      expect(onlySpan('anthropic.messages.tool_runner').status.code).toBe(SpanStatusCode.OK);
    });

    test('with contentMode: content, a tool span records its arguments and the result sent back', async () => {
      const withInput = {
        ...toolUseMessage,
        content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Rome' } }],
      };
      const { client } = makeClient([json(withInput), json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.beta.messages
        .toolRunner({ ...PARAMS, tools: [weatherTool(async () => 'hot')] })
        .runUntilDone();

      const tool = onlySpan('anthropic.custom_tool_use get_weather');
      expect(tool.attributes['gen_ai.tool.call.arguments']).toBe('{"city":"Rome"}');
      expect(tool.attributes['anthropic.tool_result.content']).toBe('[{"type":"text","text":"hot"}]');
      expect(tool.attributes).not.toHaveProperty('gen_ai.tool.call.result');
    });

    test.each([
      ['an empty list', []],
      ['nothing', undefined],
      ['null', null],
    ])(
      'with contentMode: content, a result that is %s is recorded as an empty list',
      async (_name, returned) => {
        const { client, requests } = makeClient([json(toolUseMessage), json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.beta.messages
          // A tool written in JavaScript can return what the types rule out.
          .toolRunner({ ...PARAMS, tools: [weatherTool(async () => returned as never)] })
          .runUntilDone();

        expect(requests[1]!.body.messages.at(-1).content[0]).toMatchObject({ type: 'tool_result' });
        const tool = onlySpan('anthropic.custom_tool_use get_weather');
        expect(tool.status.code).toBe(SpanStatusCode.OK);
        expect(tool.attributes['anthropic.tool_result.content']).toBe('[]');
        expect(tool.attributes).not.toHaveProperty('anthropic.content.truncated');
        // The next request has the result among its messages, as the same empty list.
        const [, next] = spans('anthropic.messages.create');
        expect(JSON.parse(String(next!.attributes['gen_ai.input.messages'])).at(-1)).toEqual({
          role: 'user',
          parts: [{ type: 'tool_call_response', id: 'toolu_1', response: [] }],
        });
      },
    );

    test('with contentMode: content, a text block and a search result block of the result are whole and any other block is its type only', async () => {
      const text = {
        type: 'text' as const,
        text: 'hot',
        citations: [
          {
            type: 'char_location' as const,
            cited_text: 'hot',
            document_index: 0,
            document_title: null,
            start_char_index: 0,
            end_char_index: 3,
          },
        ],
        cache_control: { type: 'ephemeral' as const },
      };
      const searchResult = {
        type: 'search_result' as const,
        source: 'https://example.com/weather',
        title: 'Weather',
        content: [{ type: 'text' as const, text: 'hot all week' }],
        citations: { enabled: true },
      };
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.beta.messages
        .toolRunner({
          ...PARAMS,
          tools: [
            weatherTool(async () => [
              text,
              searchResult,
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
            ]),
          ],
        })
        .runUntilDone();

      const tool = onlySpan('anthropic.custom_tool_use get_weather');
      expect(JSON.parse(String(tool.attributes['anthropic.tool_result.content']))).toEqual([
        text,
        searchResult,
        { type: 'image' },
      ]);
    });

    test('with contentMode: content, the result leaves out a field whose name starts with encrypted_, and keeps the rest of its citation', async () => {
      const citation = {
        type: 'web_search_result_location' as const,
        cited_text: 'hot',
        title: 'Weather',
        url: 'https://example.com/weather',
      };
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.beta.messages
        .toolRunner({
          ...PARAMS,
          tools: [
            weatherTool(async () => [
              { type: 'text', text: 'hot', citations: [{ ...citation, encrypted_index: 'opaque-2' }] },
            ]),
          ],
        })
        .runUntilDone();

      const tool = onlySpan('anthropic.custom_tool_use get_weather');
      expect(JSON.parse(String(tool.attributes['anthropic.tool_result.content']))).toEqual([
        { type: 'text', text: 'hot', citations: [citation] },
      ]);
    });

    test('with contentMode: content, a tool that throws records the error result', async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.beta.messages
        .toolRunner({
          ...PARAMS,
          tools: [
            weatherTool(async () => {
              throw new Error('no weather today');
            }),
          ],
        })
        .runUntilDone();

      const tool = onlySpan('anthropic.custom_tool_use get_weather');
      expect(tool.status.code).toBe(SpanStatusCode.ERROR);
      expect(JSON.parse(String(tool.attributes['anthropic.tool_result.content']))).toEqual([
        { type: 'text', text: 'Error: no weather today' },
      ]);
      expect(tool.attributes).not.toHaveProperty('gen_ai.tool.call.result');
    });

    describe('the size limit on the content of a tool span', () => {
      const withInput = {
        ...toolUseMessage,
        content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Rome' } }],
      };

      test('removes the last content blocks of a result that is over the limit', async () => {
        const blocks = ['a', 'b', 'c', 'd'].map((letter) => ({
          type: 'text' as const,
          text: letter.repeat(225_000),
        }));
        const { client } = makeClient([json(withInput), json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.beta.messages
          .toolRunner({ ...PARAMS, tools: [weatherTool(async () => blocks)] })
          .runUntilDone();

        const tool = onlySpan('anthropic.custom_tool_use get_weather');
        expect(tool.attributes['gen_ai.tool.call.arguments']).toBe('{"city":"Rome"}');
        expect(tool.attributes['anthropic.tool_result.content']).toBe(JSON.stringify(blocks.slice(0, 3)));
        expect(tool.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('traces.maxContentBytes replaces the limit', async () => {
        const blocks = ['a', 'b', 'c', 'd'].map((letter) => ({
          type: 'text' as const,
          text: letter.repeat(100),
        }));
        // Room for the arguments and for three of the four blocks.
        const maxContentBytes = '{"city":"Rome"}'.length + JSON.stringify(blocks.slice(0, 3)).length;
        const { client } = makeClient([json(withInput), json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content', maxContentBytes } },
        });

        await client.beta.messages
          .toolRunner({ ...PARAMS, tools: [weatherTool(async () => blocks)] })
          .runUntilDone();

        const tool = onlySpan('anthropic.custom_tool_use get_weather');
        expect(tool.attributes['gen_ai.tool.call.arguments']).toBe('{"city":"Rome"}');
        expect(tool.attributes['anthropic.tool_result.content']).toBe(JSON.stringify(blocks.slice(0, 3)));
        expect(tool.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('leaves an empty list of a result that is one string over the limit', async () => {
        const { client } = makeClient([json(withInput), json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.beta.messages
          .toolRunner({ ...PARAMS, tools: [weatherTool(async () => 'h'.repeat(1_100_000))] })
          .runUntilDone();

        const tool = onlySpan('anthropic.custom_tool_use get_weather');
        expect(tool.attributes['gen_ai.tool.call.arguments']).toBe('{"city":"Rome"}');
        expect(tool.attributes['anthropic.tool_result.content']).toBe('[]');
        expect(tool.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('leaves out arguments that are over the limit by themselves, and keeps the result', async () => {
        const input = { city: 'r'.repeat(1_100_000) };
        const hugeInput = {
          ...toolUseMessage,
          content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input }],
        };
        const { client } = makeClient([json(hugeInput), json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.beta.messages
          .toolRunner({ ...PARAMS, tools: [weatherTool(async () => 'hot')] })
          .runUntilDone();

        const tool = onlySpan('anthropic.custom_tool_use get_weather');
        expect(tool.attributes).not.toHaveProperty('gen_ai.tool.call.arguments');
        expect(tool.attributes['anthropic.tool_result.content']).toBe('[{"type":"text","text":"hot"}]');
        expect(tool.attributes['anthropic.content.truncated']).toBe(true);
      });

      test.each([
        ['at traces.maxContentBytes stay, and leave no room for the result', 0, true, '[]'],
        [
          'one character over traces.maxContentBytes are left out, and the result has all of it',
          -1,
          false,
          '[{"type":"text","text":"hot"}]',
        ],
      ])('arguments that are %s', async (_name, room, kept, result) => {
        const input = { city: 'r'.repeat(40) };
        const longInput = {
          ...toolUseMessage,
          content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input }],
        };
        const maxContentBytes = JSON.stringify(input).length + room;
        const { client } = makeClient([json(longInput), json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content', maxContentBytes } },
        });

        await client.beta.messages
          .toolRunner({ ...PARAMS, tools: [weatherTool(async () => 'hot')] })
          .runUntilDone();

        const tool = onlySpan('anthropic.custom_tool_use get_weather');
        expect(tool.attributes['gen_ai.tool.call.arguments']).toBe(kept ? JSON.stringify(input) : undefined);
        expect(tool.attributes['anthropic.tool_result.content']).toBe(result);
        expect(tool.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('leaves a result that is under the limit as it is', async () => {
        const blocks = ['a', 'b', 'c'].map((letter) => ({
          type: 'text' as const,
          text: letter.repeat(225_000),
        }));
        const { client } = makeClient([json(withInput), json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.beta.messages
          .toolRunner({ ...PARAMS, tools: [weatherTool(async () => blocks)] })
          .runUntilDone();

        const tool = onlySpan('anthropic.custom_tool_use get_weather');
        expect(tool.attributes['gen_ai.tool.call.arguments']).toBe('{"city":"Rome"}');
        expect(tool.attributes['anthropic.tool_result.content']).toBe(JSON.stringify(blocks));
        expect(tool.attributes).not.toHaveProperty('anthropic.content.truncated');
      });

      /** In `expected`, `null` is an absent attribute, and arguments that it leaves out are whole. */
      interface ToolSizeLimitCase {
        name: string;
        bound: number;
        input: { tool_call_arguments: unknown; tool_result_content: unknown[] };
        expected: { tool_call_arguments?: unknown; tool_result_content: unknown[] };
        expected_truncated: boolean;
        size_after: number;
      }
      const CASES: ToolSizeLimitCase[] = TOOL_SIZE_LIMIT_CASES;

      test.each(CASES.map((each) => [each.name, each] as const))('%s, with a small limit', (_name, each) => {
        const span = tracer.startSpan('fitted');
        setContentAttributes(
          span,
          {
            'gen_ai.tool.call.arguments': each.input.tool_call_arguments,
            'anthropic.tool_result.content': each.input.tool_result_content,
          },
          each.bound,
        );
        span.end();

        const { attributes } = onlySpan('fitted');
        const toolCallArguments =
          'tool_call_arguments' in each.expected ?
            each.expected.tool_call_arguments
          : each.input.tool_call_arguments;
        expect(attributes['gen_ai.tool.call.arguments']).toBe(
          toolCallArguments === null ? undefined : JSON.stringify(toolCallArguments),
        );
        expect(attributes['anthropic.tool_result.content']).toBe(
          JSON.stringify(each.expected.tool_result_content),
        );
        expect(attributes['anthropic.content.truncated']).toBe(each.expected_truncated ? true : undefined);
        const size = ['gen_ai.tool.call.arguments', 'anthropic.tool_result.content']
          .map((name) => Buffer.byteLength(String(attributes[name] ?? '')))
          .reduce((sum, length) => sum + length, 0);
        expect(size).toBe(each.size_after);
      });

      test('arguments that are over the limit are a removal on a span without a result', () => {
        const span = tracer.startSpan('fitted');
        setContentAttributes(span, { 'gen_ai.tool.call.arguments': { city: 'Rome' } }, 14);
        span.end();

        expect(onlySpan('fitted').attributes).toEqual({ 'anthropic.content.truncated': true });
      });

      test.each([
        ['at the limit in UTF-8 bytes stay, and leave no room for the result', 0, true, '[]'],
        [
          'one byte over the limit in UTF-8 bytes are left out, and the result has all of it',
          -1,
          false,
          '[{"type":"text","text":"hot"}]',
        ],
      ])('arguments with wide characters that are %s', (_name, room, kept, result) => {
        const input = { city: '\u00e9'.repeat(40) };
        const span = tracer.startSpan('fitted');
        setContentAttributes(
          span,
          {
            'gen_ai.tool.call.arguments': input,
            'anthropic.tool_result.content': [{ type: 'text', text: 'hot' }],
          },
          Buffer.byteLength(JSON.stringify(input)) + room,
        );
        span.end();

        const { attributes } = onlySpan('fitted');
        expect(attributes['gen_ai.tool.call.arguments']).toBe(kept ? JSON.stringify(input) : undefined);
        expect(attributes['anthropic.tool_result.content']).toBe(result);
        expect(attributes['anthropic.content.truncated']).toBe(true);
      });

      test.each([
        ['at the limit in UTF-8 bytes stays', 0, 2],
        ['one byte over the limit in UTF-8 bytes is left out', -1, 1],
      ])('a last block with wide characters that is %s', (_name, room, blocks) => {
        const input = { city: '\u00e9' };
        const result = ['\u20ac', '\u{1f600}'].map((wide) => ({ type: 'text', text: wide.repeat(8) }));
        const span = tracer.startSpan('fitted');
        setContentAttributes(
          span,
          { 'gen_ai.tool.call.arguments': input, 'anthropic.tool_result.content': result },
          Buffer.byteLength(JSON.stringify(input)) + Buffer.byteLength(JSON.stringify(result)) + room,
        );
        span.end();

        const { attributes } = onlySpan('fitted');
        expect(attributes['gen_ai.tool.call.arguments']).toBe(JSON.stringify(input));
        expect(attributes['anthropic.tool_result.content']).toBe(JSON.stringify(result.slice(0, blocks)));
        expect(attributes['anthropic.content.truncated']).toBe(room < 0 ? true : undefined);
      });

      test('records nothing of a result that is over the limit with content off', async () => {
        const { client } = makeClient([json(withInput), json(MESSAGE)]);

        await client.beta.messages
          .toolRunner({ ...PARAMS, tools: [weatherTool(async () => 'h'.repeat(1_100_000))] })
          .runUntilDone();

        const tool = onlySpan('anthropic.custom_tool_use get_weather');
        expect(tool.attributes).not.toHaveProperty('gen_ai.tool.call.arguments');
        expect(tool.attributes).not.toHaveProperty('anthropic.tool_result.content');
        expect(tool.attributes).not.toHaveProperty('anthropic.content.truncated');
      });
    });

    test('a failed API call fails the loop with its error type', async () => {
      const { client } = makeClient([json({ type: 'error', error: { type: 'overloaded_error' } }, 529)]);

      await expect(
        client.beta.messages
          .toolRunner({ ...PARAMS, tools: [weatherTool(async () => 'sunny')] })
          .runUntilDone(),
      ).rejects.toBeInstanceOf(Anthropic.APIError);

      const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
      expect(toolRunnerSpan.status.code).toBe(SpanStatusCode.ERROR);
      expect(toolRunnerSpan.attributes['error.type']).toBe('overloaded_error');
    });

    describe.each([
      ['on', undefined],
      ['off', false as const],
    ])('with tracing %s, a streamed request of the loop that cannot be built', (_, openTelemetry) => {
      test.each([false, true])(
        'fails the stream that the loop yields, with runToolsEagerly: %s',
        async (runToolsEagerly) => {
          const { client, requests } = makeClient([], { openTelemetry });

          const runner = client.beta.messages.toolRunner({
            ...PARAMS,
            // No header value, so the request's headers cannot be built.
            betas: ['a\nb'],
            tools: [weatherTool(async () => 'sunny')],
            stream: true,
            runToolsEagerly,
          });
          const iterator = runner[Symbol.asyncIterator]();

          // The loop has a stream to yield, and fails once the application has had it.
          const first = await iterator.next();
          expect(first.done).toBe(false);
          const failure: unknown = await first.value.finalMessage().then(
            () => undefined,
            (error: unknown) => error,
          );
          expect(failure).toBeInstanceOf(Anthropic.AnthropicError);
          expect((failure as Error).cause).toBeInstanceOf(TypeError);
          await expect(iterator.next()).rejects.toBe(failure);

          expect(requests).toHaveLength(0);
          expect(spans('anthropic.messages.create')).toEqual([]);
          if (openTelemetry !== false) {
            expect(onlySpan('anthropic.messages.tool_runner').status.code).toBe(SpanStatusCode.ERROR);
          }
        },
      );
    });

    test('a loop of a client whose spans are disabled does not read the current context', async () => {
      const { client } = makeClient([json(toolUseMessage), json(MESSAGE)], { openTelemetry: false });
      const active = vi.spyOn(context, 'active');

      try {
        const runner = client.beta.messages.toolRunner({
          ...PARAMS,
          tools: [weatherTool(async () => 'sunny')],
        });
        for await (const message of runner) {
          await message;
          await runner.generateToolResponse();
        }

        expect(active).not.toHaveBeenCalled();
      } finally {
        active.mockRestore();
      }
      expect(spans()).toEqual([]);
    });

    test('a loop the application stops leaves the status unset', async () => {
      const { client } = makeClient([json(toolUseMessage)]);

      const runner = client.beta.messages.toolRunner({
        ...PARAMS,
        tools: [weatherTool(async () => 'sunny')],
      });
      for await (const message of runner) {
        await message;
        break;
      }

      const toolRunnerSpan = onlySpan('anthropic.messages.tool_runner');
      expect(toolRunnerSpan.status.code).toBe(SpanStatusCode.UNSET);
      expect(spans().filter((span) => span.name.includes('tool_use'))).toHaveLength(0);
    });

    test('a loop the application aborts leaves the status unset', async () => {
      const controller = new AbortController();
      let sent!: () => void;
      const started = new Promise<void>((resolve) => (sent = resolve));
      const { client } = makeClient([
        (_url, init) => {
          sent();
          return new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          });
        },
      ]);

      const done = client.beta.messages
        .toolRunner({ ...PARAMS, tools: [weatherTool(async () => 'sunny')] }, { signal: controller.signal })
        .runUntilDone();
      await started;
      controller.abort();
      await expect(done).rejects.toBeInstanceOf(Anthropic.APIUserAbortError);

      for (const name of ['anthropic.messages.tool_runner', 'anthropic.messages.create']) {
        const span = onlySpan(name);
        expect(span.status.code).toBe(SpanStatusCode.UNSET);
        expect(span.attributes['error.type']).toBeUndefined();
      }
    });

    test('a tool run the application aborts leaves its span and the tool runner span unset, and records no result', async () => {
      const controller = new AbortController();
      const { client } = makeClient([json(toolUseMessage)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      const done = client.beta.messages
        .toolRunner(
          {
            ...PARAMS,
            tools: [
              weatherTool(async () => {
                controller.abort();
                throw new DOMException('aborted', 'AbortError');
              }),
            ],
          },
          { signal: controller.signal },
        )
        .runUntilDone();
      await expect(done).rejects.toBeInstanceOf(Anthropic.APIUserAbortError);

      for (const name of ['anthropic.custom_tool_use get_weather', 'anthropic.messages.tool_runner']) {
        const span = onlySpan(name);
        expect(span.status.code).toBe(SpanStatusCode.UNSET);
        expect(span.attributes['error.type']).toBeUndefined();
      }
      const tool = onlySpan('anthropic.custom_tool_use get_weather');
      expect(tool.attributes['gen_ai.tool.call.arguments']).toBe('{}');
      expect(tool.attributes).not.toHaveProperty('anthropic.tool_result.content');
      expect(tool.attributes).not.toHaveProperty('gen_ai.tool.call.result');
    });
  });

  test('the Sessions tool runner emits a span for each tool execution', async () => {
    const events = [
      { type: 'agent.custom_tool_use', id: 'sevt_1', name: 'get_weather', input: {} },
      { type: 'agent.custom_tool_use', id: 'sevt_2', name: 'fail', input: {}, session_thread_id: 'sthr_1' },
      {
        type: 'agent.tool_use',
        id: 'sevt_3',
        name: 'read',
        toolset_name: 'files',
        input: {},
        evaluated_permission: 'allow',
      },
      { type: 'agent.custom_tool_use', id: 'sevt_4', name: 'plain', input: {} },
      { type: 'agent.custom_tool_use', id: 'sevt_6', name: 'picture', input: {} },
      { type: 'session.status_terminated', id: 'sevt_5' },
    ];
    const { client } = makeClient([json({}), json({}), json({}), json({}), json({})]);
    const fake = {
      openTelemetry: { traces: { enabled: true, contentMode: 'content', maxContentBytes: 750_000 } },
      _tracer: provider.getTracer('test'),
      beta: {
        sessions: {
          events: {
            list: async function* () {},
            send: client.beta.sessions.events.send.bind(client.beta.sessions.events),
            stream: async () =>
              (async function* () {
                yield* events;
              })(),
          },
        },
      },
    };
    const plainTool = (
      name: string,
      run: () => Promise<NonNullable<Anthropic.Beta.BetaToolResultBlockParam['content']>>,
    ) => ({
      type: 'custom' as const,
      name,
      input_schema: { type: 'object' as const, properties: {} },
      parse: (input: unknown) => input,
      run,
    });
    const tool = (name: string, run: () => Promise<string>) => ({
      ...plainTool(name, run),
      description: `describes ${name}`,
    });

    let toolSpanId: string | undefined;
    const runner = new SessionToolRunner('sesn_1', {
      client: fake as never,
      maxIdleMs: 0,
      requestOptions: { openTelemetry: { conversationId: 'conv-3' } },
      tools: [
        tool('get_weather', async () => {
          toolSpanId = trace.getActiveSpan()?.spanContext().spanId;
          return 'sunny';
        }),
        tool('fail', async () => {
          throw new Error('no');
        }),
        tool('read', async () => 'contents'),
        plainTool('plain', async () => ''),
        plainTool('picture', async () => [
          { type: 'text', text: 'a cat' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
          { type: 'search_result', source: 'https://example.com/cats', title: 'Cats', content: [] },
        ]),
      ],
    });
    for await (const _ of runner) {
    }

    // An application-defined tool runs in an anthropic.custom_tool_use span, an agent-toolset
    // tool in an anthropic.tool_use span.
    const ok = onlySpan('anthropic.custom_tool_use get_weather');
    const failed = onlySpan('anthropic.custom_tool_use fail');
    const agentTool = onlySpan('anthropic.tool_use read');
    expect(agentTool.attributes).toMatchObject({
      'gen_ai.tool.name': 'read',
      'anthropic.toolset.name': 'files',
      'gen_ai.tool.description': 'describes read',
      'gen_ai.tool.call.id': 'sevt_3',
    });
    // Only an event that has a `toolset_name` gives its span one.
    expect(ok.attributes).not.toHaveProperty('anthropic.toolset.name');
    expect(agentTool.status.code).toBe(SpanStatusCode.OK);
    expect(ok.attributes).toMatchObject({
      'gen_ai.tool.name': 'get_weather',
      'gen_ai.tool.description': 'describes get_weather',
      'gen_ai.tool.call.id': 'sevt_1',
    });
    expect(ok.status.code).toBe(SpanStatusCode.OK);
    // A tool whose definition has no description has none on its span.
    expect(onlySpan('anthropic.custom_tool_use plain').attributes).not.toHaveProperty(
      'gen_ai.tool.description',
    );
    // The runner calls the tool, so the tool's span is current while it runs.
    expect(toolSpanId).toBe(ok.spanContext().spanId);
    expect(failed.status.code).toBe(SpanStatusCode.ERROR);
    expect(failed.attributes['error.type']).toBe('tool_error');
    // A tool span has the content of the result event that the runner sends, also of an error
    // result. The event has a placeholder for an empty result.
    expect(ok.attributes['anthropic.tool_result.content']).toBe('[{"type":"text","text":"sunny"}]');
    expect(failed.attributes['anthropic.tool_result.content']).toBe('[{"type":"text","text":"Error: no"}]');
    expect(agentTool.attributes['anthropic.tool_result.content']).toBe('[{"type":"text","text":"contents"}]');
    expect(onlySpan('anthropic.custom_tool_use plain').attributes['anthropic.tool_result.content']).toBe(
      '[{"type":"text","text":"(no output)"}]',
    );
    expect(onlySpan('anthropic.custom_tool_use picture').attributes['anthropic.tool_result.content']).toBe(
      '[{"type":"text","text":"a cat"},{"type":"image"},{"type":"search_result","source":"https://example.com/cats","title":"Cats","content":[],"citations":{"enabled":false}}]',
    );
    for (const span of [ok, failed, agentTool]) {
      expect(span.attributes).not.toHaveProperty('gen_ai.tool.call.result');
    }
    // Every tool span has the Session and the conversation ID that the application set, which
    // wins over the thread ID that only a child thread's call has.
    const sessionID = pathID('beta.sessions.retrieve', 'session_id');
    const threadID = pathID('beta.sessions.threads.retrieve', 'thread_id');
    for (const span of [ok, failed, agentTool]) {
      expect(span.attributes[sessionID]).toBe('sesn_1');
      expect(span.attributes['gen_ai.conversation.id']).toBe('conv-3');
    }
    // So does the span of each request that sends a tool's result.
    expect(spans('anthropic.sessions.events.send')).toHaveLength(5);
    for (const send of spans('anthropic.sessions.events.send')) {
      expect(send.attributes['gen_ai.conversation.id']).toBe('conv-3');
    }
    expect(failed.attributes[threadID]).toBe('sthr_1');
    expect(ok.attributes).not.toHaveProperty(threadID);
    expect(agentTool.attributes).not.toHaveProperty(threadID);
    expect(spans('anthropic.messages.tool_runner')).toHaveLength(0);
  });

  test('the Sessions tool runner of a client whose spans are disabled does not read the current context', async () => {
    const events = [
      { type: 'session.thread_status_running', id: 'sevt_0', session_thread_id: 'sthr_primary' },
      { type: 'agent.custom_tool_use', id: 'sevt_1', name: 'get_weather', input: {} },
      { type: 'session.status_terminated', id: 'sevt_2' },
    ];
    const sent: unknown[] = [];
    const fake = {
      _options: {},
      beta: {
        sessions: {
          events: {
            list: async function* () {},
            send: async (_id: string, body: unknown, options: unknown) => void sent.push([body, options]),
            stream: async () =>
              (async function* () {
                yield* events;
              })(),
          },
        },
      },
    };
    const active = vi.spyOn(context, 'active');

    try {
      const runner = new SessionToolRunner('sesn_1', {
        client: fake as never,
        maxIdleMs: 0,
        tools: [
          {
            type: 'custom' as const,
            name: 'get_weather',
            input_schema: { type: 'object' as const, properties: {} },
            parse: (input: unknown) => input,
            run: async () => 'sunny',
          },
        ],
      });
      for await (const _ of runner) {
      }

      expect(active).not.toHaveBeenCalled();
    } finally {
      active.mockRestore();
    }
    // The result is sent all the same, with no conversation ID worked out for a span.
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject([
      { events: [{ type: 'user.custom_tool_result', custom_tool_use_id: 'sevt_1' }] },
      { openTelemetry: { conversationId: undefined } },
    ]);
  });

  test("without a conversation ID from the application, a Sessions tool span and the span of the request that sends its result have the event's Session thread ID as their conversation ID", async () => {
    const { client, requests } = makeClient([json({}), json({})]);
    const fake = {
      openTelemetry: client.openTelemetry,
      _tracer: provider.getTracer('test'),
      beta: {
        sessions: {
          events: {
            list: async function* () {},
            send: client.beta.sessions.events.send.bind(client.beta.sessions.events),
            stream: async () =>
              (async function* () {
                yield {
                  type: 'agent.custom_tool_use',
                  id: 'sevt_1',
                  name: 'child',
                  input: {},
                  session_thread_id: 'sthr_1',
                };
                yield { type: 'agent.custom_tool_use', id: 'sevt_2', name: 'primary', input: {} };
                yield { type: 'session.status_terminated', id: 'sevt_3' };
              })(),
          },
        },
      },
    };
    const tool = (name: string) => ({
      type: 'custom' as const,
      name,
      input_schema: { type: 'object' as const, properties: {} },
      parse: (input: unknown) => input,
      run: async () => 'done',
    });
    const runner = new SessionToolRunner('sesn_1', {
      client: fake as never,
      maxIdleMs: 0,
      tools: [tool('child'), tool('primary')],
    });
    for await (const _ of runner) {
    }

    const child = onlySpan('anthropic.custom_tool_use child');
    expect(child.attributes['gen_ai.conversation.id']).toBe('sthr_1');
    expect(child.attributes[pathID('beta.sessions.threads.retrieve', 'thread_id')]).toBe('sthr_1');
    // The event of a call of the primary thread has no thread ID, and the runner has read no status
    // event of the primary thread, which has it. The Session ID is no substitute.
    expect(onlySpan('anthropic.custom_tool_use primary').attributes).not.toHaveProperty(
      'gen_ai.conversation.id',
    );
    // The span of the request that sends a tool's result has what the tool's span has.
    const sends = spans('anthropic.sessions.events.send');
    expect(requests.map((request) => request.body.events[0].custom_tool_use_id)).toEqual([
      'sevt_1',
      'sevt_2',
    ]);
    expect(sends.map((send) => send.attributes['gen_ai.conversation.id'])).toEqual(['sthr_1', undefined]);
  });

  describe("the Sessions tool runner's conversation ID for a tool call of the primary thread", () => {
    const at = '2026-01-01T00:00:00.000000Z';
    const THREAD_ID = pathID('beta.sessions.threads.retrieve', 'thread_id');
    const RUNNING = { type: 'session.status_running', id: 'sevt_running', processed_at: at };
    const USER_MESSAGE = {
      type: 'user.message',
      id: 'sevt_message',
      content: [{ type: 'text', text: 'hi' }],
      processed_at: at,
    };
    const TERMINATED = { type: 'session.status_terminated', id: 'sevt_terminated', processed_at: at };
    const threadStatus = (
      status: 'running' | 'idle',
      thread: string,
      more: Record<string, unknown> = {},
    ) => ({
      type: `session.thread_status_${status}`,
      id: `sevt_${status}_${thread}`,
      agent_name: thread === 'sthr_primary' ? 'coordinator' : 'researcher',
      processed_at: at,
      session_thread_id: thread,
      ...more,
    });
    const THREAD_CREATED = {
      type: 'session.thread_created',
      id: 'sevt_created',
      agent_name: 'researcher',
      processed_at: at,
      session_thread_id: 'sthr_child',
    };
    // Only the event of a child thread's call has a thread ID.
    const toolUse = (id: string, name: string, thread?: string) => ({
      type: 'agent.custom_tool_use',
      id,
      name,
      input: {},
      processed_at: at,
      ...(thread ? { session_thread_id: thread } : undefined),
    });
    const requiresAction = (...ids: string[]) => ({ type: 'requires_action', event_ids: ids });
    const history = (events: Array<Record<string, unknown>>) => json({ data: events, next_page: null });
    const tool = (name: string) => ({
      type: 'custom' as const,
      name,
      input_schema: { type: 'object' as const, properties: {} },
      parse: (input: unknown) => input,
      run: async () => 'done',
    });
    const EVENTS_URL = 'http://localhost:4010/v1/sessions/sesn_1/events';
    const result = (id: string) => ({
      events: [
        {
          type: 'user.custom_tool_result',
          custom_tool_use_id: id,
          is_error: false,
          content: [{ type: 'text', text: 'done' }],
        },
      ],
    });
    const conversationIDs = (name: string) =>
      spans(name).map((span) => span.attributes['gen_ai.conversation.id']);

    // The primary thread's own status event, which has its ID, is in the Session's events before the
    // primary thread's first tool call: in the history, or on the stream of a Session that just began.
    const beforeTheCall = [RUNNING, threadStatus('running', 'sthr_primary'), USER_MESSAGE];
    const theCall = [
      toolUse('sevt_1', 'primary'),
      threadStatus('idle', 'sthr_primary', { stop_reason: requiresAction('sevt_1') }),
      {
        type: 'session.status_idle',
        id: 'sevt_idle',
        processed_at: at,
        stop_reason: requiresAction('sevt_1'),
      },
    ];
    test.each([
      [
        'the history has the status event of the primary thread',
        {
          stream: [TERMINATED],
          listed: [...beforeTheCall, ...theCall],
          application: undefined,
          expected: 'sthr_primary',
        },
      ],
      [
        'the stream of a Session that just began has the status event of the primary thread',
        {
          stream: [...beforeTheCall, ...theCall, TERMINATED],
          listed: [],
          application: undefined,
          expected: 'sthr_primary',
        },
      ],
      [
        "the application's conversation ID wins over the primary thread's ID",
        {
          stream: [TERMINATED],
          listed: [...beforeTheCall, ...theCall],
          application: 'conv-app',
          expected: 'conv-app',
        },
      ],
    ])('%s', async (_name, { stream, listed, application, expected }) => {
      const { client, requests } = makeClient([sse(stream), history(listed), json({})]);

      const runner = client.beta.sessions.events.toolRunner('sesn_1', {
        maxIdleMs: 0,
        tools: [tool('primary')],
        ...(application ? { requestOptions: { openTelemetry: { conversationId: application } } } : undefined),
      });
      for await (const _ of runner) {
      }

      const span = onlySpan('anthropic.custom_tool_use primary');
      expect(span.attributes['gen_ai.conversation.id']).toBe(expected);
      // The event of a call of the primary thread has no thread ID, so neither has the span.
      expect(span.attributes).not.toHaveProperty(THREAD_ID);
      expect(conversationIDs('anthropic.sessions.events.send')).toEqual([expected]);
      // The runner learns the ID from the events that it reads anyway: it opens the stream, reads the
      // history and sends the result, and makes no other request.
      expect(requests.map((request) => [request.url, request.body])).toEqual([
        [`${EVENTS_URL}/stream?beta=true`, undefined],
        [`${EVENTS_URL}?beta=true&limit=1000`, undefined],
        [`${EVENTS_URL}?beta=true`, result('sevt_1')],
      ]);
    });

    test("a child thread's events do not replace the primary thread's ID, and a child thread's call keeps its own", async () => {
      const { client } = makeClient([
        sse([
          threadStatus('idle', 'sthr_child', { stop_reason: { type: 'end_turn' } }),
          toolUse('sevt_3', 'later'),
          TERMINATED,
        ]),
        history([
          ...beforeTheCall,
          THREAD_CREATED,
          threadStatus('running', 'sthr_child'),
          toolUse('sevt_1', 'child', 'sthr_child'),
          toolUse('sevt_2', 'primary'),
        ]),
        json({}),
        json({}),
        json({}),
      ]);

      const runner = client.beta.sessions.events.toolRunner('sesn_1', {
        maxIdleMs: 0,
        tools: [tool('child'), tool('primary'), tool('later')],
      });
      for await (const _ of runner) {
      }

      const child = onlySpan('anthropic.custom_tool_use child');
      expect(child.attributes['gen_ai.conversation.id']).toBe('sthr_child');
      expect(child.attributes[THREAD_ID]).toBe('sthr_child');
      for (const name of ['primary', 'later']) {
        const span = onlySpan(`anthropic.custom_tool_use ${name}`);
        expect(span.attributes['gen_ai.conversation.id']).toBe('sthr_primary');
        expect(span.attributes).not.toHaveProperty(THREAD_ID);
      }
      expect(conversationIDs('anthropic.sessions.events.send')).toEqual([
        'sthr_child',
        'sthr_primary',
        'sthr_primary',
      ]);
    });

    test('a runner that could not read the history does not take the primary thread from the stream', async () => {
      const { client, requests } = makeClient(
        [
          // The runner joins a Session whose primary thread is running already, so the first status
          // event of the stream is a child thread's. The stream then drops.
          sse([threadStatus('running', 'sthr_child'), toolUse('sevt_1', 'primary')]),
          json({ type: 'error', error: { type: 'api_error', message: 'no' } }, 500),
          json({}),
          // The runner opens the stream again, and now reads the history.
          sse([toolUse('sevt_2', 'later'), TERMINATED]),
          history([
            ...beforeTheCall,
            THREAD_CREATED,
            threadStatus('running', 'sthr_child'),
            toolUse('sevt_1', 'primary'),
            {
              type: 'user.custom_tool_result',
              id: 'sevt_result',
              custom_tool_use_id: 'sevt_1',
              processed_at: at,
            },
          ]),
          json({}),
        ],
        { logLevel: 'off' },
      );

      const runner = client.beta.sessions.events.toolRunner('sesn_1', {
        maxIdleMs: 0,
        tools: [tool('primary'), tool('later')],
      });
      for await (const _ of runner) {
      }

      expect(conversationIDs('anthropic.custom_tool_use primary')).toEqual([undefined]);
      expect(conversationIDs('anthropic.custom_tool_use later')).toEqual(['sthr_primary']);
      expect(conversationIDs('anthropic.sessions.events.send')).toEqual([undefined, 'sthr_primary']);
      expect(requests.map((request) => request.body)).toEqual([
        undefined,
        undefined,
        result('sevt_1'),
        undefined,
        undefined,
        result('sevt_2'),
      ]);
    });
  });

  test('with contentMode: content, a block that the Sessions tool runner sends as its JSON is its type only', async () => {
    const browserState = {
      type: 'browser_state',
      screenshot: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' },
      encrypted_content: 'encrypted_0',
    };
    const toolReference = { type: 'tool_reference', tool_name: 'get_weather' };
    const { client, requests } = makeClient([json({})]);
    const fake = {
      openTelemetry: { traces: { enabled: true, contentMode: 'content', maxContentBytes: 750_000 } },
      _tracer: provider.getTracer('test'),
      beta: {
        sessions: {
          events: {
            list: async function* () {},
            send: client.beta.sessions.events.send.bind(client.beta.sessions.events),
            stream: async () =>
              (async function* () {
                yield { type: 'agent.custom_tool_use', id: 'sevt_1', name: 'browse', input: {} };
                yield { type: 'session.status_terminated', id: 'sevt_2' };
              })(),
          },
        },
      },
    };
    const runner = new SessionToolRunner('sesn_1', {
      client: fake as never,
      maxIdleMs: 0,
      tools: [
        {
          type: 'custom' as const,
          name: 'browse',
          input_schema: { type: 'object' as const, properties: {} },
          parse: (input: unknown) => input,
          run: async () => [{ type: 'text', text: 'Opened the page.' }, browserState, toolReference] as never,
        },
      ],
    });
    const calls = [];
    for await (const call of runner) {
      calls.push(call);
    }

    // The result event cannot hold these blocks, so it has each as the text of its JSON.
    const result = {
      type: 'user.custom_tool_result',
      custom_tool_use_id: 'sevt_1',
      is_error: false,
      content: [
        { type: 'text', text: 'Opened the page.' },
        { type: 'text', text: JSON.stringify(browserState) },
        { type: 'text', text: JSON.stringify(toolReference) },
      ],
    };
    expect(requests.map((request) => request.body.events)).toEqual([[result]]);
    expect(calls.map((call) => call.result)).toEqual([result]);
    // A span keeps a text block whole, so it has these blocks by their own types, not as their JSON.
    expect(onlySpan('anthropic.custom_tool_use browse').attributes['anthropic.tool_result.content']).toBe(
      '[{"type":"text","text":"Opened the page."},{"type":"browser_state"},{"type":"tool_reference"}]',
    );
  });

  test('tool content that JSON cannot hold is not recorded and does not fail the run', async () => {
    const debug = vi.fn();
    const fake = {
      openTelemetry: { traces: { enabled: true, contentMode: 'content', maxContentBytes: 750_000 } },
      _tracer: provider.getTracer('test'),
      logger: { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      logLevel: 'debug',
      beta: {
        sessions: {
          events: {
            list: async function* () {},
            send: async () => ({}),
            stream: async () =>
              (async function* () {
                yield { type: 'agent.custom_tool_use', id: 'sevt_1', name: 'count', input: {} };
                yield { type: 'session.status_terminated', id: 'sevt_2' };
              })(),
          },
        },
      },
    };
    const runner = new SessionToolRunner('sesn_1', {
      client: fake as never,
      maxIdleMs: 0,
      tools: [
        {
          type: 'custom' as const,
          name: 'count',
          description: 'count',
          input_schema: { type: 'object' as const, properties: {} },
          parse: (input: unknown) => input,
          // A BigInt has no JSON form.
          run: async () => [{ type: 'text', text: 10n }] as never,
        },
      ],
    });
    const calls = [];
    for await (const call of runner) {
      calls.push(call);
    }

    expect(calls.map((call) => call.isError)).toEqual([false]);
    const span = onlySpan('anthropic.custom_tool_use count');
    expect(span.status.code).toBe(SpanStatusCode.OK);
    expect(span.attributes).not.toHaveProperty('anthropic.tool_result.content');
    expect(span.attributes).not.toHaveProperty('gen_ai.conversation.id');
    expect(debug).toHaveBeenCalledWith('could not record the tool run on its span', expect.any(TypeError));
  });
});
