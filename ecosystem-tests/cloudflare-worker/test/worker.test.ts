import { exports } from 'cloudflare:workers';
import { expect, test } from 'vitest';

test('running inside workerd', () => {
  expect(navigator.userAgent).toBe('Cloudflare-Workers');
});

test('worker entrypoint streams a completion through the SDK', async () => {
  const response = await exports.default.fetch('http://worker.test/?prompt=Hi');
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('Hello from mock');
});
