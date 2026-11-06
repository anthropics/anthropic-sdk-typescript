import { SpanStatusCode } from '@opentelemetry/api';
import { type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type Anthropic from '@anthropic-ai/sdk';
import { setContentAttributes } from '@anthropic-ai/sdk/lib/internal/tracing/content';
import SIZE_LIMIT_CASES from './size-limit-cases.json';
import {
  exporter,
  tracer,
  makeClient,
  json,
  sse,
  MESSAGE,
  PARAMS,
  STREAM_EVENTS,
  spans,
  onlySpan,
  type Handler,
  setUpTracing,
} from './utils';

setUpTracing();

describe('OpenTelemetry spans', () => {
  describe('content', () => {
    afterEach(() => {
      delete process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'];
      delete process.env['ANTHROPIC_OPEN_TELEMETRY_CONTENT_MODE'];
    });

    const CONTENT_PARAMS = {
      ...PARAMS,
      system: 'be brief',
      messages: [
        { role: 'user' as const, content: 'hi' },
        {
          role: 'assistant' as const,
          content: [
            { type: 'thinking' as const, thinking: 'secret', signature: 'sig' },
            { type: 'tool_use' as const, id: 'toolu_1', name: 'get_weather', input: { city: 'Paris' } },
          ],
        },
        {
          role: 'user' as const,
          content: [
            { type: 'tool_result' as const, tool_use_id: 'toolu_1', content: 'sunny' },
            { type: 'image' as const, source: { type: 'url' as const, url: 'https://example.com/a.png' } },
          ],
        },
      ],
    };

    const attribute = (span: ReadableSpan, name: string) => {
      const value = span.attributes[name];
      return typeof value === 'string' ? JSON.parse(value) : value;
    };

    /** The UTF-8 bytes in the content attributes of `span` that can be reduced. */
    const contentSize = (span: ReadableSpan) =>
      ['gen_ai.system_instructions', 'gen_ai.input.messages', 'gen_ai.output.messages']
        .map((name) => Buffer.byteLength(String(span.attributes[name] ?? '')))
        .reduce((sum, each) => sum + each, 0);

    test('a client that leaves contentMode unset records no content', async () => {
      const { client } = makeClient([json(MESSAGE)]);

      await client.messages.create(CONTENT_PARAMS);

      const span = onlySpan('anthropic.messages.create');
      expect(span.attributes['gen_ai.input.messages']).toBeUndefined();
      expect(span.attributes['gen_ai.system_instructions']).toBeUndefined();
      expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
      expect(span.attributes['anthropic.content.truncated']).toBeUndefined();
    });

    test('contentMode: content records the request and the response as JSON strings', async () => {
      const { client } = makeClient([json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.messages.create(CONTENT_PARAMS);

      const span = onlySpan('anthropic.messages.create');
      expect(typeof span.attributes['gen_ai.input.messages']).toBe('string');
      expect(attribute(span, 'gen_ai.system_instructions')).toEqual([{ type: 'text', content: 'be brief' }]);
      expect(attribute(span, 'gen_ai.input.messages')).toEqual([
        { role: 'user', parts: [{ type: 'text', content: 'hi' }] },
        {
          role: 'assistant',
          parts: [
            { type: 'reasoning', content: 'secret' },
            { type: 'tool_call', id: 'toolu_1', name: 'get_weather', arguments: { city: 'Paris' } },
          ],
        },
        {
          role: 'user',
          parts: [
            { type: 'tool_call_response', id: 'toolu_1', response: [{ type: 'text', text: 'sunny' }] },
            { type: 'anthropic_image' },
          ],
        },
      ]);
      expect(attribute(span, 'gen_ai.output.messages')).toEqual([
        { role: 'assistant', parts: [{ type: 'text', content: 'hello' }] },
      ]);
      // A thinking block of an earlier turn is a reasoning part, without its signature.
      expect(span.attributes['gen_ai.input.messages']).not.toContain('sig');
    });

    test('a thinking block of the response is a reasoning part without its signature, and redacted thinking is its type only', async () => {
      const thought = {
        ...MESSAGE,
        content: [
          { type: 'thinking', thinking: 'because', signature: 'sig-1' },
          { type: 'thinking', thinking: '', signature: 'sig-2' },
          { type: 'redacted_thinking', data: 'opaque' },
          { type: 'text', text: 'hello' },
        ],
      };
      const { client } = makeClient([json(thought)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.messages.create(PARAMS);

      const span = onlySpan('anthropic.messages.create');
      expect(attribute(span, 'gen_ai.output.messages')).toEqual([
        {
          role: 'assistant',
          parts: [
            { type: 'reasoning', content: 'because' },
            // A hidden thinking block has no text, and keeps its part.
            { type: 'reasoning', content: '' },
            { type: 'anthropic_redacted_thinking' },
            { type: 'text', content: 'hello' },
          ],
        },
      ]);
      expect(span.attributes['gen_ai.output.messages']).not.toContain('sig-');
      expect(span.attributes['gen_ai.output.messages']).not.toContain('opaque');
    });

    test('the stream helper records the thinking it accumulated as a reasoning part', async () => {
      const events = [
        STREAM_EVENTS[0]!,
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'thinking', thinking: '', signature: '' },
        },
        { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'be' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'cause' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig-3' } },
        { type: 'content_block_stop', index: 0 },
        {
          type: 'content_block_start',
          index: 1,
          content_block: { type: 'redacted_thinking', data: 'opaque' },
        },
        { type: 'content_block_stop', index: 1 },
        ...STREAM_EVENTS.slice(4),
      ];
      const { client } = makeClient([sse(events)], { openTelemetry: { traces: { contentMode: 'content' } } });

      const message = await client.messages.stream(PARAMS).finalMessage();

      expect(message.content).toEqual([
        { type: 'thinking', thinking: 'because', signature: 'sig-3' },
        { type: 'redacted_thinking', data: 'opaque' },
      ]);
      const span = onlySpan('anthropic.messages.create');
      expect(attribute(span, 'gen_ai.output.messages')).toEqual([
        {
          role: 'assistant',
          parts: [{ type: 'reasoning', content: 'because' }, { type: 'anthropic_redacted_thinking' }],
        },
      ]);
      expect(span.attributes['gen_ai.output.messages']).not.toContain('sig-3');
      expect(span.attributes['gen_ai.output.messages']).not.toContain('opaque');
    });

    test('a tool result records its content blocks, and a block of another kind only its type after anthropic_', async () => {
      const text = {
        type: 'text' as const,
        text: 'sunny',
        citations: [
          {
            type: 'char_location' as const,
            cited_text: 'sun',
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
        content: [{ type: 'text' as const, text: 'sunny all week' }],
        citations: { enabled: true },
      };
      const image = {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: 'image/png' as const, data: 'aGVsbG8=' },
      };
      const { client } = makeClient([json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.messages.create({
        ...PARAMS,
        messages: [
          { role: 'user', content: 'hi' },
          {
            role: 'assistant',
            content: [
              { type: 'redacted_thinking', data: 'opaque' },
              { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: {} },
              { type: 'tool_use', id: 'toolu_2', name: 'get_weather', input: {} },
            ],
          },
          {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'toolu_1', content: [text, searchResult, image] },
              { type: 'tool_result', tool_use_id: 'toolu_2' },
              image,
              { type: 'document', source: { type: 'text', media_type: 'text/plain', data: 'a secret' } },
            ],
          },
        ],
      });

      const span = onlySpan('anthropic.messages.create');
      expect(attribute(span, 'gen_ai.input.messages').slice(1)).toEqual([
        {
          role: 'assistant',
          parts: [
            { type: 'anthropic_redacted_thinking' },
            { type: 'tool_call', id: 'toolu_1', name: 'get_weather', arguments: {} },
            { type: 'tool_call', id: 'toolu_2', name: 'get_weather', arguments: {} },
          ],
        },
        {
          role: 'user',
          parts: [
            // A text block and a search result block have all their fields. Any other block of a
            // tool result has only its type, without the prefix.
            { type: 'tool_call_response', id: 'toolu_1', response: [text, searchResult, { type: 'image' }] },
            // A tool result without content has an empty response.
            { type: 'tool_call_response', id: 'toolu_2', response: [] },
            { type: 'anthropic_image' },
            { type: 'anthropic_document' },
          ],
        },
      ]);
      for (const secret of ['opaque', 'aGVsbG8=', 'a secret']) {
        expect(span.attributes['gen_ai.input.messages']).not.toContain(secret);
      }
    });

    describe('a tool use with a toolset name', () => {
      // Only the first has one: `null` and no key both mean that the tool is in no toolset.
      const TOOL_USES = [
        { type: 'tool_use' as const, id: 'toolu_1', name: 'screenshot', input: {}, toolset_name: 'computer' },
        {
          type: 'tool_use' as const,
          id: 'toolu_2',
          name: 'get_weather',
          input: { city: 'Paris' },
          toolset_name: null,
        },
        { type: 'tool_use' as const, id: 'toolu_3', name: 'get_weather', input: { city: 'Rome' } },
      ];
      const TOOL_CALLS = [
        {
          type: 'tool_call',
          id: 'toolu_1',
          name: 'screenshot',
          arguments: {},
          anthropic_toolset_name: 'computer',
        },
        { type: 'tool_call', id: 'toolu_2', name: 'get_weather', arguments: { city: 'Paris' } },
        { type: 'tool_call', id: 'toolu_3', name: 'get_weather', arguments: { city: 'Rome' } },
      ];
      const TOOL_PARAMS = {
        ...PARAMS,
        messages: [
          { role: 'user' as const, content: 'hi' },
          { role: 'assistant' as const, content: TOOL_USES },
          { role: 'user' as const, content: 'again' },
        ],
      };
      const ANSWER = json({ ...MESSAGE, content: TOOL_USES });
      const STREAMED_ANSWER = sse([
        STREAM_EVENTS[0]!,
        ...TOOL_USES.flatMap(({ input, toolset_name, ...block }, index) => [
          {
            type: 'content_block_start',
            index,
            // A streamed block leaves out the key that has no value.
            content_block: { ...block, input: {}, ...(toolset_name ? { toolset_name } : undefined) },
          },
          {
            type: 'content_block_delta',
            index,
            delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) },
          },
          { type: 'content_block_stop', index },
        ]),
        ...STREAM_EVENTS.slice(4),
      ]);

      test.each([
        ['a call', ANSWER, (client: Anthropic) => client.messages.create(TOOL_PARAMS)],
        ['a beta call', ANSWER, (client: Anthropic) => client.beta.messages.create(TOOL_PARAMS)],
        [
          'the stream helper',
          STREAMED_ANSWER,
          (client: Anthropic) => client.messages.stream(TOOL_PARAMS).finalMessage(),
        ],
        [
          'the beta stream helper',
          STREAMED_ANSWER,
          (client: Anthropic) => client.beta.messages.stream(TOOL_PARAMS).finalMessage(),
        ],
      ])(
        '%s records it on the tool call, in the request and in the response',
        async (_name, answer, call) => {
          const { client } = makeClient([answer], {
            openTelemetry: { traces: { contentMode: 'content' } },
          });

          await call(client);

          const span = onlySpan('anthropic.messages.create');
          expect(attribute(span, 'gen_ai.input.messages')[1]).toEqual({
            role: 'assistant',
            parts: TOOL_CALLS,
          });
          expect(attribute(span, 'gen_ai.output.messages')).toEqual([
            { role: 'assistant', parts: TOOL_CALLS },
          ]);
        },
      );
    });

    describe('tool uses and results of server tools and MCP tools', () => {
      const SEARCH_USE = {
        type: 'server_tool_use' as const,
        id: 'srvtoolu_1',
        name: 'web_search' as const,
        input: { query: 'weather' },
        // Only a `tool_use` block's toolset name is recorded.
        toolset_name: 'computer',
      };
      const SEARCH_RESULT = {
        type: 'web_search_tool_result' as const,
        tool_use_id: 'srvtoolu_1',
        content: [
          {
            type: 'web_search_result' as const,
            title: 'Weather',
            url: 'https://example.com/weather',
            encrypted_content: 'opaque-1',
            page_age: null,
          },
        ],
      };
      const MCP_USE = {
        type: 'mcp_tool_use' as const,
        id: 'mcptoolu_1',
        name: 'lookup',
        server_name: 'docs',
        input: { q: 'rain' },
        toolset_name: 'computer',
      };
      const MCP_RESULT = {
        type: 'mcp_tool_result' as const,
        tool_use_id: 'mcptoolu_1',
        is_error: false,
        content: [{ type: 'text' as const, text: 'found it' }],
      };
      const PARTS = [
        { type: 'tool_call', id: 'srvtoolu_1', name: 'web_search', arguments: { query: 'weather' } },
        {
          type: 'tool_call_response',
          id: 'srvtoolu_1',
          // A web search result is as the API returns it, without its encrypted content.
          response: [
            {
              type: 'web_search_result',
              title: 'Weather',
              url: 'https://example.com/weather',
              page_age: null,
            },
          ],
        },
        {
          type: 'tool_call',
          id: 'mcptoolu_1',
          name: 'lookup',
          arguments: { q: 'rain' },
          anthropic_mcp_server_name: 'docs',
        },
        { type: 'tool_call_response', id: 'mcptoolu_1', response: [{ type: 'text', text: 'found it' }] },
      ];

      test('a response records them as tool calls and tool call responses', async () => {
        const answer = { ...MESSAGE, content: [SEARCH_USE, SEARCH_RESULT, MCP_USE, MCP_RESULT] };
        const { client } = makeClient([json(answer)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.beta.messages.create(PARAMS);

        const span = onlySpan('anthropic.messages.create');
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([{ role: 'assistant', parts: PARTS }]);
        expect(span.attributes['gen_ai.output.messages']).not.toContain('opaque-1');
      });

      test('the stream helper records them from the message it accumulated', async () => {
        const events = [
          STREAM_EVENTS[0]!,
          { type: 'content_block_start', index: 0, content_block: { ...SEARCH_USE, input: {} } },
          {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'input_json_delta', partial_json: '{"query":"weather"}' },
          },
          { type: 'content_block_stop', index: 0 },
          { type: 'content_block_start', index: 1, content_block: SEARCH_RESULT },
          { type: 'content_block_stop', index: 1 },
          { type: 'content_block_start', index: 2, content_block: { ...MCP_USE, input: {} } },
          {
            type: 'content_block_delta',
            index: 2,
            delta: { type: 'input_json_delta', partial_json: '{"q":"rain"}' },
          },
          { type: 'content_block_stop', index: 2 },
          { type: 'content_block_start', index: 3, content_block: MCP_RESULT },
          { type: 'content_block_stop', index: 3 },
          ...STREAM_EVENTS.slice(4),
        ];
        const { client } = makeClient([sse(events)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.beta.messages.stream(PARAMS).finalMessage();

        const span = onlySpan('anthropic.messages.create');
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([{ role: 'assistant', parts: PARTS }]);
      });

      test('a request records those of earlier turns, and leaves out encrypted fields and image and document data', async () => {
        const { client } = makeClient([json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });
        const use = (
          id: string,
          name: 'web_search' | 'web_fetch' | 'code_execution' | 'text_editor_code_execution',
        ) => ({ type: 'server_tool_use', id, name, input: {} }) as const;

        await client.beta.messages.create({
          ...PARAMS,
          messages: [
            { role: 'user', content: 'hi' },
            {
              role: 'assistant',
              content: [
                SEARCH_USE,
                SEARCH_RESULT,
                use('srvtoolu_2', 'web_search'),
                {
                  type: 'web_search_tool_result',
                  tool_use_id: 'srvtoolu_2',
                  content: { type: 'web_search_tool_result_error', error_code: 'unavailable' },
                },
                use('srvtoolu_3', 'code_execution'),
                {
                  type: 'code_execution_tool_result',
                  tool_use_id: 'srvtoolu_3',
                  content: {
                    type: 'code_execution_result',
                    stdout: '1',
                    stderr: '',
                    return_code: 0,
                    content: [{ type: 'code_execution_output', file_id: 'file_1' }],
                  },
                },
                use('srvtoolu_4', 'text_editor_code_execution'),
                {
                  type: 'text_editor_code_execution_tool_result',
                  tool_use_id: 'srvtoolu_4',
                  content: {
                    type: 'text_editor_code_execution_view_result',
                    file_type: 'image',
                    content: 'aW1hZ2U=',
                  },
                },
                use('srvtoolu_5', 'web_fetch'),
                {
                  type: 'web_fetch_tool_result',
                  tool_use_id: 'srvtoolu_5',
                  content: {
                    type: 'web_fetch_result',
                    url: 'https://example.com/page',
                    content: {
                      type: 'document',
                      source: { type: 'text', media_type: 'text/plain', data: 'the page' },
                    },
                  },
                },
                MCP_USE,
                MCP_RESULT,
                { ...MCP_USE, id: 'mcptoolu_2' },
                { type: 'mcp_tool_result', tool_use_id: 'mcptoolu_2', content: 'found' },
                { ...MCP_USE, id: 'mcptoolu_3' },
                { type: 'mcp_tool_result', tool_use_id: 'mcptoolu_3' },
              ],
            },
            { role: 'user', content: 'thanks' },
          ],
        });

        const span = onlySpan('anthropic.messages.create');
        const call = (id: string, name: string) => ({ type: 'tool_call', id, name, arguments: {} });
        expect(attribute(span, 'gen_ai.input.messages')[1]).toEqual({
          role: 'assistant',
          parts: [
            PARTS[0],
            PARTS[1],
            call('srvtoolu_2', 'web_search'),
            // Content that is one object, such as an error, is a list of that object as the API returns it.
            {
              type: 'tool_call_response',
              id: 'srvtoolu_2',
              response: [{ type: 'web_search_tool_result_error', error_code: 'unavailable' }],
            },
            call('srvtoolu_3', 'code_execution'),
            {
              type: 'tool_call_response',
              id: 'srvtoolu_3',
              response: [
                {
                  type: 'code_execution_result',
                  stdout: '1',
                  stderr: '',
                  return_code: 0,
                  content: [{ type: 'code_execution_output', file_id: 'file_1' }],
                },
              ],
            },
            call('srvtoolu_4', 'text_editor_code_execution'),
            // The view of an image has no content.
            {
              type: 'tool_call_response',
              id: 'srvtoolu_4',
              response: [{ type: 'text_editor_code_execution_view_result', file_type: 'image' }],
            },
            call('srvtoolu_5', 'web_fetch'),
            // A document block inside the object has only its type.
            {
              type: 'tool_call_response',
              id: 'srvtoolu_5',
              response: [
                {
                  type: 'web_fetch_result',
                  url: 'https://example.com/page',
                  content: { type: 'document' },
                },
              ],
            },
            PARTS[2],
            PARTS[3],
            { ...PARTS[2], id: 'mcptoolu_2' },
            // Content that is a string is one text block, and no content is an empty list.
            { type: 'tool_call_response', id: 'mcptoolu_2', response: [{ type: 'text', text: 'found' }] },
            { ...PARTS[2], id: 'mcptoolu_3' },
            { type: 'tool_call_response', id: 'mcptoolu_3', response: [] },
          ],
        });
        for (const secret of ['opaque-1', 'aW1hZ2U=', 'the page']) {
          expect(span.attributes['gen_ai.input.messages']).not.toContain(secret);
        }
      });

      test('a tool result leaves out a field whose name starts with encrypted_, and keeps the rest of its citation', async () => {
        const { client } = makeClient([json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });
        const citation = {
          type: 'web_search_result_location' as const,
          cited_text: 'sunny',
          title: 'Weather',
          url: 'https://example.com/weather',
        };

        await client.messages.create({
          ...PARAMS,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'toolu_1',
                  content: [
                    {
                      type: 'text',
                      text: 'sunny',
                      citations: [{ ...citation, encrypted_index: 'opaque-2' }],
                    },
                  ],
                },
              ],
            },
          ],
        });

        const span = onlySpan('anthropic.messages.create');
        expect(attribute(span, 'gen_ai.input.messages')[0].parts).toEqual([
          {
            type: 'tool_call_response',
            id: 'toolu_1',
            response: [{ type: 'text', text: 'sunny', citations: [citation] }],
          },
        ]);
        expect(span.attributes['gen_ai.input.messages']).not.toContain('opaque-2');
      });

      test('a block without a type is a part of an unknown type', async () => {
        const { client } = makeClient([json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.messages.create({
          ...PARAMS,
          messages: [
            {
              role: 'user',
              content: [
                { text: 'untyped' } as never,
                { type: 'tool_result', tool_use_id: 'toolu_1', content: [{ text: 'untyped' } as never] },
              ],
            },
          ],
        });

        expect(attribute(onlySpan('anthropic.messages.create'), 'gen_ai.input.messages')).toEqual([
          {
            role: 'user',
            parts: [
              { type: 'anthropic_unknown' },
              { type: 'tool_call_response', id: 'toolu_1', response: [{ type: 'unknown' }] },
            ],
          },
        ]);
      });

      test('a tool result keeps a field named __proto__, as JSON.parse creates it', async () => {
        const { client } = makeClient([json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });
        const block = JSON.parse('{"type":"text","text":"sunny","__proto__":{"nested":1}}');

        await client.messages.create({
          ...PARAMS,
          messages: [
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: [block] }] },
          ],
        });

        expect(onlySpan('anthropic.messages.create').attributes['gen_ai.input.messages']).toContain(
          '{"type":"text","text":"sunny","__proto__":{"nested":1}}',
        );
      });
    });

    describe('stop sequences', () => {
      const STOPS = ['END', 'STOP'];
      const content = { openTelemetry: { traces: { contentMode: 'content' as const } } };

      test.each([
        [
          'messages.create',
          [json(MESSAGE)],
          (client: Anthropic) => client.messages.create({ ...PARAMS, stop_sequences: STOPS }),
        ],
        [
          'beta.messages.create',
          [json(MESSAGE)],
          (client: Anthropic) => client.beta.messages.create({ ...PARAMS, stop_sequences: STOPS }),
        ],
        [
          'messages.parse',
          [json(MESSAGE)],
          (client: Anthropic) => client.messages.parse({ ...PARAMS, stop_sequences: STOPS }),
        ],
        [
          'beta.messages.parse',
          [json(MESSAGE)],
          (client: Anthropic) => client.beta.messages.parse({ ...PARAMS, stop_sequences: STOPS }),
        ],
        [
          'a stream read without the stream helper',
          [sse(STREAM_EVENTS)],
          async (client: Anthropic) => {
            for await (const _ of await client.messages.create({
              ...PARAMS,
              stop_sequences: STOPS,
              stream: true,
            })) {
            }
          },
        ],
        [
          'a beta stream read without the stream helper',
          [sse(STREAM_EVENTS)],
          async (client: Anthropic) => {
            for await (const _ of await client.beta.messages.create({
              ...PARAMS,
              stop_sequences: STOPS,
              stream: true,
            })) {
            }
          },
        ],
        [
          'the stream helper',
          [sse(STREAM_EVENTS)],
          (client: Anthropic) => client.messages.stream({ ...PARAMS, stop_sequences: STOPS }).finalMessage(),
        ],
        [
          'the beta stream helper',
          [sse(STREAM_EVENTS)],
          (client: Anthropic) =>
            client.beta.messages.stream({ ...PARAMS, stop_sequences: STOPS }).finalMessage(),
        ],
      ])('%s records them as an array of strings', async (_name, handlers, call) => {
        const { client } = makeClient(handlers, content);

        await call(client);

        const span = onlySpan('anthropic.messages.create');
        expect(span.status.code).toBe(SpanStatusCode.OK);
        expect(span.attributes['gen_ai.request.stop_sequences']).toEqual(STOPS);
      });

      test('a request that sets none, or an empty list, has no attribute', async () => {
        const { client } = makeClient([json(MESSAGE), json(MESSAGE)], content);

        await client.messages.create(PARAMS);
        await client.messages.create({ ...PARAMS, stop_sequences: [] });

        for (const span of spans('anthropic.messages.create')) {
          expect(span.attributes['gen_ai.input.messages']).toBeDefined();
          expect('gen_ai.request.stop_sequences' in span.attributes).toBe(false);
        }
        expect(spans('anthropic.messages.create')).toHaveLength(2);
      });

      test('a client that records no content records none', async () => {
        const { client } = makeClient([json(MESSAGE)]);

        await client.messages.create({ ...PARAMS, stop_sequences: STOPS });

        expect('gen_ai.request.stop_sequences' in onlySpan('anthropic.messages.create').attributes).toBe(
          false,
        );
      });

      test('an error response keeps them', async () => {
        const { client } = makeClient(
          [json({ type: 'error', error: { type: 'overloaded_error' } }, 529)],
          content,
        );

        await expect(client.messages.create({ ...PARAMS, stop_sequences: STOPS })).rejects.toThrow();

        expect(onlySpan('anthropic.messages.create').attributes['gen_ai.request.stop_sequences']).toEqual(
          STOPS,
        );
      });

      test('their characters leave less of the limit for the input messages, and they stay whole', async () => {
        // The stop sequences take most of the limit, so only the newest message's text still fits.
        const stops = ['a'.repeat(350_000), 'b'.repeat(350_000)];
        const messages = [1, 2, 3].map((n) => ({ role: 'user' as const, content: String(n).repeat(30_000) }));
        const { client } = makeClient([json(MESSAGE)], content);

        await client.messages.create({ ...PARAMS, stop_sequences: stops, messages });

        const span = onlySpan('anthropic.messages.create');
        expect(span.attributes['gen_ai.request.stop_sequences']).toEqual(stops);
        expect(attribute(span, 'gen_ai.input.messages')).toEqual([
          { role: 'user', parts: [] },
          { role: 'user', parts: [] },
          { role: 'user', parts: [{ type: 'text', content: '3'.repeat(30_000) }] },
        ]);
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([
          { role: 'assistant', parts: [{ type: 'text', content: 'hello' }] },
        ]);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('the stream helper counts them with the response toward the limit', async () => {
        // The request fits in the limit with its stop sequences. With the response it does not, so
        // its oldest message loses its text when the helper records the response.
        const big = 'x'.repeat(225_000);
        const messages = [1, 2].map((n) => ({ role: 'user' as const, content: `${n}${big}` }));
        const events = [...STREAM_EVENTS];
        events[2] = { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: big } };
        const { client } = makeClient([sse(events)], content);

        await client.messages.stream({ ...PARAMS, stop_sequences: [big], messages }).finalMessage();

        const span = onlySpan('anthropic.messages.create');
        expect(span.attributes['gen_ai.request.stop_sequences']).toEqual([big]);
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([
          { role: 'assistant', parts: [{ type: 'text', content: big }] },
        ]);
        expect(attribute(span, 'gen_ai.input.messages')).toEqual([
          { role: 'user', parts: [] },
          { role: 'user', parts: [{ type: 'text', content: `2${big}` }] },
        ]);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      describe('over the limit by themselves', () => {
        const stops = ['a'.repeat(600_000), 'b'.repeat(600_000)];
        const params = {
          ...PARAMS,
          system: 'be brief',
          stop_sequences: stops,
          messages: [
            { role: 'user' as const, content: 'first' },
            { role: 'assistant' as const, content: 'second' },
            { role: 'user' as const, content: 'third' },
          ],
        };
        const input = params.messages.map(({ role, content }) => ({
          role,
          parts: [{ type: 'text', content }],
        }));
        const output = [{ role: 'assistant', parts: [{ type: 'text', content: 'hello' }] }];

        test.each([
          ['messages.create', json(MESSAGE), (client: Anthropic) => client.messages.create(params), output],
          [
            'beta.messages.create',
            json(MESSAGE),
            (client: Anthropic) => client.beta.messages.create(params),
            output,
          ],
          [
            'the stream helper',
            sse(STREAM_EVENTS),
            (client: Anthropic) => client.messages.stream(params).finalMessage(),
            output,
          ],
          [
            'a call that fails',
            json({ type: 'error', error: { type: 'overloaded_error' } }, 529),
            (client: Anthropic) => client.messages.create(params).catch(() => {}),
            undefined,
          ],
        ])(
          '%s leaves them out, marks the span, and keeps the rest whole',
          async (_name, response, call, expectedOutput) => {
            const { client } = makeClient([response], content);

            await call(client);

            const span = onlySpan('anthropic.messages.create');
            expect('gen_ai.request.stop_sequences' in span.attributes).toBe(false);
            expect(attribute(span, 'gen_ai.system_instructions')).toEqual([
              { type: 'text', content: 'be brief' },
            ]);
            expect(attribute(span, 'gen_ai.input.messages')).toEqual(input);
            expect(attribute(span, 'gen_ai.output.messages')).toEqual(expectedOutput);
            expect(span.attributes['anthropic.content.truncated']).toBe(true);
          },
        );

        test('they count for nothing, so the response still has the whole limit', async () => {
          const huge = 'h'.repeat(1_100_000);
          const { client } = makeClient(
            [json({ ...MESSAGE, content: [{ type: 'text', text: huge }] })],
            content,
          );

          await client.messages.create(params);

          const span = onlySpan('anthropic.messages.create');
          expect('gen_ai.request.stop_sequences' in span.attributes).toBe(false);
          expect(contentSize(span)).toBe(750_000);
        });
      });

      test.each([
        ['at traces.maxContentBytes stay', 200, true],
        ['one character over traces.maxContentBytes are left out', 201, false],
      ])('stop sequences that are %s', async (_name, length, kept) => {
        const stops = ['a'.repeat(100), 'b'.repeat(length - 100)];
        const { client } = makeClient([json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content', maxContentBytes: 200 } },
        });

        await client.messages.create({ ...PARAMS, stop_sequences: stops });

        const span = onlySpan('anthropic.messages.create');
        expect(span.attributes['gen_ai.request.stop_sequences']).toEqual(kept ? stops : undefined);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });
    });

    test('the environment variable applies to a client without the option only', async () => {
      process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'] = 'Content';
      const unset = makeClient([json(MESSAGE)]).client;
      const set = makeClient([json(MESSAGE)], {
        openTelemetry: { traces: { maxContentBytes: 4_096 } },
      }).client;

      await unset.messages.create(PARAMS);
      expect(onlySpan('anthropic.messages.create').attributes['gen_ai.input.messages']).toBeDefined();
      exporter.reset();

      await set.messages.create(PARAMS);
      expect(onlySpan('anthropic.messages.create').attributes['gen_ai.input.messages']).toBeUndefined();
    });

    test('a client reads the environment variable once, when it is constructed', async () => {
      const without = makeClient([json(MESSAGE)]).client;
      process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'] = 'content';
      const withContent = makeClient([json(MESSAGE)]).client;

      await without.messages.create(PARAMS);
      expect(onlySpan('anthropic.messages.create').attributes['gen_ai.input.messages']).toBeUndefined();
      exporter.reset();

      delete process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'];
      await withContent.messages.create(PARAMS);
      expect(onlySpan('anthropic.messages.create').attributes['gen_ai.input.messages']).toBeDefined();
    });

    test('a withOptions() copy without its own option keeps what the client read from the environment variable', async () => {
      process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'] = 'content';
      const { client } = makeClient([json(MESSAGE)]);
      delete process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'];

      await client.withOptions({ timeout: 1000 }).messages.create(PARAMS);

      expect(onlySpan('anthropic.messages.create').attributes['gen_ai.input.messages']).toBeDefined();
    });

    test('the old name of the environment variable is not read', async () => {
      process.env['ANTHROPIC_OPEN_TELEMETRY_CONTENT_MODE'] = 'content';
      const { client } = makeClient([json(MESSAGE)]);

      await client.messages.create(PARAMS);

      expect(onlySpan('anthropic.messages.create').attributes['gen_ai.input.messages']).toBeUndefined();
    });

    test('an error response records the request only', async () => {
      const { client } = makeClient([json({ type: 'error', error: { type: 'overloaded_error' } }, 529)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await expect(client.messages.create(PARAMS)).rejects.toThrow();

      const span = onlySpan('anthropic.messages.create');
      expect(attribute(span, 'gen_ai.input.messages')).toEqual([
        { role: 'user', parts: [{ type: 'text', content: 'hi' }] },
      ]);
      expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
    });

    const TOOL_STREAM_EVENTS = [
      STREAM_EVENTS[0]!,
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hel' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'lo' } },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 'toolu_2', name: 'get_weather', input: {} },
      },
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{"city":' },
      },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '"Oslo"}' } },
      { type: 'content_block_stop', index: 1 },
      ...STREAM_EVENTS.slice(4),
    ];
    const TOOL_STREAM_OUTPUT = [
      {
        role: 'assistant',
        parts: [
          { type: 'text', content: 'hello' },
          { type: 'tool_call', id: 'toolu_2', name: 'get_weather', arguments: { city: 'Oslo' } },
        ],
      },
    ];

    test('the stream helper records the content of the message it accumulated', async () => {
      const { client } = makeClient([sse(TOOL_STREAM_EVENTS)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      const message = await client.messages.stream(PARAMS).finalMessage();

      expect(message.content).toHaveLength(2);
      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.OK);
      expect(attribute(span, 'gen_ai.input.messages')).toEqual([
        { role: 'user', parts: [{ type: 'text', content: 'hi' }] },
      ]);
      expect(attribute(span, 'gen_ai.output.messages')).toEqual(TOOL_STREAM_OUTPUT);
    });

    test('the beta stream helper records the content of the message it accumulated', async () => {
      const { client } = makeClient([sse(TOOL_STREAM_EVENTS)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.beta.messages.stream(PARAMS).finalMessage();

      expect(attribute(onlySpan('anthropic.messages.create'), 'gen_ai.output.messages')).toEqual(
        TOOL_STREAM_OUTPUT,
      );
    });

    test('the stream helper counts the request and the response together toward the limit', async () => {
      // The request fits in the limit by itself. With the response it does not, so its oldest
      // message loses its text when the helper records the response.
      const big = 'x'.repeat(225_000);
      const messages = [1, 2, 3].map((n) => ({ role: 'user' as const, content: `${n}${big}` }));
      const events = [...STREAM_EVENTS];
      events[2] = { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: big } };
      const { client } = makeClient([sse(events)], { openTelemetry: { traces: { contentMode: 'content' } } });

      await client.messages.stream({ ...PARAMS, messages }).finalMessage();

      const span = onlySpan('anthropic.messages.create');
      expect(attribute(span, 'gen_ai.output.messages')).toEqual([
        { role: 'assistant', parts: [{ type: 'text', content: big }] },
      ]);
      expect(attribute(span, 'gen_ai.input.messages')).toEqual([
        { role: 'user', parts: [] },
        { role: 'user', parts: [{ type: 'text', content: `2${big}` }] },
        { role: 'user', parts: [{ type: 'text', content: `3${big}` }] },
      ]);
      expect(span.attributes['anthropic.content.truncated']).toBe(true);
      expect(contentSize(span)).toBeLessThanOrEqual(750_000);
    });

    test('a stream helper whose stream ends before message_stop records what it accumulated, under the limit', async () => {
      // The request fits in the limit by itself, and not with the text that the stream got to.
      const big = 'x'.repeat(225_000);
      const messages = [1, 2, 3].map((n) => ({ role: 'user' as const, content: `${n}${big}` }));
      const events = [...STREAM_EVENTS.slice(0, 3)];
      events[2] = { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: big } };
      const { client } = makeClient([sse(events)], { openTelemetry: { traces: { contentMode: 'content' } } });

      await expect(client.messages.stream({ ...PARAMS, messages }).finalMessage()).rejects.toThrow();

      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.ERROR);
      expect(span.attributes['error.type']).toBe('api_error');
      expect(span.attributes).not.toHaveProperty('anthropic.message.stop_reason');
      expect(span.attributes['gen_ai.usage.output_tokens']).toBeUndefined();
      expect(attribute(span, 'gen_ai.output.messages')).toEqual([
        { role: 'assistant', parts: [{ type: 'text', content: big }] },
      ]);
      expect(attribute(span, 'gen_ai.input.messages')).toEqual([
        { role: 'user', parts: [] },
        { role: 'user', parts: [{ type: 'text', content: `2${big}` }] },
        { role: 'user', parts: [{ type: 'text', content: `3${big}` }] },
      ]);
      expect(span.attributes['anthropic.content.truncated']).toBe(true);
      expect(contentSize(span)).toBeLessThanOrEqual(750_000);
    });

    const HELPERS = [
      ['the stream helper', (client: Anthropic) => client.messages.stream(PARAMS)],
      ['the beta stream helper', (client: Anthropic) => client.beta.messages.stream(PARAMS)],
    ] as const;

    test.each(HELPERS)(
      '%s whose stream ends inside a tool_use block records the input as far as it parses',
      async (_helper, start) => {
        const events = [
          ...TOOL_STREAM_EVENTS.slice(0, 6),
          {
            type: 'content_block_delta',
            index: 1,
            delta: { type: 'input_json_delta', partial_json: '{"city":"Oslo","days":' },
          },
        ];
        const { client } = makeClient([sse(events)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await expect(start(client).finalMessage()).rejects.toThrow();

        const span = onlySpan('anthropic.messages.create');
        expect(span.status.code).toBe(SpanStatusCode.ERROR);
        expect(span.attributes['error.type']).toBe('api_error');
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([
          {
            role: 'assistant',
            parts: [
              { type: 'text', content: 'hello' },
              { type: 'tool_call', id: 'toolu_2', name: 'get_weather', arguments: { city: 'Oslo' } },
            ],
          },
        ]);
      },
    );

    test.each(HELPERS)(
      '%s whose stream has an error event records what it accumulated before it',
      async (_helper, start) => {
        const events = [
          ...TOOL_STREAM_EVENTS.slice(0, 3),
          { type: 'error', error: { type: 'overloaded_error', message: 'busy' } },
        ];
        const { client } = makeClient([sse(events)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await expect(start(client).finalMessage()).rejects.toThrow('busy');

        const span = onlySpan('anthropic.messages.create');
        expect(span.status.code).toBe(SpanStatusCode.ERROR);
        expect(span.attributes['error.type']).toBe('overloaded_error');
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([
          { role: 'assistant', parts: [{ type: 'text', content: 'hel' }] },
        ]);
      },
    );

    test.each([
      [
        'the stream helper',
        (client: Anthropic) => {
          const stream = client.messages.stream(PARAMS);
          return stream.on('contentBlock', () => stream.abort()).finalMessage();
        },
      ],
      [
        'the beta stream helper',
        (client: Anthropic) => {
          const stream = client.beta.messages.stream(PARAMS);
          return stream.on('contentBlock', () => stream.abort()).finalMessage();
        },
      ],
    ])(
      '%s that the application aborts before message_stop records what it accumulated',
      async (_helper, run) => {
        // The response stalls after its first content block, until the request is aborted.
        const stalled: Handler = (_url, init) => {
          const body = new ReadableStream({
            start(stream) {
              const events = STREAM_EVENTS.slice(0, 4).map(
                (event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
              );
              stream.enqueue(new TextEncoder().encode(events.join('')));
              init.signal?.addEventListener('abort', () =>
                stream.error(new DOMException('aborted', 'AbortError')),
              );
            },
          });
          return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
        };
        const { client } = makeClient([stalled], { openTelemetry: { traces: { contentMode: 'content' } } });

        await expect(run(client)).rejects.toThrow('Request was aborted');

        const span = onlySpan('anthropic.messages.create');
        expect(span.status.code).toBe(SpanStatusCode.UNSET);
        expect(attribute(span, 'gen_ai.input.messages')).toEqual([
          { role: 'user', parts: [{ type: 'text', content: 'hi' }] },
        ]);
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([
          { role: 'assistant', parts: [{ type: 'text', content: 'hello' }] },
        ]);
      },
    );

    test.each(HELPERS)(
      '%s whose stream ends before message_start records the request only',
      async (_helper, start) => {
        const { client } = makeClient([sse([])], { openTelemetry: { traces: { contentMode: 'content' } } });

        await expect(start(client).finalMessage()).rejects.toThrow();

        const span = onlySpan('anthropic.messages.create');
        expect(span.status.code).toBe(SpanStatusCode.ERROR);
        expect(span.attributes['gen_ai.input.messages']).toBeDefined();
        expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
      },
    );

    const failingListener = () => {
      throw new Error('the listener failed');
    };
    test.each([
      [
        'the stream helper',
        (client: Anthropic) => client.messages.stream(PARAMS).on('text', failingListener).done(),
      ],
      [
        'the beta stream helper',
        (client: Anthropic) => client.beta.messages.stream(PARAMS).on('text', failingListener).done(),
      ],
    ])('%s that fails on an event before message_stop records the request only', async (_helper, run) => {
      const { client } = makeClient([sse(STREAM_EVENTS)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await expect(run(client)).rejects.toThrow('the listener failed');

      const span = onlySpan('anthropic.messages.create');
      expect(span.attributes['error.type']).toBe('client_error');
      expect(span.attributes['gen_ai.input.messages']).toBeDefined();
      expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
    });

    test.each([
      ['a stream', (client: Anthropic) => client.messages.create({ ...CONTENT_PARAMS, stream: true })],
      [
        'a beta stream',
        (client: Anthropic) => client.beta.messages.create({ ...CONTENT_PARAMS, stream: true }),
      ],
    ])('%s read without the stream helper records everything but its content', async (_name, create) => {
      const { client } = makeClient([sse(TOOL_STREAM_EVENTS)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      const stream: AsyncIterable<unknown> = await create(client);
      for await (const _ of stream) {
      }

      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.OK);
      expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
      expect(attribute(span, 'gen_ai.system_instructions')).toEqual([{ type: 'text', content: 'be brief' }]);
      expect(attribute(span, 'gen_ai.input.messages')).toHaveLength(3);
      expect(span.attributes).toMatchObject({
        'gen_ai.request.stream': true,
        'gen_ai.response.id': 'msg_1',
        'gen_ai.response.model': 'model-served',
        'anthropic.message.stop_reason': 'end_turn',
        'gen_ai.usage.input_tokens': 15,
        'gen_ai.usage.output_tokens': 20,
        'anthropic.response.service_tier': 'standard',
      });
      expect(span.attributes['gen_ai.response.time_to_first_chunk']).toBeGreaterThanOrEqual(0);
    });

    test('a beta stream helper that ended on a tool input it cannot parse records no response content', async () => {
      const events = [...TOOL_STREAM_EVENTS];
      events[7] = {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '"Oslo"]' },
      };
      const { client } = makeClient([sse(events)], { openTelemetry: { traces: { contentMode: 'content' } } });

      await expect(client.beta.messages.stream(PARAMS).finalMessage()).rejects.toThrow(
        'Unable to parse tool parameter JSON',
      );

      // The helper reads the rest of the stream, so the API call itself is complete.
      while (spans().length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const span = onlySpan('anthropic.messages.create');
      expect(span.status.code).toBe(SpanStatusCode.OK);
      expect(span.attributes['gen_ai.usage.output_tokens']).toBe(20);
      expect(span.attributes['gen_ai.input.messages']).toBeDefined();
      expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
    });

    test('a beta stream helper that gave up on a tool input records no response content when the stream ends early', async () => {
      const events = TOOL_STREAM_EVENTS.slice(0, 9);
      events[7] = {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '"Oslo"]' },
      };
      const { client } = makeClient([sse(events)], { openTelemetry: { traces: { contentMode: 'content' } } });

      await expect(client.beta.messages.stream(PARAMS).finalMessage()).rejects.toThrow(
        'Unable to parse tool parameter JSON',
      );

      while (spans().length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const span = onlySpan('anthropic.messages.create');
      expect(span.attributes['error.type']).toBe('api_error');
      expect(span.attributes['gen_ai.input.messages']).toBeDefined();
      expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
    });

    test('a stream read without the stream helper that ends before message_stop records the request only', async () => {
      const { client } = makeClient([sse(TOOL_STREAM_EVENTS.slice(0, 7))], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      const stream = await client.messages.create({ ...PARAMS, stream: true });
      for await (const _ of stream) {
      }

      const span = onlySpan('anthropic.messages.create');
      expect(span.attributes['error.type']).toBe('api_error');
      expect(span.attributes['gen_ai.input.messages']).toBeDefined();
      expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
    });

    test('a stream closed before message_stop records the request only', async () => {
      const { client } = makeClient([sse(STREAM_EVENTS)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      const stream = await client.messages.create({ ...PARAMS, stream: true });
      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          break;
        }
      }

      const span = onlySpan('anthropic.messages.create');
      expect(span.attributes['gen_ai.input.messages']).toBeDefined();
      expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
    });

    test('content under the limit is the plain JSON of the messages, counted in UTF-8 bytes', async () => {
      // 337,500 two-byte characters are 675 kB of UTF-8, and too many to fit at three bytes each.
      const wide = '\u00e9'.repeat(112_500);
      const messages = [1, 2, 3].map((n) => ({ role: 'user' as const, content: `${n}${wide}` }));
      const { client } = makeClient([json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.messages.create({ ...PARAMS, messages });

      const span = onlySpan('anthropic.messages.create');
      const expected = messages.map(({ role, content }) => ({ role, parts: [{ type: 'text', content }] }));
      expect(span.attributes['gen_ai.input.messages']).toBe(JSON.stringify(expected));
      expect(span.attributes['gen_ai.output.messages']).toBeDefined();
      expect(span.attributes['anthropic.content.truncated']).toBeUndefined();
    });

    test('content under the limit in `length` and over it in UTF-8 bytes loses parts', async () => {
      // 675,000 two-byte characters are under the limit in `length` but 1.35 MB of UTF-8.
      const wide = '\u00e9'.repeat(225_000);
      const messages = [1, 2, 3].map((n) => ({ role: 'user' as const, content: `${n}${wide}` }));
      const { client } = makeClient([json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.messages.create({ ...PARAMS, messages });

      const span = onlySpan('anthropic.messages.create');
      expect(attribute(span, 'gen_ai.input.messages')).toEqual([
        { role: 'user', parts: [] },
        { role: 'user', parts: [] },
        { role: 'user', parts: [{ type: 'text', content: `3${wide}` }] },
      ]);
      expect(contentSize(span)).toBeLessThanOrEqual(750_000);
      expect(span.attributes['anthropic.content.truncated']).toBe(true);
    });

    test('content over the limit loses the parts of the oldest input messages, which stay without parts, and the span says so', async () => {
      const big = 'x'.repeat(225_000);
      const messages = [1, 2, 3, 4, 5].map((n) => ({ role: 'user' as const, content: `${n}${big}` }));
      const { client } = makeClient([json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.messages.create({ ...PARAMS, messages });

      const span = onlySpan('anthropic.messages.create');
      expect(contentSize(span)).toBeLessThanOrEqual(750_000);
      const kept = attribute(span, 'gen_ai.input.messages');
      expect(kept.slice(0, 2)).toEqual([
        { role: 'user', parts: [] },
        { role: 'user', parts: [] },
      ]);
      expect(kept.slice(2)).toEqual(
        [3, 4, 5].map((n) => ({ role: 'user', parts: [{ type: 'text', content: `${n}${big}` }] })),
      );
      expect(attribute(span, 'gen_ai.output.messages')).toEqual([
        { role: 'assistant', parts: [{ type: 'text', content: 'hello' }] },
      ]);
      expect(span.attributes['anthropic.content.truncated']).toBe(true);
    });

    test('the system instructions lose their parts before the input messages lose any', async () => {
      const messages = [1, 2, 3].map((n) => ({ role: 'user' as const, content: String(n).repeat(30_000) }));
      const { client } = makeClient([json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.messages.create({ ...PARAMS, system: 's'.repeat(700_000), messages });

      const span = onlySpan('anthropic.messages.create');
      expect(span.attributes['gen_ai.system_instructions']).toBe('[]');
      expect(attribute(span, 'gen_ai.input.messages')).toEqual(
        [1, 2, 3].map((n) => ({
          role: 'user',
          parts: [{ type: 'text', content: String(n).repeat(30_000) }],
        })),
      );
      expect(span.attributes['anthropic.content.truncated']).toBe(true);
    });

    test('an input part over the limit by itself is removed whole while the output has parts, and none is shortened', async () => {
      const huge = 'h'.repeat(1_100_000);
      const messages = [
        { role: 'user' as const, content: 'first' },
        { role: 'assistant' as const, content: 'second' },
        { role: 'user' as const, content: huge },
      ];
      const { client } = makeClient([json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.messages.create({ ...PARAMS, messages });

      const span = onlySpan('anthropic.messages.create');
      expect(attribute(span, 'gen_ai.input.messages')).toEqual([
        { role: 'user', parts: [] },
        { role: 'assistant', parts: [] },
        { role: 'user', parts: [] },
      ]);
      expect(attribute(span, 'gen_ai.output.messages')).toEqual([
        { role: 'assistant', parts: [{ type: 'text', content: 'hello' }] },
      ]);
      expect(span.attributes['anthropic.content.truncated']).toBe(true);
    });

    test('a tool result over the limit by its content blocks is removed whole with the parts before it, and none is shortened', async () => {
      const huge = 'h'.repeat(1_100_000);
      const messages = [
        { role: 'user' as const, content: 'hi' },
        {
          role: 'assistant' as const,
          content: [{ type: 'tool_use' as const, id: 'toolu_1', name: 'search', input: {} }],
        },
        {
          role: 'user' as const,
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: 'toolu_1',
              content: [
                {
                  type: 'search_result' as const,
                  source: 'https://example.com',
                  title: 'Big',
                  content: [{ type: 'text' as const, text: huge }],
                },
              ],
            },
            { type: 'text' as const, text: 'and then' },
          ],
        },
        { role: 'assistant' as const, content: 'done' },
        { role: 'user' as const, content: 'thanks' },
      ];
      const { client } = makeClient([json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.messages.create({ ...PARAMS, messages });

      const span = onlySpan('anthropic.messages.create');
      expect(attribute(span, 'gen_ai.input.messages')).toEqual([
        { role: 'user', parts: [] },
        { role: 'assistant', parts: [] },
        { role: 'user', parts: [{ type: 'text', content: 'and then' }] },
        { role: 'assistant', parts: [{ type: 'text', content: 'done' }] },
        { role: 'user', parts: [{ type: 'text', content: 'thanks' }] },
      ]);
      expect(span.attributes['anthropic.content.truncated']).toBe(true);
    });

    test('system instructions over the limit by themselves are removed whole, and the input and the output stay', async () => {
      const messages = [
        { role: 'user' as const, content: 'first' },
        { role: 'assistant' as const, content: 'second' },
        { role: 'user' as const, content: 'third' },
      ];
      const { client } = makeClient([json(MESSAGE)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.messages.create({ ...PARAMS, system: 's'.repeat(1_100_000), messages });

      const span = onlySpan('anthropic.messages.create');
      expect(span.attributes['gen_ai.system_instructions']).toBe('[]');
      expect(attribute(span, 'gen_ai.input.messages')).toEqual(
        messages.map(({ role, content }) => ({ role, parts: [{ type: 'text', content }] })),
      );
      expect(attribute(span, 'gen_ai.output.messages')).toEqual([
        { role: 'assistant', parts: [{ type: 'text', content: 'hello' }] },
      ]);
      expect(span.attributes['anthropic.content.truncated']).toBe(true);
    });

    test('system instructions lose their parts while the output is whole', async () => {
      const text = 'y'.repeat(600_000);
      const system = [
        { type: 'text' as const, text: 'first' },
        { type: 'text' as const, text: 's'.repeat(600_000) },
      ];
      const { client } = makeClient([json({ ...MESSAGE, content: [{ type: 'text', text }] })], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await client.messages.create({ ...PARAMS, system });

      const span = onlySpan('anthropic.messages.create');
      expect(span.attributes['gen_ai.system_instructions']).toBe('[]');
      expect(attribute(span, 'gen_ai.input.messages')).toEqual([
        { role: 'user', parts: [{ type: 'text', content: 'hi' }] },
      ]);
      expect(attribute(span, 'gen_ai.output.messages')).toEqual([
        { role: 'assistant', parts: [{ type: 'text', content: text }] },
      ]);
      expect(span.attributes['anthropic.content.truncated']).toBe(true);
    });

    test('system instructions lose their first parts, also when the call fails', async () => {
      const system = ['a', 'b', 'c'].map((each) => ({ type: 'text' as const, text: each.repeat(600_000) }));
      const { client } = makeClient([json({ type: 'error', error: { type: 'overloaded_error' } }, 529)], {
        openTelemetry: { traces: { contentMode: 'content' } },
      });

      await expect(client.messages.create({ ...PARAMS, system })).rejects.toThrow();

      const span = onlySpan('anthropic.messages.create');
      expect(attribute(span, 'gen_ai.system_instructions')).toEqual([
        { type: 'text', content: 'c'.repeat(600_000) },
      ]);
      expect(attribute(span, 'gen_ai.input.messages')).toEqual([
        { role: 'user', parts: [{ type: 'text', content: 'hi' }] },
      ]);
      expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
      expect(span.attributes['anthropic.content.truncated']).toBe(true);
    });

    describe('a request whose one part is over the limit by itself', () => {
      const huge = 'h'.repeat(1_100_000);
      const messages = [{ role: 'user' as const, content: huge }];

      test('keeps the start of that text when the call has no response', async () => {
        const { client } = makeClient([json({ type: 'error', error: { type: 'overloaded_error' } }, 529)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await expect(client.messages.create({ ...PARAMS, messages })).rejects.toThrow();

        const span = onlySpan('anthropic.messages.create');
        const [message] = attribute(span, 'gen_ai.input.messages');
        expect(message).toEqual({
          role: 'user',
          parts: [{ type: 'text', content: 'h'.repeat(message.parts[0].content.length) }],
        });
        expect(contentSize(span)).toBe(750_000);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('loses that text whole, not the start that fitted when the call started, once the response has parts', async () => {
        const { client } = makeClient([json(MESSAGE)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.messages.create({ ...PARAMS, messages });

        const span = onlySpan('anthropic.messages.create');
        expect(span.attributes['gen_ai.input.messages']).toBe('[{"role":"user","parts":[]}]');
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([
          { role: 'assistant', parts: [{ type: 'text', content: 'hello' }] },
        ]);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('loses that text whole once the stream helper has accumulated the response, too', async () => {
        const { client } = makeClient([sse(STREAM_EVENTS)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.messages.stream({ ...PARAMS, messages }).finalMessage();

        const span = onlySpan('anthropic.messages.create');
        expect(span.attributes['gen_ai.input.messages']).toBe('[{"role":"user","parts":[]}]');
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([
          { role: 'assistant', parts: [{ type: 'text', content: 'hello' }] },
        ]);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });
    });

    describe('a response that is over the limit by itself', () => {
      const half = 'y'.repeat(350_000);
      const blocks = [1, 2, 3].map((n) => ({ type: 'text' as const, text: `${n}${half}` }));
      const messages = [
        { role: 'user' as const, content: 'first' },
        { role: 'user' as const, content: 'second' },
      ];
      const EMPTIED_INPUT = [
        { role: 'user', parts: [] },
        { role: 'user', parts: [] },
      ];

      const expectFirstPartRemoved = (span: ReadableSpan) => {
        expect(attribute(span, 'gen_ai.input.messages')).toEqual(EMPTIED_INPUT);
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([
          {
            role: 'assistant',
            parts: [
              { type: 'text', content: `2${half}` },
              { type: 'text', content: `3${half}` },
            ],
          },
        ]);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      };

      test('loses every input part, then the first part of the output message', async () => {
        const { client } = makeClient([json({ ...MESSAGE, content: blocks })], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.messages.create({ ...PARAMS, messages });

        expectFirstPartRemoved(onlySpan('anthropic.messages.create'));
      });

      test('loses it from the message that the stream helper accumulated, too', async () => {
        const events = [
          STREAM_EVENTS[0]!,
          ...blocks.flatMap((block, index) => [
            { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
            { type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } },
            { type: 'content_block_stop', index },
          ]),
          ...STREAM_EVENTS.slice(4),
        ];
        const { client } = makeClient([sse(events)], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        const message = await client.messages.stream({ ...PARAMS, messages }).finalMessage();

        expect(message.content).toHaveLength(3);
        expectFirstPartRemoved(onlySpan('anthropic.messages.create'));
      });

      test('loses a tool call whole, then the end of the last text after it, between two characters', async () => {
        // Each of these is four bytes, and two characters as `length` counts them, which the cut does not come between.
        const text = '\u{1f600}'.repeat(550_000);
        const use = { type: 'tool_use', id: 'toolu_1', name: 'search', input: { query: 'cats' } };
        const { client } = makeClient([json({ ...MESSAGE, content: [use, { type: 'text', text }] })], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.messages.create({ ...PARAMS, messages });

        const span = onlySpan('anthropic.messages.create');
        expect(attribute(span, 'gen_ai.input.messages')).toEqual(EMPTIED_INPUT);
        const [output] = attribute(span, 'gen_ai.output.messages');
        expect(output.parts).toEqual([
          { type: 'text', content: text.slice(0, output.parts[0].content.length) },
        ]);
        expect(output.parts[0].content.length % 2).toBe(0);
        expect(contentSize(span)).toBeLessThanOrEqual(750_000);
        expect(contentSize(span) + 4).toBeGreaterThan(750_000);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('cuts the last text where the characters that the JSON escapes fit', async () => {
        // In the JSON a newline takes two characters, and the control character six.
        const text = 'line\n\u0001'.repeat(200_000);
        const { client } = makeClient([json({ ...MESSAGE, content: [{ type: 'text', text }] })], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.messages.create({ ...PARAMS, messages });

        const span = onlySpan('anthropic.messages.create');
        expect(attribute(span, 'gen_ai.input.messages')).toEqual(EMPTIED_INPUT);
        const [output] = attribute(span, 'gen_ai.output.messages');
        const [part, ...rest] = output.parts;
        expect(rest).toEqual([]);
        expect(part).toEqual({ type: 'text', content: text.slice(0, part.content.length) });
        // The next character would not have fitted.
        const next = JSON.stringify(text[part.content.length]).length - 2;
        expect(contentSize(span)).toBeLessThanOrEqual(750_000);
        expect(contentSize(span) + next).toBeGreaterThan(750_000);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('loses reasoning whole, never the end of it, also as the last part', async () => {
        const thinking = 't'.repeat(1_100_000);
        const blocks = [
          { type: 'text', text: 'ok' },
          { type: 'thinking', thinking, signature: 'sig' },
        ];
        const { client } = makeClient([json({ ...MESSAGE, content: blocks })], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.messages.create({ ...PARAMS, messages });

        const span = onlySpan('anthropic.messages.create');
        expect(attribute(span, 'gen_ai.input.messages')).toEqual(EMPTIED_INPUT);
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([{ role: 'assistant', parts: [] }]);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('loses a tool call response whose one object is over the limit whole, and shortens nothing', async () => {
        const huge = 'h'.repeat(1_100_000);
        const use = { type: 'server_tool_use', id: 'srvtoolu_1', name: 'code_execution', input: {} };
        const result = {
          type: 'code_execution_tool_result',
          tool_use_id: 'srvtoolu_1',
          content: { type: 'code_execution_result', stdout: huge, stderr: '', return_code: 0, content: [] },
        };
        const { client } = makeClient([json({ ...MESSAGE, content: [use, result] })], {
          openTelemetry: { traces: { contentMode: 'content' } },
        });

        await client.messages.create({ ...PARAMS, messages });

        const span = onlySpan('anthropic.messages.create');
        expect(attribute(span, 'gen_ai.input.messages')).toEqual(EMPTIED_INPUT);
        expect(attribute(span, 'gen_ai.output.messages')).toEqual([{ role: 'assistant', parts: [] }]);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      describe('in one part', () => {
        const huge = 'h'.repeat(1_100_000);

        const expectCut = (span: ReadableSpan) => {
          expect(span.attributes['gen_ai.system_instructions']).toBe('[]');
          expect(attribute(span, 'gen_ai.input.messages')).toEqual([{ role: 'user', parts: [] }]);
          const [output] = attribute(span, 'gen_ai.output.messages');
          expect(output.parts).toEqual([
            { type: 'text', content: 'h'.repeat(output.parts[0].content.length) },
          ]);
          expect(contentSize(span)).toBe(750_000);
          expect(span.attributes['anthropic.content.truncated']).toBe(true);
        };

        test('loses the system instructions and the input parts, then the end of that part', async () => {
          const { client } = makeClient([json({ ...MESSAGE, content: [{ type: 'text', text: huge }] })], {
            openTelemetry: { traces: { contentMode: 'content' } },
          });

          await client.messages.create({ ...PARAMS, system: 'be brief' });

          expectCut(onlySpan('anthropic.messages.create'));
        });

        test('loses them from the message that the stream helper accumulated, too', async () => {
          const events = [...STREAM_EVENTS];
          events[2] = { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: huge } };
          const { client } = makeClient([sse(events)], {
            openTelemetry: { traces: { contentMode: 'content' } },
          });

          const message = await client.messages.stream({ ...PARAMS, system: 'be brief' }).finalMessage();

          expect(message.content).toHaveLength(1);
          expectCut(onlySpan('anthropic.messages.create'));
        });
      });
    });

    test('a span with nothing to remove is not marked, even when it is over the limit', async () => {
      const { client } = makeClient([json({ type: 'error', error: { type: 'overloaded_error' } }, 529)], {
        openTelemetry: { traces: { contentMode: 'content', maxContentBytes: 1 } },
      });

      await expect(client.messages.create({ ...PARAMS, messages: [] })).rejects.toThrow();

      const span = onlySpan('anthropic.messages.create');
      expect(span.attributes['gen_ai.input.messages']).toBe('[]');
      expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
      expect(span.attributes['anthropic.content.truncated']).toBeUndefined();
    });

    describe('traces.maxContentBytes', () => {
      const messages = [{ role: 'user' as const, content: 'h'.repeat(1_000) }];
      const withBound = (maxContentBytes: number) => ({
        openTelemetry: { traces: { contentMode: 'content' as const, maxContentBytes } },
      });

      test('a request over the bound keeps the start of its text that fits', async () => {
        const { client } = makeClient(
          [json({ type: 'error', error: { type: 'overloaded_error' } }, 529)],
          withBound(200),
        );

        await expect(client.messages.create({ ...PARAMS, messages })).rejects.toThrow();

        const span = onlySpan('anthropic.messages.create');
        const [message] = attribute(span, 'gen_ai.input.messages');
        expect(message).toEqual({
          role: 'user',
          parts: [{ type: 'text', content: 'h'.repeat(message.parts[0].content.length) }],
        });
        expect(contentSize(span)).toBe(200);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      test.each([
        [
          'messages.create',
          json(MESSAGE),
          (client: Anthropic) => client.messages.create({ ...PARAMS, messages }),
        ],
        [
          'messages.stream',
          sse(STREAM_EVENTS),
          (client: Anthropic) => client.messages.stream({ ...PARAMS, messages }).finalMessage(),
        ],
      ])(
        '%s removes parts of a call with a response that is over the bound',
        async (_name, response, call) => {
          const { client } = makeClient([response], withBound(200));

          await call(client);

          const span = onlySpan('anthropic.messages.create');
          expect(span.attributes['gen_ai.input.messages']).toBe('[{"role":"user","parts":[]}]');
          expect(attribute(span, 'gen_ai.output.messages')).toEqual([
            { role: 'assistant', parts: [{ type: 'text', content: 'hello' }] },
          ]);
          expect(contentSize(span)).toBeLessThanOrEqual(200);
          expect(span.attributes['anthropic.content.truncated']).toBe(true);
        },
      );

      test('a call within the bound keeps all of its content', async () => {
        const { client } = makeClient([json(MESSAGE)], withBound(2_000));

        await client.messages.create({ ...PARAMS, messages });

        const span = onlySpan('anthropic.messages.create');
        expect(attribute(span, 'gen_ai.input.messages')).toEqual([
          { role: 'user', parts: [{ type: 'text', content: 'h'.repeat(1_000) }] },
        ]);
        expect(span.attributes['anthropic.content.truncated']).toBeUndefined();
      });

      test('a bound over the default one keeps content that the default one cuts', async () => {
        const huge = [{ role: 'user' as const, content: 'h'.repeat(1_100_000) }];
        const { client } = makeClient([json(MESSAGE)], withBound(2_000_000));

        await client.messages.create({ ...PARAMS, messages: huge });

        const span = onlySpan('anthropic.messages.create');
        expect(attribute(span, 'gen_ai.input.messages')[0].parts[0].content).toHaveLength(1_100_000);
        expect(span.attributes['anthropic.content.truncated']).toBeUndefined();
      });

      test('the environment variable gives the bound of a client without the option', async () => {
        process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'] = 'content';
        process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES'] = '200';
        try {
          const { client } = makeClient([json(MESSAGE)]);

          await client.messages.create({ ...PARAMS, messages });
        } finally {
          delete process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'];
          delete process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES'];
        }

        const span = onlySpan('anthropic.messages.create');
        expect(contentSize(span)).toBeLessThanOrEqual(200);
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });
    });

    describe('the size limit, with a small limit', () => {
      const FIELDS = [
        ['system_instructions', 'gen_ai.system_instructions'],
        ['input_messages', 'gen_ai.input.messages'],
        ['output_messages', 'gen_ai.output.messages'],
      ] as const;
      type Field = (typeof FIELDS)[number][0];
      type Content = { [field in Field]?: unknown[] | null } & { stop_sequences?: string[] | null };

      /** In `expected`, `null` is an absent attribute, and stop sequences that it leaves out are whole. */
      interface SizeLimitCase {
        name: string;
        bound: number;
        size_before: number;
        input: Content;
        expected: Content;
        expected_truncated: boolean;
        size_after: number;
      }
      const CASES: SizeLimitCase[] = SIZE_LIMIT_CASES;

      /** The span that `setContentAttributes` leaves of `content` under `limit`. */
      const fitted = (content: Content, limit: number) => {
        const span = tracer.startSpan('fitted');
        const attributes = Object.fromEntries(
          FIELDS.map(([field, name]) => [name, content[field] ?? undefined]),
        );
        setContentAttributes(
          span,
          { ...attributes, 'gen_ai.request.stop_sequences': content.stop_sequences ?? undefined },
          limit,
        );
        span.end();
        return onlySpan('fitted');
      };

      /** The size of all the content of `span`: its stop sequences count by their UTF-8 bytes. */
      const wholeSize = (span: ReadableSpan) => {
        const stops = span.attributes['gen_ai.request.stop_sequences'];
        return (Array.isArray(stops) ? Buffer.byteLength(stops.join('')) : 0) + contentSize(span);
      };

      test.each(CASES.map((each) => [each.name, each] as const))('%s', (_name, each) => {
        expect(wholeSize(fitted(each.input, Infinity))).toBe(each.size_before);
        exporter.reset();

        const span = fitted(each.input, each.bound);

        const stops =
          'stop_sequences' in each.expected ? each.expected.stop_sequences : each.input.stop_sequences;
        expect(span.attributes['gen_ai.request.stop_sequences']).toEqual(stops ?? undefined);
        for (const [field, name] of FIELDS) {
          const expected = each.expected[field];
          if (expected == null) {
            expect(span.attributes[name]).toBeUndefined();
          } else {
            expect(span.attributes[name]).toBe(JSON.stringify(expected));
          }
        }
        expect(span.attributes['anthropic.content.truncated']).toBe(
          each.expected_truncated ? true : undefined,
        );
        expect(wholeSize(span)).toBe(each.size_after);
      });

      test.each([
        ['at the limit stay whole, and count toward it', 100, ['s'.repeat(60), 't'.repeat(40)]],
        ['one character over the limit are left out, and count for nothing', 101, undefined],
      ])('stop sequences that are %s', (_name, length, expected) => {
        const stops = ['s'.repeat(60), 't'.repeat(length - 60)];
        const input = [{ role: 'user', parts: [{ type: 'text', content: 'question' }] }];

        const span = fitted({ stop_sequences: stops, input_messages: input }, 100);

        expect(span.attributes['gen_ai.request.stop_sequences']).toEqual(expected);
        expect(span.attributes['gen_ai.input.messages']).toBe(
          JSON.stringify(expected ? [{ role: 'user', parts: [{ type: 'text', content: '' }] }] : input),
        );
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('stop sequences that are over the limit are a removal on a span with nothing else', () => {
        const span = fitted({ stop_sequences: ['s'.repeat(101)] }, 100);

        expect(span.attributes).toEqual({ 'anthropic.content.truncated': true });
      });

      test('the parts of several output messages are one list after the input, which loses parts from its start', () => {
        const output = [
          {
            role: 'assistant',
            parts: [
              { type: 'text', content: 'one' },
              { type: 'text', content: 'two' },
            ],
          },
          { role: 'assistant', parts: [{ type: 'reasoning', content: 'three' }] },
          { role: 'assistant', parts: [{ type: 'text', content: 'four' }] },
        ];
        const input = [{ role: 'user', parts: [{ type: 'text', content: 'question' }] }];
        const expected = [
          { role: 'assistant', parts: [] },
          { role: 'assistant', parts: [] },
          { role: 'assistant', parts: [{ type: 'text', content: 'four' }] },
        ];
        const limit = JSON.stringify([{ role: 'user', parts: [] }]).length + JSON.stringify(expected).length;

        const span = fitted({ input_messages: input, output_messages: output }, limit);

        expect(span.attributes['gen_ai.input.messages']).toBe('[{"role":"user","parts":[]}]');
        expect(span.attributes['gen_ai.output.messages']).toBe(JSON.stringify(expected));
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('a last text part that does not fit even when it is empty stays, with empty content', () => {
        const input = [{ role: 'user', parts: [{ type: 'text', content: 'question' }] }];

        const span = fitted({ stop_sequences: ['s'.repeat(100)], input_messages: input }, 100);

        expect(span.attributes['gen_ai.input.messages']).toBe(
          '[{"role":"user","parts":[{"type":"text","content":""}]}]',
        );
        expect(span.attributes['anthropic.content.truncated']).toBe(true);
      });

      test('a last text part that is empty already, on a span over the limit, is not a removal', () => {
        const input = [{ role: 'user', parts: [{ type: 'text', content: '' }] }];

        const span = fitted({ stop_sequences: ['s'.repeat(100)], input_messages: input }, 100);

        expect(span.attributes['gen_ai.input.messages']).toBe(JSON.stringify(input));
        expect(span.attributes['anthropic.content.truncated']).toBeUndefined();
      });

      describe('counts wide characters by their UTF-8 bytes', () => {
        const wide = '\u00e9\u20ac\u{1f600}';
        const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));

        test.each([
          ['at the limit stays whole', 0, wide.repeat(5)],
          ['one byte over the limit loses its last character whole', -1, wide.repeat(4) + '\u00e9\u20ac'],
        ])('a text that is %s', (_name, room, kept) => {
          const input = [{ role: 'user', parts: [{ type: 'text', content: wide.repeat(5) }] }];
          expect(3 * JSON.stringify(input).length).toBeGreaterThan(bytes(input));

          const span = fitted({ input_messages: input }, bytes(input) + room);

          expect(span.attributes['gen_ai.input.messages']).toBe(
            JSON.stringify([{ role: 'user', parts: [{ type: 'text', content: kept }] }]),
          );
          expect(span.attributes['anthropic.content.truncated']).toBe(room < 0 ? true : undefined);
        });

        test.each([
          ['at the limit stay', 100, true],
          ['one byte over the limit are left out', 101, false],
        ])('stop sequences that are %s', (_name, size, kept) => {
          const stops = ['\u00e9'.repeat(30), '\u20ac'.repeat(13) + 's'.repeat(size - 99)];
          expect(Buffer.byteLength(stops.join(''))).toBe(size);

          const span = fitted({ stop_sequences: stops }, 100);

          expect(span.attributes['gen_ai.request.stop_sequences']).toEqual(kept ? stops : undefined);
          expect(span.attributes['anthropic.content.truncated']).toBe(kept ? undefined : true);
        });

        test.each([
          ['at the limit is set beside the request', 0],
          ['one byte over the limit takes parts of the request', -1],
        ])('a response that with the request is %s', async (_name, room) => {
          const messages = [{ role: 'user' as const, content: wide.repeat(20) }];
          const response = { ...MESSAGE, content: [{ type: 'text', text: wide.repeat(2) }] };
          const input = [{ role: 'user', parts: [{ type: 'text', content: wide.repeat(20) }] }];
          const output = [{ role: 'assistant', parts: [{ type: 'text', content: wide.repeat(2) }] }];
          const maxContentBytes = bytes(input) + bytes(output) + room;
          // The request is too long to fit at three bytes a character, so its size is measured, and
          // the response fits beside it in bytes alone, not at three bytes a character.
          expect(3 * JSON.stringify(input).length).toBeGreaterThan(maxContentBytes);
          expect(bytes(input) + JSON.stringify(output).length).toBeLessThan(maxContentBytes);
          const { client } = makeClient([json(response)], {
            openTelemetry: { traces: { contentMode: 'content', maxContentBytes } },
          });

          await client.messages.create({ ...PARAMS, messages });

          const span = onlySpan('anthropic.messages.create');
          expect(attribute(span, 'gen_ai.input.messages')).toEqual(
            room < 0 ? [{ role: 'user', parts: [] }] : input,
          );
          expect(attribute(span, 'gen_ai.output.messages')).toEqual(output);
          expect(span.attributes['anthropic.content.truncated']).toBe(room < 0 ? true : undefined);
        });

        test('a cut text ends on a whole character at every limit, and the next one would not fit', () => {
          const content = `a${wide}"\n\u0001`.repeat(3);
          const characters = [...content];
          const empty = bytes([{ role: 'user', parts: [{ type: 'text', content: '' }] }]);

          for (let limit = empty; limit < empty + bytes(content) - 2; limit++) {
            exporter.reset();
            const span = fitted(
              { input_messages: [{ role: 'user', parts: [{ type: 'text', content }] }] },
              limit,
            );

            const kept: string = attribute(span, 'gen_ai.input.messages')[0].parts[0].content;
            const count = [...kept].length;
            expect(kept).toBe(characters.slice(0, count).join(''));
            expect(contentSize(span)).toBeLessThanOrEqual(limit);
            expect(contentSize(span) + bytes(characters[count]) - 2).toBeGreaterThan(limit);
          }
        });
      });

      test('the content that the caller passed keeps its parts', () => {
        const input = [{ role: 'user', parts: [{ type: 'text', content: 'question' }] }];
        const before = JSON.stringify(input);

        const span = fitted({ input_messages: input }, before.length - 1);

        expect(span.attributes['anthropic.content.truncated']).toBe(true);
        expect(JSON.stringify(input)).toBe(before);
      });
    });
  });
});
