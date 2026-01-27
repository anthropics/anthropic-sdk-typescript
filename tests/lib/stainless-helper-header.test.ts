import {
  SDK_HELPER_SYMBOL,
  collectStainlessHelpers,
  stainlessHelperHeader,
  stainlessHelperHeaderFromFile,
} from '../../src/lib/stainless-helper-header';
import type { BetaMessageParam, BetaToolUnion } from '@anthropic-ai/sdk/resources/beta';

type WithHelper<T> = T & { [SDK_HELPER_SYMBOL]: string };

describe('stainless-helpers', () => {
  describe('SDK_HELPER_SYMBOL', () => {
    it('is a symbol for anthropic.sdk.stainlessHelper', () => {
      expect(typeof SDK_HELPER_SYMBOL).toBe('symbol');
      expect(SDK_HELPER_SYMBOL.description).toBe('anthropic.sdk.stainlessHelper');
    });
  });

  describe('collectStainlessHelpers', () => {
    it('returns empty array for undefined tools and messages', () => {
      expect(collectStainlessHelpers(undefined, undefined)).toEqual([]);
    });

    it('returns empty array for empty arrays', () => {
      expect(collectStainlessHelpers([], [])).toEqual([]);
    });

    it('returns empty array for non-marked tools', () => {
      const tools: BetaToolUnion[] = [{ name: 'tool', input_schema: { type: 'object' } }];
      expect(collectStainlessHelpers(tools, undefined)).toEqual([]);
    });

    it('returns helper name for marked tool', () => {
      const tool: WithHelper<BetaToolUnion> = {
        name: 'test',
        input_schema: { type: 'object' },
        [SDK_HELPER_SYMBOL]: 'mcpTool',
      };
      expect(collectStainlessHelpers([tool], undefined)).toEqual(['mcpTool']);
    });

    it('returns deduplicated list for multiple marked tools', () => {
      const tools: WithHelper<BetaToolUnion>[] = [
        { name: 'tool1', input_schema: { type: 'object' }, [SDK_HELPER_SYMBOL]: 'mcpTool' },
        { name: 'tool2', input_schema: { type: 'object' }, [SDK_HELPER_SYMBOL]: 'mcpTool' },
      ];
      expect(collectStainlessHelpers(tools, undefined)).toEqual(['mcpTool']);
    });

    it('returns helper name for marked message', () => {
      const message: WithHelper<BetaMessageParam> = {
        role: 'user',
        content: 'hello',
        [SDK_HELPER_SYMBOL]: 'mcpMessage',
      };
      expect(collectStainlessHelpers(undefined, [message])).toEqual(['mcpMessage']);
    });

    it('scans message content arrays for helpers', () => {
      const contentBlock1 = { type: 'text' as const, text: 'hello', [SDK_HELPER_SYMBOL]: 'mcpContent' };
      const contentBlock2 = { type: 'text' as const, text: 'world', [SDK_HELPER_SYMBOL]: 'mcpContent' };
      const message = {
        role: 'user' as const,
        content: [contentBlock1, contentBlock2],
        [SDK_HELPER_SYMBOL]: 'mcpMessage',
      };
      const result = collectStainlessHelpers(undefined, [message]);
      expect(result).toHaveLength(2);
      expect(result).toContain('mcpMessage');
      expect(result).toContain('mcpContent');
    });

    it('collects helpers from both tools and messages', () => {
      const tool: WithHelper<BetaToolUnion> = {
        name: 'test',
        input_schema: { type: 'object' },
        [SDK_HELPER_SYMBOL]: 'mcpTool',
      };
      const message: WithHelper<BetaMessageParam> = {
        role: 'user',
        content: 'hi',
        [SDK_HELPER_SYMBOL]: 'mcpMessage',
      };
      const result = collectStainlessHelpers([tool], [message]);
      expect(result).toHaveLength(2);
      expect(result).toContain('mcpTool');
      expect(result).toContain('mcpMessage');
    });
  });

  describe('stainlessHelperHeader', () => {
    it('returns empty object for non-marked items', () => {
      const tools: BetaToolUnion[] = [{ name: 'tool', input_schema: { type: 'object' } }];
      const messages: BetaMessageParam[] = [{ role: 'user', content: 'hi' }];
      expect(stainlessHelperHeader(tools, undefined)).toEqual({});
      expect(stainlessHelperHeader(undefined, messages)).toEqual({});
    });

    it('returns header object for marked tools', () => {
      const tool: WithHelper<BetaToolUnion> = {
        name: 'test',
        input_schema: { type: 'object' },
        [SDK_HELPER_SYMBOL]: 'mcpTool',
      };
      expect(stainlessHelperHeader([tool], undefined)).toEqual({ 'x-stainless-helper': 'mcpTool' });
    });

    it('returns comma-separated header for multiple helpers', () => {
      const tool: WithHelper<BetaToolUnion> = {
        name: 'test',
        input_schema: { type: 'object' },
        [SDK_HELPER_SYMBOL]: 'mcpTool',
      };
      const message: WithHelper<BetaMessageParam> = {
        role: 'user',
        content: 'hi',
        [SDK_HELPER_SYMBOL]: 'mcpMessage',
      };
      const result = stainlessHelperHeader([tool], [message]);
      const helpers = result['x-stainless-helper']!.split(', ');
      expect(helpers).toHaveLength(2);
      expect(helpers).toContain('mcpTool');
      expect(helpers).toContain('mcpMessage');
    });

    it('deduplicates helper names in header', () => {
      const tools: WithHelper<BetaToolUnion>[] = [
        { name: 'tool1', input_schema: { type: 'object' }, [SDK_HELPER_SYMBOL]: 'mcpTool' },
        { name: 'tool2', input_schema: { type: 'object' }, [SDK_HELPER_SYMBOL]: 'mcpTool' },
      ];
      const result = stainlessHelperHeader(tools, undefined);
      expect(result['x-stainless-helper']).toBe('mcpTool');
    });
  });

  describe('stainlessHelperHeaderFromFile', () => {
    it('returns empty object for non-marked file', () => {
      const file = new File(['content'], 'test.txt');
      expect(stainlessHelperHeaderFromFile(file)).toEqual({});
    });

    it('returns empty object for null', () => {
      expect(stainlessHelperHeaderFromFile(null)).toEqual({});
    });

    it('returns empty object for undefined', () => {
      expect(stainlessHelperHeaderFromFile(undefined)).toEqual({});
    });

    it('returns header object for marked file', () => {
      const file = new File(['content'], 'test.txt') as File & { [SDK_HELPER_SYMBOL]: string };
      file[SDK_HELPER_SYMBOL] = 'mcpResourceToFile';
      expect(stainlessHelperHeaderFromFile(file)).toEqual({ 'x-stainless-helper': 'mcpResourceToFile' });
    });

    it('returns header object for marked object', () => {
      const obj = { [SDK_HELPER_SYMBOL]: 'testHelper' };
      expect(stainlessHelperHeaderFromFile(obj)).toEqual({ 'x-stainless-helper': 'testHelper' });
    });
  });
});
