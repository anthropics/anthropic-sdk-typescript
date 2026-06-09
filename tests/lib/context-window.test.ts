import {
  DEFAULT_MODEL_CONTEXT_WINDOWS,
  getContextWindowForModel,
  getContextWindowUtilization,
} from '../../src/lib/context-window';

describe('context-window helper', () => {
  describe('getContextWindowForModel', () => {
    it('returns the built-in value for known models', () => {
      expect(getContextWindowForModel('claude-opus-4-5')).toBe(200_000);
      expect(getContextWindowForModel('claude-haiku-4-5-20251001')).toBe(200_000);
    });

    it('returns undefined for unknown models without an override', () => {
      expect(getContextWindowForModel('some-other-model')).toBeUndefined();
    });

    it('honours an explicit override over the built-ins', () => {
      expect(
        getContextWindowForModel('claude-opus-4-5', { contextWindowOverride: 1_000_000 }),
      ).toBe(1_000_000);
    });

    it('consults the caller-supplied map before falling through to defaults', () => {
      expect(
        getContextWindowForModel('my-tuned-deployment', {
          modelContextWindows: { 'my-tuned-deployment': 50_000 },
        }),
      ).toBe(50_000);
    });
  });

  describe('getContextWindowUtilization', () => {
    it('computes utilization for plain input + output tokens', () => {
      const result = getContextWindowUtilization({
        model: 'claude-opus-4-5',
        usage: { input_tokens: 28_000, output_tokens: 1_200 },
      });
      expect(result.contextWindow).toBe(200_000);
      expect(result.inputBudgetUsed).toBe(28_000);
      expect(result.utilization).toBeCloseTo(0.14, 4);
    });

    it('counts cache-creation and cache-read tokens against the input budget', () => {
      const result = getContextWindowUtilization({
        model: 'claude-sonnet-4-5',
        usage: {
          input_tokens: 28_000,
          output_tokens: 1_200,
          cache_creation_input_tokens: 1_800,
          cache_read_input_tokens: 600,
        },
      });
      expect(result.inputBudgetUsed).toBe(30_400);
      expect(result.utilization).toBeCloseTo(30_400 / 200_000, 6);
    });

    it('treats null cache fields the same as absent fields', () => {
      const result = getContextWindowUtilization({
        model: 'claude-opus-4-5',
        usage: {
          input_tokens: 1_000,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
        },
      });
      expect(result.inputBudgetUsed).toBe(1_000);
    });

    it('clamps utilization to 1 when the input budget exceeds the window', () => {
      const result = getContextWindowUtilization({
        model: 'claude-opus-4-5',
        usage: { input_tokens: 250_000 },
      });
      expect(result.utilization).toBe(1);
    });

    it('throws a model-naming error for unknown models without an override', () => {
      expect(() =>
        getContextWindowUtilization({
          model: 'some-other-model',
          usage: { input_tokens: 100 },
        }),
      ).toThrow(/some-other-model/);
    });

    it('accepts a contextWindowOverride for unknown models', () => {
      const result = getContextWindowUtilization({
        model: 'my-tuned-model',
        usage: { input_tokens: 25_000 },
        contextWindowOverride: 100_000,
      });
      expect(result.contextWindow).toBe(100_000);
      expect(result.utilization).toBeCloseTo(0.25, 4);
    });

    it('rejects a non-positive contextWindowOverride', () => {
      expect(() =>
        getContextWindowUtilization({
          model: 'claude-opus-4-5',
          usage: { input_tokens: 100 },
          contextWindowOverride: 0,
        }),
      ).toThrow(/Invalid context window/);
    });
  });

  describe('DEFAULT_MODEL_CONTEXT_WINDOWS', () => {
    it('covers the documented Claude 4.x family', () => {
      for (const model of [
        'claude-opus-4-5',
        'claude-opus-4-1',
        'claude-sonnet-4-5',
        'claude-haiku-4-5',
      ]) {
        expect(DEFAULT_MODEL_CONTEXT_WINDOWS[model]).toBe(200_000);
      }
    });
  });
});
