import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', { sourceMaps: 'inline' }],
  },
  moduleNameMapper: {
    '^@anthropic-ai/vertex-sdk$': '<rootDir>/src/index.ts',
    '^@anthropic-ai/vertex-sdk/(.*)$': '<rootDir>/src/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/deno/', '<rootDir>/deno_tests/'],
  testPathIgnorePatterns: ['scripts'],
};

export default config;
