// Auth internals are shared via symlink, not via package exports.
export * from './client';
export { AnthropicAws as default } from './client';
export type { AwsClientOptions } from './client';
