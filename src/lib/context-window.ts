/**
 * Client-side helper for computing context-window utilization from a Messages
 * API response.
 *
 * Addresses the use case described in issue #1064 — `usage.input_tokens` alone
 * doesn't make under-utilization visible because the denominator (the model's
 * total context window) isn't returned alongside it. This helper provides that
 * denominator using a built-in lookup table of known model identifiers and a
 * computed utilization ratio that sums input + cache-read + cache-creation
 * tokens against the model's maximum.
 *
 * Usage:
 * ```ts
 *   const message = await client.messages.create({ ... });
 *   const { contextWindow, utilization } = getContextWindowUtilization({
 *     model: message.model,
 *     usage: message.usage,
 *   });
 *   // → { contextWindow: 200000, utilization: 0.146 }
 * ```
 *
 * The lookup can be extended or overridden for unknown / forthcoming models:
 * ```ts
 *   getContextWindowUtilization({
 *     model: 'my-internal-tuned-model',
 *     usage,
 *     contextWindowOverride: 500_000,
 *   });
 * ```
 */

/** Subset of `Usage` fields the helper consumes. Mirrors the shape returned
 * by `Messages` and `Beta.Messages` responses without taking a hard dependency
 * on the generated `Usage` type, so the helper stays compatible across SDK
 * regenerations. */
export interface ContextWindowUsage {
  input_tokens: number;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface ContextWindowUtilization {
  /** Total context window for the model, in tokens. */
  contextWindow: number;
  /** Ratio in `[0, 1]` of input-side tokens used vs. the model's context window. */
  utilization: number;
  /** Input + cache-read + cache-creation tokens that count against the input context budget. */
  inputBudgetUsed: number;
}

export interface GetContextWindowUtilizationOptions {
  model: string;
  usage: ContextWindowUsage;
  /**
   * Override for the model's context window in tokens. Required when the model
   * identifier isn't recognized; takes precedence over the built-in lookup.
   */
  contextWindowOverride?: number;
  /**
   * Custom lookup map merged on top of the built-in defaults. Useful for
   * forthcoming model identifiers, aliases, or proxied/tuned deployments.
   */
  modelContextWindows?: Readonly<Record<string, number>>;
}

/**
 * Built-in lookup of Claude model identifier → maximum context window in tokens.
 * Documented at https://docs.anthropic.com/en/docs/about-claude/models. Most
 * production Claude models share the 200_000-token window; opt-in 1M-token
 * extended contexts are not enabled by default and aren't reflected here.
 */
export const DEFAULT_MODEL_CONTEXT_WINDOWS: Readonly<Record<string, number>> = {
  // Claude 4.x family
  'claude-opus-4-8': 200_000,
  'claude-opus-4-7': 200_000,
  'claude-opus-4-6': 200_000,
  'claude-opus-4-5': 200_000,
  'claude-opus-4-5-20251101': 200_000,
  'claude-opus-4-1': 200_000,
  'claude-opus-4-1-20250805': 200_000,
  'claude-opus-4-0': 200_000,
  'claude-opus-4-20250514': 200_000,
  'claude-sonnet-4-6': 200_000,
  'claude-sonnet-4-5': 200_000,
  'claude-sonnet-4-5-20250929': 200_000,
  'claude-sonnet-4-0': 200_000,
  'claude-sonnet-4-20250514': 200_000,
  'claude-haiku-4-5': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
  // Preview / specialty
  'claude-mythos-preview': 200_000,
  'claude-mythos-5': 200_000,
  'claude-fable-5': 200_000,
  // Legacy
  'claude-3-haiku-20240307': 200_000,
};

/** Resolve a model identifier to its context window, consulting (in order)
 * the explicit override, the caller-supplied map, then the built-in defaults. */
export function getContextWindowForModel(
  model: string,
  options?: {
    contextWindowOverride?: number;
    modelContextWindows?: Readonly<Record<string, number>>;
  },
): number | undefined {
  if (options?.contextWindowOverride !== undefined) {
    return options.contextWindowOverride;
  }
  if (options?.modelContextWindows && model in options.modelContextWindows) {
    return options.modelContextWindows[model];
  }
  if (model in DEFAULT_MODEL_CONTEXT_WINDOWS) {
    return DEFAULT_MODEL_CONTEXT_WINDOWS[model];
  }
  return undefined;
}

/**
 * Compute the input-side context-window utilization for a Messages API
 * response. `utilization` is clamped to `[0, 1]` and the input budget includes
 * cache-creation and cache-read tokens since both count against the input
 * context (cache-read at a discount on cost, but the same physical bytes).
 *
 * @throws if the model isn't recognized and no `contextWindowOverride` was
 * provided. The thrown error names the unknown model so callers can extend
 * `modelContextWindows` or pass `contextWindowOverride`.
 */
export function getContextWindowUtilization(
  options: GetContextWindowUtilizationOptions,
): ContextWindowUtilization {
  const contextWindow = getContextWindowForModel(options.model, {
    contextWindowOverride: options.contextWindowOverride,
    modelContextWindows: options.modelContextWindows,
  });
  if (contextWindow === undefined) {
    throw new Error(
      `Unknown model "${options.model}" — pass \`contextWindowOverride\` or extend \`modelContextWindows\`.`,
    );
  }
  if (contextWindow <= 0) {
    throw new Error(
      `Invalid context window ${contextWindow} for model "${options.model}" — must be a positive integer.`,
    );
  }

  const inputBudgetUsed =
    options.usage.input_tokens +
    (options.usage.cache_creation_input_tokens ?? 0) +
    (options.usage.cache_read_input_tokens ?? 0);

  const utilization = Math.min(1, Math.max(0, inputBudgetUsed / contextWindow));

  return {
    contextWindow,
    inputBudgetUsed,
    utilization,
  };
}
