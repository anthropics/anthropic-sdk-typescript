import * as realToolset from '@anthropic-ai/sdk/tools/agent-toolset/node';
import * as stubToolset from '@anthropic-ai/sdk/tools/agent-toolset/node.browser';
import * as realMemory from '@anthropic-ai/sdk/tools/memory/node';
import * as stubMemory from '@anthropic-ai/sdk/tools/memory/node.browser';
import { AnthropicError } from '@anthropic-ai/sdk/core/error';

// The browser stubs are substituted for the Node-only modules via the
// `browser` field in package.json. They must export the same value surface as
// the real modules (so type-level and re-export usage is unaffected), and
// every Node-only value must throw a descriptive AnthropicError when used.

// ---- compile-time parity ---------------------------------------------------
// Each stub must be assignable to its real module's shape: same export names,
// same signatures. A direct `typeof real = stub` assignment is impossible —
// the real classes have nominal private members (`#proc` on BashSession,
// `private basePath` on BetaLocalFilesystemMemoryTool), which no second class
// can satisfy — so class exports are compared structurally instead: identical
// constructor parameters and the full public instance surface. Class statics
// are outside this mapped type; the runtime tests below cover them
// (`BetaLocalFilesystemMemoryTool.init`). Adding or changing an export in the
// real module breaks these assignments until the stub matches.

type PublicSurface<T> = { [K in keyof T]: T[K] };
type StubShapeOf<M> = {
  [K in keyof M]: M[K] extends abstract new (...args: infer P) => infer I ?
    abstract new (...args: P) => PublicSurface<I>
  : M[K];
};

const _toolsetTypeParity: StubShapeOf<typeof realToolset> = stubToolset;
const _memoryTypeParity: StubShapeOf<typeof realMemory> = stubMemory;
void _toolsetTypeParity;
void _memoryTypeParity;

describe('tools/agent-toolset/node.browser', () => {
  it('exports the same value surface as the real module', () => {
    expect(new Set(Object.keys(stubToolset))).toEqual(new Set(Object.keys(realToolset)));
  });

  it('throws a per-export AnthropicError', () => {
    const ctx = { workdir: '/tmp' };
    expect(() => stubToolset.betaAgentToolset20260401(ctx)).toThrow(AnthropicError);
    expect(() => stubToolset.betaAgentToolset20260401(ctx)).toThrow(
      'betaAgentToolset20260401 requires Node.js or a Node-compatible runtime',
    );
    expect(() => stubToolset.setupSkills(ctx)).toThrow('setupSkills requires Node.js');
    expect(() => stubToolset.betaBashTool(ctx)).toThrow('betaBashTool requires Node.js');
    expect(() => new stubToolset.BashSession('/tmp')).toThrow('BashSession requires Node.js');
  });
});

describe('tools/memory/node.browser', () => {
  it('exports the same value surface as the real module', () => {
    expect(new Set(Object.keys(stubMemory))).toEqual(new Set(Object.keys(realMemory)));
  });

  it('keeps the runtime-agnostic betaMemoryTool working', () => {
    expect(stubMemory.betaMemoryTool).toBe(realMemory.betaMemoryTool);
  });

  it('throws a descriptive AnthropicError for the filesystem tool', () => {
    expect(() => new stubMemory.BetaLocalFilesystemMemoryTool()).toThrow(
      'BetaLocalFilesystemMemoryTool requires Node.js or a Node-compatible runtime',
    );
    expect(() => stubMemory.BetaLocalFilesystemMemoryTool.init()).toThrow(
      'BetaLocalFilesystemMemoryTool.init requires Node.js or a Node-compatible runtime',
    );
  });
});
