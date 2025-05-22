// File containing shared constants

/**
 * Model-specific timeout constraints for non-streaming requests
 */
export const MODEL_NONSTREAMING_TOKENS: Record<string, number> = {
  'claude-opus-4-20250514': 8192,
  'claude-opus-4-0': 8192,
  'claude-4-opus-20250514': 8192,
  'anthropic.claude-opus-4-20250514-v1:0': 8192,
  'claude-opus-4@20250514': 8192,
};
