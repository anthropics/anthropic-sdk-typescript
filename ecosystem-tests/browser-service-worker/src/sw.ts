// Service worker harness: when tests/browser.test.mjs posts it a message, runs the shared cases plus
// a tool runner against the mock API and posts the results back. Framework-free so the bundle is
// just the SDK.
//
// A service worker cannot load code after it is installed: import() is disallowed there and
// importScripts() only works during install. So a lazy import() the SDK reaches in one of these
// cases fails whenever the bundler kept it as a separate chunk (dist/esbuild-split, dist/webpack).
import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { equal, params, runCases } from '../shared/cases';

declare const self: ServiceWorkerGlobalScope;

const client = new Anthropic({ baseURL: __BASE_URL__, apiKey: __FAKE_API_KEY__ });

const extra = {
  'beta.messages.toolRunner runs a tool': async () => {
    const inputs: unknown[] = [];
    const getWeather = betaTool({
      name: 'get_weather',
      description: 'Get the weather in a city',
      inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
      run: (input) => {
        inputs.push(input);
        return 'Sunny';
      },
    });
    const message = await client.beta.messages.toolRunner({
      ...params,
      model: 'mock-tool',
      tools: [getWeather],
    });
    equal(inputs, [{ city: 'Paris' }]);
    equal(message.content, [{ type: 'text', text: 'Tool said: "Sunny"', citations: null }]);
  },
};

self.addEventListener('install', () => void self.skipWaiting());
self.addEventListener('message', (event) => {
  event.waitUntil(runCases(client, extra).then((results) => event.source?.postMessage(results)));
});
