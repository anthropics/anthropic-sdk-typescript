import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', { sourceMaps: 'inline' }],
  },
  moduleNameMapper: {
    '^@anthropic-ai/bedrock-sdk$': '<rootDir>/src/index.ts',
    '^@anthropic-ai/bedrock-sdk/(.*)$': '<rootDir>/src/$1',
    // Pin the core SDK to this package's copy: the aws-auth.ts symlink
    // resolves to its realpath in aws-sdk, which would otherwise load a
    // second copy of the SDK whose error classes fail instanceof checks.
    '^@anthropic-ai/sdk$': '<rootDir>/node_modules/@anthropic-ai/sdk',
    '^@anthropic-ai/sdk/(.*)$': '<rootDir>/node_modules/@anthropic-ai/sdk/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/deno/'],
  testPathIgnorePatterns: ['scripts'],
};

export default config;
