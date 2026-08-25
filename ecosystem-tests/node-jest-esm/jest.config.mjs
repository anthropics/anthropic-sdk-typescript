/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  // nodenext relative imports name the .js output; point jest back at the .ts source
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};
