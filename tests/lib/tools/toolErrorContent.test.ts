import { describe, expect, test } from 'vitest';
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError';
import { toolErrorContent } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { EMPTY_ERROR_TEXT } from '@anthropic-ai/sdk/lib/internal/toolsets/sanitize';

/**
 * The API applies one contract to an `is_error` result whichever runner
 * produced it: text only, well-formed, bounded, and never empty. The toolset
 * runner enforced that; the function-tool runner passed a `ToolError`'s content
 * through raw, so the same failed call answered differently on the two paths.
 */
describe('a failed function tool answers like a failed toolset member', () => {
  test('an empty ToolError gets the placeholder rather than empty content', () => {
    expect(toolErrorContent(new ToolError(''))).toBe(EMPTY_ERROR_TEXT);
  });

  test('an image-only ToolError is reduced to the placeholder, since an is_error result takes text only', () => {
    const image = {
      type: 'image' as const,
      source: { type: 'base64' as const, data: 'AAAA', media_type: 'image/png' as const },
    };
    expect(toolErrorContent(new ToolError([image]))).toBe(EMPTY_ERROR_TEXT);
    // A text block alongside the image survives, with the image dropped.
    expect(toolErrorContent(new ToolError([{ type: 'text', text: 'refused' }, image]))).toEqual([
      { type: 'text', text: 'refused' },
    ]);
  });

  test('an overlong message is cut to the field limit, as the toolset runner cuts it', () => {
    const out = toolErrorContent(new Error('x'.repeat(5000)));
    expect(typeof out).toBe('string');
    expect((out as string).length).toBe(4096);
  });

  test('a lone surrogate is replaced, since it fails the request', () => {
    const out = toolErrorContent(new Error('bad \ud800 char')) as string;
    expect(out).not.toContain('\ud800');
    expect(out).toContain('�');
  });
});
