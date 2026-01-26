import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessageParam, BetaToolUnion } from '@anthropic-ai/sdk/resources/beta';
import type {
  Tool,
  TextContent,
  ImageContent,
  AudioContent,
  ResourceLink,
  TextResourceContents,
  BlobResourceContents,
  PromptMessage,
  CallToolResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import {
  mcpTool,
  mcpTools,
  mcpMessage,
  mcpMessages,
  mcpContent,
  mcpResourceToContent,
  mcpResourceToFile,
  UnsupportedMCPValueError,
  SDK_HELPER_SYMBOL,
  collectStainlessHelpers,
  stainlessHelperHeader,
  type MCPClientLike,
} from '../../../src/helpers/beta/mcp';
import { mockFetch } from '../../lib/mock-fetch';

/**
 * These tests verify that MCP helpers produce correct API requests.
 */
describe('MCP helpers', () => {
  describe('mcpContent', () => {
    it('throws UnsupportedMCPValueError for audio content', () => {
      const audioContent: AudioContent = {
        type: 'audio',
        data: 'base64encodedaudio',
        mimeType: 'audio/mpeg',
      };

      try {
        mcpContent(audioContent);
        fail('Expected error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UnsupportedMCPValueError);
        expect((e as Error).message).toContain('audio');
      }
    });

    it('throws UnsupportedMCPValueError for resource_link content type', () => {
      const resourceLinkContent: ResourceLink = {
        type: 'resource_link',
        uri: 'https://example.com/image.png',
        name: 'example-image',
        mimeType: 'image/png',
      };

      expect(() => mcpContent(resourceLinkContent)).toThrow(UnsupportedMCPValueError);
      expect(() => mcpContent(resourceLinkContent)).toThrow('resource_link');
    });
  });

  describe('mcpTool', () => {
    it('sends correct tool definition to API', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const tool: Tool = {
        name: 'get_weather',
        description: 'Get the weather for a location',
        inputSchema: {
          type: 'object' as const,
          properties: {
            location: { type: 'string', description: 'City name' },
          },
          required: ['location'],
        },
      };

      const mockClient: MCPClientLike = {
        callTool: async () => ({ content: [{ type: 'text', text: 'Sunny, 72°F' }] }),
      };

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'The weather is nice.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [mcpTool(tool, mockClient)],
      });

      expect(capturedBody.tools).toHaveLength(1);
      expect(capturedBody.tools[0]).toMatchObject({
        name: 'get_weather',
        description: 'Get the weather for a location',
        input_schema: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name' },
          },
          required: ['location'],
        },
      });
    });

    it('sends tool with extra props to API', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const tool: Tool = {
        name: 'cached_tool',
        inputSchema: { type: 'object' as const },
      };

      const mockClient: MCPClientLike = {
        callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
      };

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Done.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Do something' }],
        tools: [mcpTool(tool, mockClient, { cache_control: { type: 'ephemeral' as const } })],
      });

      expect(capturedBody.tools[0]).toMatchObject({
        name: 'cached_tool',
        cache_control: { type: 'ephemeral' },
      });
    });

    it('sends correct tool result to API after tool execution', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const tool: Tool = {
        name: 'get_weather',
        description: 'Get the weather',
        inputSchema: {
          type: 'object' as const,
          properties: { location: { type: 'string' } },
        },
      };

      const mockClient: MCPClientLike = {
        callTool: async () => ({
          content: [
            { type: 'text', text: 'Current weather: Sunny, 72°F' },
            { type: 'text', text: 'Humidity: 45%' },
          ],
        }),
      };

      // Set up handlers for both requests BEFORE starting the runner
      const capturedRequests: any[] = [];

      // First request returns tool_use
      handleRequest(async (_req, init) => {
        capturedRequests.push(JSON.parse(init?.body as string));
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool_123',
                name: 'get_weather',
                input: { location: 'San Francisco' },
              },
            ],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'tool_use',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Second request - capture the tool result
      handleRequest(async (_req, init) => {
        capturedRequests.push(JSON.parse(init?.body as string));
        return new Response(
          JSON.stringify({
            id: 'msg_2',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'The weather is nice!' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 20, output_tokens: 10 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      const runner = anthropic.beta.messages.toolRunner({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [mcpTool(tool, mockClient)],
      });

      // Consume the runner to trigger tool execution
      for await (const _message of runner) {
        // Just iterate to completion
      }

      // Check we got both requests
      expect(capturedRequests.length).toBe(2);

      // Verify the tool result was sent correctly in the second request
      const secondRequest = capturedRequests[1];
      const toolResultMessage = secondRequest.messages.find(
        (m: any) => m.role === 'user' && Array.isArray(m.content),
      );
      const toolResultBlock = toolResultMessage?.content?.find((c: any) => c.type === 'tool_result');

      expect(toolResultBlock).toMatchObject({
        type: 'tool_result',
        tool_use_id: 'tool_123',
        content: [
          { type: 'text', text: 'Current weather: Sunny, 72°F' },
          { type: 'text', text: 'Humidity: 45%' },
        ],
      });
    });

    it('throws when MCP tool returns audio content', async () => {
      const tool: Tool = {
        name: 'audio_tool',
        inputSchema: { type: 'object' as const },
      };

      const audioContent: AudioContent = {
        type: 'audio',
        data: 'base64encodedaudiodata',
        mimeType: 'audio/wav',
      };

      const mockClient: MCPClientLike = {
        callTool: async (): Promise<CallToolResult> => ({
          content: [audioContent],
        }),
      };

      const runnableTool = mcpTool(tool, mockClient);

      await expect(runnableTool.run({})).rejects.toThrow('Unsupported MCP content type: audio');
    });

    it('throws when MCP tool returns resource_link', async () => {
      const tool: Tool = {
        name: 'resource_link_tool',
        inputSchema: { type: 'object' as const },
      };

      const resourceLinkContent: ResourceLink = {
        type: 'resource_link',
        uri: 'https://example.com/screenshot.png',
        name: 'screenshot',
        mimeType: 'image/png',
      };

      const mockClient: MCPClientLike = {
        callTool: async (): Promise<CallToolResult> => ({
          content: [resourceLinkContent],
        }),
      };

      const runnableTool = mcpTool(tool, mockClient);

      await expect(runnableTool.run({})).rejects.toThrow('resource_link');
    });

    it('returns JSON-encoded structuredContent when content is empty but structuredContent is present', async () => {
      const tool: Tool = {
        name: 'structured_only_tool',
        description: 'Tool that returns structured content only',
        inputSchema: { type: 'object' as const },
      };

      const structuredData = {
        status: 'success',
        data: {
          items: [1, 2, 3],
          metadata: { count: 3 },
        },
      };

      // When an MCP tool returns only structuredContent without any content blocks,
      // we should JSON encode the structuredContent
      const mockClient: MCPClientLike = {
        callTool: async (): Promise<CallToolResult> => ({
          content: [],
          structuredContent: structuredData,
        }),
      };

      const runnableTool = mcpTool(tool, mockClient);
      const result = await runnableTool.run({});

      expect(typeof result).toBe('string');
      expect(result).toBe(JSON.stringify(structuredData));
    });

    it('returns empty array when content is empty and no structuredContent', async () => {
      const tool: Tool = {
        name: 'empty_tool',
        description: 'Tool that returns nothing',
        inputSchema: { type: 'object' as const },
      };

      const mockClient: MCPClientLike = {
        callTool: async (): Promise<CallToolResult> => ({
          content: [],
        }),
      };

      const runnableTool = mcpTool(tool, mockClient);
      const result = await runnableTool.run({});

      expect(result).toEqual([]);
    });

    it('sends image tool result to API correctly', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const tool: Tool = {
        name: 'get_screenshot',
        inputSchema: { type: 'object' as const },
      };

      const imageData = Buffer.from('fake-png-data').toString('base64');
      const mockClient: MCPClientLike = {
        callTool: async () => ({
          content: [{ type: 'image', data: imageData, mimeType: 'image/png' }],
        }),
      };

      // Set up handlers for both requests BEFORE starting the runner
      let capturedToolResult: any;

      // First request returns tool_use
      handleRequest(async () => {
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'tool_456', name: 'get_screenshot', input: {} }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'tool_use',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Second request - capture the tool result
      handleRequest(async (_req, init) => {
        capturedToolResult = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_2',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'I see the screenshot.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 20, output_tokens: 10 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      const runner = anthropic.beta.messages.toolRunner({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Take a screenshot' }],
        tools: [mcpTool(tool, mockClient)],
      });

      // Consume the runner to trigger tool execution
      for await (const _message of runner) {
        // Just iterate to completion
      }

      const toolResultMessage = capturedToolResult.messages.find(
        (m: any) => m.role === 'user' && Array.isArray(m.content),
      );
      const toolResultBlock = toolResultMessage?.content?.find((c: any) => c.type === 'tool_result');

      expect(toolResultBlock).toMatchObject({
        type: 'tool_result',
        tool_use_id: 'tool_456',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              data: imageData,
              media_type: 'image/png',
            },
          },
        ],
      });
    });
  });

  describe('mcpMessage', () => {
    it('sends text message to API', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const textContent: TextContent = {
        type: 'text',
        text: 'Hello from MCP!',
      };

      const promptMessage: PromptMessage = {
        role: 'user',
        content: textContent,
      };

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [mcpMessage(promptMessage)],
      });

      expect(capturedBody.messages).toHaveLength(1);
      expect(capturedBody.messages[0]).toEqual({
        role: 'user',
        content: [{ type: 'text', text: 'Hello from MCP!' }],
      });
    });

    it('sends image message to API', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const imageContent: ImageContent = {
        type: 'image',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        mimeType: 'image/png',
      };

      const promptMessage: PromptMessage = {
        role: 'user',
        content: imageContent,
      };

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'I see an image.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [mcpMessage(promptMessage)],
      });

      expect(capturedBody.messages[0]).toEqual({
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              data: imageContent.data,
              media_type: 'image/png',
            },
          },
        ],
      });
    });

    it('sends message with cache_control to API', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const textContent: TextContent = {
        type: 'text',
        text: 'Cache this!',
      };

      const promptMessage: PromptMessage = {
        role: 'user',
        content: textContent,
      };

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Cached.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [mcpMessage(promptMessage, { cache_control: { type: 'ephemeral' } })],
      });

      expect(capturedBody.messages[0].content[0]).toMatchObject({
        type: 'text',
        text: 'Cache this!',
        cache_control: { type: 'ephemeral' },
      });
    });

    it('throws for unsupported image types', () => {
      const imageContent: ImageContent = {
        type: 'image',
        data: 'data',
        mimeType: 'image/bmp',
      };

      const promptMessage: PromptMessage = {
        role: 'user',
        content: imageContent,
      };

      try {
        mcpMessage(promptMessage);
        fail('Expected error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UnsupportedMCPValueError);
        expect((e as Error).message).toContain('image/bmp');
      }
    });
  });

  describe('mcpResourceToContent', () => {
    it('sends text resource as document to API', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const resource: TextResourceContents = {
        uri: 'file:///document.txt',
        mimeType: 'text/plain',
        text: 'Document contents here.',
      };

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'I read the document.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      const content = mcpResourceToContent({ contents: [resource] });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [content] }],
      });

      expect(capturedBody.messages[0].content[0]).toEqual({
        type: 'document',
        source: {
          type: 'text',
          data: 'Document contents here.',
          media_type: 'text/plain',
        },
      });
    });

    it('sends PDF resource as base64 document to API', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const pdfData = Buffer.from('fake-pdf-content').toString('base64');
      const resource: BlobResourceContents = {
        uri: 'file:///document.pdf',
        mimeType: 'application/pdf',
        blob: pdfData,
      };

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'I read the PDF.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      const content = mcpResourceToContent({ contents: [resource] });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [content] }],
      });

      expect(capturedBody.messages[0].content[0]).toEqual({
        type: 'document',
        source: {
          type: 'base64',
          data: pdfData,
          media_type: 'application/pdf',
        },
      });
    });

    it('sends image resource as image block to API', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const imageData = Buffer.from('fake-image-data').toString('base64');
      const resource: BlobResourceContents = {
        uri: 'file:///image.png',
        mimeType: 'image/png',
        blob: imageData,
      };

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'I see an image.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      const content = mcpResourceToContent({ contents: [resource] });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [content] }],
      });

      expect(capturedBody.messages[0].content[0]).toEqual({
        type: 'image',
        source: {
          type: 'base64',
          data: imageData,
          media_type: 'image/png',
        },
      });
    });

    it('sends resource with extra props to API', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const resource: TextResourceContents = {
        uri: 'file:///doc.txt',
        text: 'Content',
      };

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Done.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      const content = mcpResourceToContent(
        { contents: [resource] },
        { title: 'My Document', cache_control: { type: 'ephemeral' as const } },
      );

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [content] }],
      });

      expect(capturedBody.messages[0].content[0]).toMatchObject({
        type: 'document',
        title: 'My Document',
        cache_control: { type: 'ephemeral' },
      });
    });

    it('throws for unsupported blob resource types', () => {
      const resource: BlobResourceContents = {
        uri: 'file:///unknown.bin',
        mimeType: 'application/octet-stream',
        blob: 'binarydata',
      };

      try {
        mcpResourceToContent({ contents: [resource] });
        fail('Expected error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UnsupportedMCPValueError);
        expect((e as Error).message).toContain('application/octet-stream');
      }
    });

    it('decodes blob text resource with UTF-8 characters to document', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      // UTF-8 text with non-ASCII characters encoded to base64
      const utf8Text = 'Привет мир! 你好世界!';
      const base64 = Buffer.from(utf8Text, 'utf-8').toString('base64');

      const resource: BlobResourceContents = {
        uri: 'file:///unicode.txt',
        mimeType: 'text/plain',
        blob: base64,
      };

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Read it.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      const content = mcpResourceToContent({ contents: [resource] });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [content] }],
      });

      expect(capturedBody.messages[0].content[0]).toEqual({
        type: 'document',
        source: {
          type: 'text',
          data: utf8Text,
          media_type: 'text/plain',
        },
      });
    });
  });

  describe('mcpResourceToContent with multiple contents', () => {
    it('finds and converts the first supported resource', () => {
      const result = {
        contents: [
          { uri: 'file:///doc.bin', mimeType: 'application/octet-stream', blob: 'binary' },
          { uri: 'file:///doc.txt', mimeType: 'text/plain', text: 'Hello' },
          { uri: 'file:///doc.png', mimeType: 'image/png', blob: 'imagedata' },
        ],
      };

      const content = mcpResourceToContent(result);
      expect(content).toMatchObject({
        type: 'document',
        source: { type: 'text', data: 'Hello', media_type: 'text/plain' },
      });
    });

    it('throws UnsupportedMCPValueError when contents array is empty', () => {
      const result = { contents: [] };
      expect(() => mcpResourceToContent(result)).toThrow(UnsupportedMCPValueError);
      expect(() => mcpResourceToContent(result)).toThrow(
        'Resource contents array must contain at least one item',
      );
    });

    it('throws UnsupportedMCPValueError when no supported MIME type is found', () => {
      const result = {
        contents: [
          { uri: 'file:///doc.bin', mimeType: 'application/octet-stream', blob: 'binary' },
          { uri: 'file:///doc.xyz', mimeType: 'application/x-unknown', blob: 'data' },
        ],
      };

      expect(() => mcpResourceToContent(result)).toThrow(UnsupportedMCPValueError);
      expect(() => mcpResourceToContent(result)).toThrow('No supported MIME type found');
    });

    it('works with MCP SDK ReadResourceResult type', () => {
      const result: { contents: TextResourceContents[] } = {
        contents: [{ uri: 'file:///doc.txt', mimeType: 'text/plain', text: 'Content' }],
      };

      const content = mcpResourceToContent(result);
      expect(content).toHaveProperty('type', 'document');
    });
  });

  describe('mcpResourceToFile', () => {
    // These tests verify the File object properties which can be passed to anthropic.beta.files.upload()
    it('creates File from text resource with correct properties', async () => {
      const result: ReadResourceResult = {
        contents: [
          {
            uri: 'file:///path/to/document.txt',
            mimeType: 'text/plain',
            text: 'Hello, world!',
          },
        ],
      };

      const file = mcpResourceToFile(result);

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('document.txt');
      expect(file.type).toBe('text/plain');
      expect(await file.text()).toBe('Hello, world!');
    });

    it('creates File from blob resource with correct properties', async () => {
      const result: ReadResourceResult = {
        contents: [
          {
            uri: 'file:///path/to/image.png',
            mimeType: 'image/png',
            blob: Buffer.from('fake-image-data').toString('base64'),
          },
        ],
      };

      const file = mcpResourceToFile(result);

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('image.png');
      expect(file.type).toBe('image/png');
      const buffer = await file.arrayBuffer();
      expect(Buffer.from(buffer).toString()).toBe('fake-image-data');
    });

    it('extracts filename from URI path', () => {
      const result: ReadResourceResult = {
        contents: [
          {
            uri: 'https://example.com/path/to/my-file.pdf',
            text: 'data',
          },
        ],
      };

      const file = mcpResourceToFile(result);

      expect(file.name).toBe('my-file.pdf');
    });

    it('decodes base64 blob with UTF-8 characters correctly', async () => {
      // UTF-8 text with non-ASCII characters encoded to base64
      const utf8Text = 'Hello, 世界! 🌍 Ñoño';
      const base64 = Buffer.from(utf8Text, 'utf-8').toString('base64');

      const result: ReadResourceResult = {
        contents: [
          {
            uri: 'file:///utf8-doc.txt',
            mimeType: 'text/plain',
            blob: base64,
          },
        ],
      };

      const file = mcpResourceToFile(result);
      expect(await file.text()).toBe(utf8Text);
    });

    it('preserves binary data bytes exactly', async () => {
      // Binary data with all byte values 0-255
      const binaryData = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        binaryData[i] = i;
      }
      const base64 = Buffer.from(binaryData).toString('base64');

      const result: ReadResourceResult = {
        contents: [
          {
            uri: 'file:///binary.bin',
            mimeType: 'application/octet-stream',
            blob: base64,
          },
        ],
      };

      const file = mcpResourceToFile(result);
      const resultBytes = new Uint8Array(await file.arrayBuffer());

      expect(resultBytes.length).toBe(256);
      for (let i = 0; i < 256; i++) {
        expect(resultBytes[i]).toBe(i);
      }
    });

    it('throws UnsupportedMCPValueError when contents array is empty', () => {
      const result: ReadResourceResult = {
        contents: [],
      };

      expect(() => mcpResourceToFile(result)).toThrow(UnsupportedMCPValueError);
      expect(() => mcpResourceToFile(result)).toThrow(
        'Resource contents array must contain at least one item',
      );
    });
  });

  describe('type compatibility with MCP SDK', () => {
    it('mcpTool accepts MCP SDK Tool type directly', () => {
      const sdkTool: Tool = {
        name: 'sdk_tool',
        inputSchema: { type: 'object' as const },
      };

      const mockClient: MCPClientLike = {
        callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
      };

      // This should compile without errors - MCP SDK Tool is compatible with mcpTool
      const runnableTool = mcpTool(sdkTool, mockClient);
      expect(runnableTool.name).toBe('sdk_tool');
    });

    it('mcpMessage accepts MCP SDK PromptMessage type directly', () => {
      const textContent: TextContent = {
        type: 'text',
        text: 'Hello',
      };

      const sdkMessage: PromptMessage = {
        role: 'user',
        content: textContent,
      };

      // This should compile without errors - MCP SDK PromptMessage is compatible with mcpMessage
      const message = mcpMessage(sdkMessage);
      expect(message.role).toBe('user');
    });

    it('mcpContent accepts MCP SDK content types directly', () => {
      const textContent: TextContent = {
        type: 'text',
        text: 'Hello',
      };

      const imageContent: ImageContent = {
        type: 'image',
        data: 'base64data',
        mimeType: 'image/png',
      };

      // These should compile without errors - MCP SDK content types are compatible with mcpContent
      expect(mcpContent(textContent)).toHaveProperty('type', 'text');
      expect(mcpContent(imageContent)).toHaveProperty('type', 'image');
    });

    it('mcpResourceToContent accepts MCP SDK ReadResourceResult type directly', () => {
      const textResult: ReadResourceResult = {
        contents: [{ uri: 'file:///test.txt', text: 'content' }],
      };

      const blobResult: ReadResourceResult = {
        contents: [{ uri: 'file:///test.png', mimeType: 'image/png', blob: 'base64data' }],
      };

      // These should compile without errors - MCP SDK ReadResourceResult is compatible with mcpResourceToContent
      expect(mcpResourceToContent(textResult)).toHaveProperty('type', 'document');
      expect(mcpResourceToContent(blobResult)).toHaveProperty('type', 'image');
    });

    it('mcpResourceToFile accepts MCP SDK ReadResourceResult type directly', () => {
      const result: ReadResourceResult = {
        contents: [
          {
            uri: 'file:///test.txt',
            text: 'content',
          },
        ],
      };

      // This should compile without errors - MCP SDK result type is compatible with mcpResourceToFile
      const file = mcpResourceToFile(result);
      expect(file).toBeInstanceOf(File);
    });
  });

  describe('MCP client integration', () => {
    // Mock MCP Client that returns proper MCP SDK types
    function createMockMCPClient() {
      return {
        async getPrompt(params: { name: string }): Promise<{ messages: PromptMessage[] }> {
          if (params.name === 'image-prompt') {
            return {
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'image',
                    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                    mimeType: 'image/png',
                  },
                },
              ],
            };
          }
          throw new Error(`Unknown prompt: ${params.name}`);
        },
        async readResource(params: {
          uri: string;
        }): Promise<{ contents: (TextResourceContents | BlobResourceContents)[] }> {
          if (params.uri === 'file:///documents/readme.txt') {
            return {
              contents: [
                {
                  uri: params.uri,
                  mimeType: 'text/plain',
                  text: 'This is the document content from MCP.',
                },
              ],
            };
          }
          if (params.uri === 'file:///images/photo.png') {
            return {
              contents: [
                {
                  uri: params.uri,
                  mimeType: 'image/png',
                  blob: Buffer.from('fake-png-bytes').toString('base64'),
                },
              ],
            };
          }
          throw new Error(`Unknown resource: ${params.uri}`);
        },
      };
    }

    it('converts MCP prompt messages using mcpMessage()', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });
      const mcpClient = createMockMCPClient();

      // Get prompt from MCP client - returns MCP SDK types
      const { messages: mcpMessages } = await mcpClient.getPrompt({ name: 'image-prompt' });

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'I see an image.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Use mcpMessage() to convert MCP prompt message
      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: mcpMessages.map((m) => mcpMessage(m)),
      });

      // Should be converted to Anthropic format
      expect(capturedBody.messages[0]).toEqual({
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              media_type: 'image/png',
            },
          },
        ],
      });
    });

    it('converts MCP text resource using mcpResourceToContent()', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });
      const mcpClient = createMockMCPClient();

      // Read resource from MCP client - returns the full result object
      const result = await mcpClient.readResource({ uri: 'file:///documents/readme.txt' });

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'I read the document.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Use mcpResourceToContent() to convert MCP resource result
      const content = mcpResourceToContent(result);

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [content] }],
      });

      // Should be automatically converted to Anthropic document format
      expect(capturedBody.messages[0].content[0]).toEqual({
        type: 'document',
        source: {
          type: 'text',
          data: 'This is the document content from MCP.',
          media_type: 'text/plain',
        },
      });
    });

    it('converts MCP blob resource (image) using mcpResourceToContent()', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });
      const mcpClient = createMockMCPClient();

      // Read image resource from MCP client - returns the full result object
      const result = await mcpClient.readResource({ uri: 'file:///images/photo.png' });

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Nice photo.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Use mcpResourceToContent() to convert MCP resource result
      const content = mcpResourceToContent(result);

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [content] }],
      });

      // Should be converted to Anthropic image format
      expect(capturedBody.messages[0].content[0]).toEqual({
        type: 'image',
        source: {
          type: 'base64',
          data: Buffer.from('fake-png-bytes').toString('base64'),
          media_type: 'image/png',
        },
      });
    });

    // Skip: mockFetch doesn't work well with multipart form uploads
    it.skip('uploads MCP resource as file using mcpResourceToFile()', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });
      const mcpClient = createMockMCPClient();

      // Read resource from MCP client
      const resourceResult = await mcpClient.readResource({ uri: 'file:///documents/readme.txt' });

      handleRequest(async () => {
        return new Response(
          JSON.stringify({
            id: 'file_123',
            type: 'file',
            filename: 'readme.txt',
            size: 39,
            mime_type: 'text/plain',
            created_at: '2025-01-01T00:00:00Z',
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Convert MCP resource to File and upload
      const file = mcpResourceToFile(resourceResult);
      const result = await anthropic.beta.files.upload({ file });

      expect(result.id).toBe('file_123');
    });

    it('leaves Anthropic-native content unchanged', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      let capturedBody: any;
      handleRequest(async (_req, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });

      // Pass standard Anthropic message format
      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello from Anthropic format' }],
          },
        ],
      });

      // Should pass through unchanged
      expect(capturedBody.messages[0]).toEqual({
        role: 'user',
        content: [{ type: 'text', text: 'Hello from Anthropic format' }],
      });
    });
  });

  describe('SDK_HELPER_SYMBOL tracking', () => {
    describe('mcpTool and mcpTools', () => {
      it('mcpTool marks returned tool with symbol', () => {
        const tool: Tool = {
          name: 'test_tool',
          inputSchema: { type: 'object' as const },
        };

        const mockClient: MCPClientLike = {
          callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
        };

        const runnableTool = mcpTool(tool, mockClient);
        expect((runnableTool as any)[SDK_HELPER_SYMBOL]).toBe('mcpTool');
      });

      it('mcpTools marks each tool with symbol', () => {
        const tools: Tool[] = [
          { name: 'tool1', inputSchema: { type: 'object' as const } },
          { name: 'tool2', inputSchema: { type: 'object' as const } },
        ];

        const mockClient: MCPClientLike = {
          callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
        };

        const runnableTools = mcpTools(tools, mockClient);
        expect(runnableTools).toHaveLength(2);
        expect((runnableTools[0] as any)[SDK_HELPER_SYMBOL]).toBe('mcpTool');
        expect((runnableTools[1] as any)[SDK_HELPER_SYMBOL]).toBe('mcpTool');
      });
    });

    describe('mcpMessage and mcpMessages', () => {
      it('mcpMessage marks returned message with symbol', () => {
        const promptMessage: PromptMessage = {
          role: 'user',
          content: { type: 'text', text: 'hello' },
        };

        const message = mcpMessage(promptMessage);
        expect((message as any)[SDK_HELPER_SYMBOL]).toBe('mcpMessage');
      });

      it('mcpMessages marks each message with symbol', () => {
        const promptMessages: PromptMessage[] = [
          { role: 'user', content: { type: 'text', text: 'hello' } },
          { role: 'assistant', content: { type: 'text', text: 'hi' } },
        ];

        const messages = mcpMessages(promptMessages);
        expect(messages).toHaveLength(2);
        expect((messages[0] as any)[SDK_HELPER_SYMBOL]).toBe('mcpMessage');
        expect((messages[1] as any)[SDK_HELPER_SYMBOL]).toBe('mcpMessage');
      });
    });

    describe('mcpContent', () => {
      it('marks text content with symbol', () => {
        const textContent: TextContent = { type: 'text', text: 'hello' };
        const content = mcpContent(textContent);
        expect((content as any)[SDK_HELPER_SYMBOL]).toBe('mcpContent');
      });

      it('marks image content with symbol', () => {
        const imageContent: ImageContent = {
          type: 'image',
          data: 'base64data',
          mimeType: 'image/png',
        };
        const content = mcpContent(imageContent);
        expect((content as any)[SDK_HELPER_SYMBOL]).toBe('mcpContent');
      });
    });

    describe('mcpResourceToContent', () => {
      it('marks text resource content with symbol', () => {
        const resource: TextResourceContents = {
          uri: 'file:///test.txt',
          mimeType: 'text/plain',
          text: 'content',
        };
        const content = mcpResourceToContent({ contents: [resource] });
        expect((content as any)[SDK_HELPER_SYMBOL]).toBe('mcpResourceToContent');
      });

      it('marks image resource content with symbol', () => {
        const resource: BlobResourceContents = {
          uri: 'file:///image.png',
          mimeType: 'image/png',
          blob: 'base64data',
        };
        const content = mcpResourceToContent({ contents: [resource] });
        expect((content as any)[SDK_HELPER_SYMBOL]).toBe('mcpResourceToContent');
      });

      it('marks PDF resource content with symbol', () => {
        const resource: BlobResourceContents = {
          uri: 'file:///doc.pdf',
          mimeType: 'application/pdf',
          blob: 'base64data',
        };
        const content = mcpResourceToContent({ contents: [resource] });
        expect((content as any)[SDK_HELPER_SYMBOL]).toBe('mcpResourceToContent');
      });
    });

    describe('mcpResourceToFile', () => {
      it('marks file with symbol', () => {
        const result: ReadResourceResult = {
          contents: [
            {
              uri: 'file:///test.txt',
              mimeType: 'text/plain',
              text: 'content',
            },
          ],
        };
        const file = mcpResourceToFile(result);
        expect((file as any)[SDK_HELPER_SYMBOL]).toBe('mcpResourceToFile');
      });
    });

    describe('collectStainlessHelpers with MCP helpers', () => {
      it('collects single mcpTool', () => {
        const tool: Tool = {
          name: 'test',
          inputSchema: { type: 'object' as const },
        };
        const mockClient: MCPClientLike = {
          callTool: async () => ({ content: [] }),
        };
        const runnableTool = mcpTool(tool, mockClient);
        expect(collectStainlessHelpers([runnableTool], undefined)).toEqual(['mcpTool']);
      });

      it('collects and deduplicates array of mcpTools', () => {
        const tools: Tool[] = [
          { name: 'tool1', inputSchema: { type: 'object' as const } },
          { name: 'tool2', inputSchema: { type: 'object' as const } },
        ];
        const mockClient: MCPClientLike = {
          callTool: async () => ({ content: [] }),
        };
        const runnableTools = mcpTools(tools, mockClient);
        expect(collectStainlessHelpers(runnableTools, undefined)).toEqual(['mcpTool']);
      });

      it('collects mixed helpers from tools and messages', () => {
        const tool: Tool = {
          name: 'test',
          inputSchema: { type: 'object' as const },
        };
        const mockClient: MCPClientLike = {
          callTool: async () => ({ content: [] }),
        };
        const runnableTool = mcpTool(tool, mockClient);
        const message = mcpMessage({ role: 'user', content: { type: 'text', text: 'hi' } });

        const result = collectStainlessHelpers([runnableTool], [message]);
        // mcpMessage also includes mcpContent in its content array
        expect(result).toHaveLength(3);
        expect(result).toContain('mcpTool');
        expect(result).toContain('mcpMessage');
        expect(result).toContain('mcpContent');
      });

      it('scans nested message content', () => {
        const message = mcpMessage({ role: 'user', content: { type: 'text', text: 'hi' } });
        const result = collectStainlessHelpers(undefined, [message]);
        // Should find both mcpMessage and mcpContent
        expect(result).toContain('mcpMessage');
        expect(result).toContain('mcpContent');
      });

      it('returns empty array for non-marked objects', () => {
        const tools: BetaToolUnion[] = [{ name: 'tool', input_schema: { type: 'object' } }];
        const messages: BetaMessageParam[] = [{ role: 'user', content: 'hi' }];
        expect(collectStainlessHelpers(tools, undefined)).toEqual([]);
        expect(collectStainlessHelpers(undefined, messages)).toEqual([]);
      });

      it('returns empty array for empty input', () => {
        expect(collectStainlessHelpers(undefined, undefined)).toEqual([]);
        expect(collectStainlessHelpers([], [])).toEqual([]);
      });
    });

    describe('stainlessHelperHeader with MCP helpers', () => {
      it('returns correct header for mcpTools', () => {
        const tools: Tool[] = [
          { name: 'tool1', inputSchema: { type: 'object' as const } },
          { name: 'tool2', inputSchema: { type: 'object' as const } },
        ];
        const mockClient: MCPClientLike = {
          callTool: async () => ({ content: [] }),
        };
        const runnableTools = mcpTools(tools, mockClient);
        expect(stainlessHelperHeader(runnableTools, undefined)).toEqual({ 'x-stainless-helper': 'mcpTool' });
      });

      it('returns empty object for non-marked items', () => {
        const tools: BetaToolUnion[] = [{ name: 'tool', input_schema: { type: 'object' } }];
        expect(stainlessHelperHeader(tools, undefined)).toEqual({});
      });
    });
  });

  describe('messages.create() automatic helper header', () => {
    it('includes helper header when using mcpTools', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const tool: Tool = {
        name: 'test_tool',
        inputSchema: { type: 'object' as const },
      };

      const mockClient: MCPClientLike = {
        callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
      };

      let capturedHelperHeader: string | null = null;
      handleRequest(async (_req, init) => {
        const headers = init?.headers;
        if (headers instanceof Headers) {
          capturedHelperHeader = headers.get('x-stainless-helper');
        }
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [mcpTool(tool, mockClient)],
      });

      expect(capturedHelperHeader).toBe('mcpTool');
    });

    it('includes helper header when using mcpMessages', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const promptMessages: PromptMessage[] = [{ role: 'user', content: { type: 'text', text: 'Hello' } }];

      let capturedHelperHeader: string | null = null;
      handleRequest(async (_req, init) => {
        const headers = init?.headers;
        if (headers instanceof Headers) {
          capturedHelperHeader = headers.get('x-stainless-helper');
        }
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: mcpMessages(promptMessages),
      });

      // mcpMessages marks with 'mcpMessage', and content inside is marked with 'mcpContent'
      expect(capturedHelperHeader).toContain('mcpMessage');
      expect(capturedHelperHeader).toContain('mcpContent');
    });

    it('includes both tool and message helpers when using both', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      const tool: Tool = {
        name: 'test_tool',
        inputSchema: { type: 'object' as const },
      };

      const mockClient: MCPClientLike = {
        callTool: async () => ({ content: [] }),
      };

      const promptMessages: PromptMessage[] = [{ role: 'user', content: { type: 'text', text: 'Hello' } }];

      let capturedHelperHeader: string | null = null;
      handleRequest(async (_req, init) => {
        const headers = init?.headers;
        if (headers instanceof Headers) {
          capturedHelperHeader = headers.get('x-stainless-helper');
        }
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: mcpMessages(promptMessages),
        tools: [mcpTool(tool, mockClient)],
      });

      expect(capturedHelperHeader).toContain('mcpTool');
      expect(capturedHelperHeader).toContain('mcpMessage');
      expect(capturedHelperHeader).toContain('mcpContent');
    });

    it('does not include helper header when not using MCP helpers', async () => {
      const { fetch, handleRequest } = mockFetch();
      const anthropic = new Anthropic({ apiKey: 'test-key', fetch });

      let capturedHelperHeader: string | null = null;
      handleRequest(async (_req, init) => {
        const headers = init?.headers;
        if (headers instanceof Headers) {
          capturedHelperHeader = headers.get('x-stainless-helper');
        }
        return new Response(
          JSON.stringify({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
      });

      await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(capturedHelperHeader).toBeNull();
    });
  });
});
