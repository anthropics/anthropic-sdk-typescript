import { describe, it, expect } from 'vitest';

/**
 * Isolated unit tests for Anthropic SDK API Key / Bearer Token whitespace trimming.
 */

function sanitizeAuthHeader(apiKey: string | undefined | null): string {
  if (!apiKey) return '';
  return apiKey.trim();
}

describe('Auth Header Sanitization', () => {
  it('should trim leading and trailing whitespace from API keys', () => {
    expect(sanitizeAuthHeader('  sk-ant-api03-test-token  ')).toBe('sk-ant-api03-test-token');
  });

  it('should handle newline and tab characters in environment variable strings', () => {
    expect(sanitizeAuthHeader('\tsk-ant-api03-test\n')).toBe('sk-ant-api03-test');
  });

  it('should return empty string on null or undefined', () => {
    expect(sanitizeAuthHeader(undefined)).toBe('');
    expect(sanitizeAuthHeader(null)).toBe('');
  });
});
