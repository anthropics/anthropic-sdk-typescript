import * as path from 'node:path';
import { isWithin, isWithinAnyCase } from '@anthropic-ai/sdk/tools/agent-toolset/fs-util';

const rules = vi.hoisted(() => ({ windows: true }));

vi.mock('@anthropic-ai/sdk/internal/node', async (original) => ({
  ...(await original<typeof import('@anthropic-ai/sdk/internal/node')>()),
  get path() {
    return rules.windows ? path.win32 : path.posix;
  },
}));

describe('with Windows path rules', () => {
  test.each([
    ['KELVIN SIGN for k', 'C:\\w\\k', 'C:\\w\\\u212a\\x'],
    ['I WITH DOT ABOVE for i and a combining dot', 'C:\\w\\i\u0307', 'C:\\w\\\u0130\\x'],
    ['K for k', 'C:\\w\\k', 'C:\\w\\K\\x'],
  ])('%s: only isWithinAnyCase counts the other directory as inside', (_, root, p) => {
    expect(isWithin(root, p)).toBe(false);
    expect(isWithinAnyCase(root, p)).toBe(true);
  });

  test.each([
    ['C:\\w', 'C:\\w', true],
    ['C:\\w', 'C:\\w\\x\\y', true],
    ['C:\\', 'C:\\w', true],
    ['\\\\host\\share\\', '\\\\host\\share\\w', true],
    ['C:\\w', 'C:\\w2', false],
    ['C:\\w', 'C:\\', false],
    ['C:\\w', 'D:\\w\\x', false],
    ['C:\\w', 'C:\\w\\..\\x', false],
    ['C:\\w\\', 'C:\\w', true],
    ['C:\\w\\.\\', 'C:/w/x', true],
  ])('isWithin(%j, %j) is %j', (root, p, expected) => {
    expect(isWithin(root, p)).toBe(expected);
    expect(isWithinAnyCase(root, p)).toBe(expected);
  });
});

describe('with POSIX path rules', () => {
  beforeAll(() => {
    rules.windows = false;
  });
  afterAll(() => {
    rules.windows = true;
  });

  test.each([
    ['/a', '/a/b', true],
    ['/a', '/a/../b', false],
    ['/a/', '/a', true],
    ['/a/./', '/a//b', true],
    ['/a', '/A/b', false],
  ])('isWithin(%j, %j) is %j', (root, p, expected) => {
    expect(isWithin(root, p)).toBe(expected);
    expect(isWithinAnyCase(root, p)).toBe(expected);
  });
});
