/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@anthropic-ai/sdk$': '<rootDir>/src/index.ts',
    '^@anthropic-ai/sdk/_shims/(.*)$': '<rootDir>/src/_shims/$1.node',
    '^@anthropic-ai/sdk/(.*)$': '<rootDir>/src/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/ecosystem-tests/', '<rootDir>/dist/', '<rootDir>/deno_tests/'],
};
