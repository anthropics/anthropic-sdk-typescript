module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'unused-imports', 'prettier'],
  rules: {
    'no-unused-vars': 'off',
    'prettier/prettier': 'error',
    'unused-imports/no-unused-imports': 'error',
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@anthropic-ai/sdk', '@anthropic-ai/sdk/*'],
            message: 'Use a relative import, not a package import.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['tests/**', 'examples/**'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
  root: true,
};
