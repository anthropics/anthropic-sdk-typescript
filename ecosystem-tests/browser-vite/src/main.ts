// In-page harness: runs the shared cases plus a browser-only one against the mock API and reports
// to tests/browser.test.mjs through window.__results / body[data-done]. Framework-free so the
// bundle is just the SDK.
import Anthropic from '@anthropic-ai/sdk';
import { check, runCases, type Result } from '../shared/cases';

declare global {
  interface Window {
    __results?: Result[];
  }
}

const client = new Anthropic({ baseURL: __BASE_URL__, apiKey: __API_KEY__, dangerouslyAllowBrowser: true });

async function main() {
  const results = await runCases(client, {
    'constructing without dangerouslyAllowBrowser throws': async () => {
      let threw: unknown;
      try {
        new Anthropic({ baseURL: __BASE_URL__, apiKey: __API_KEY__ });
      } catch (e) {
        threw = e;
      }
      check(
        threw instanceof Anthropic.AnthropicError && /dangerouslyAllowBrowser/.test(threw.message),
        `expected an AnthropicError mentioning dangerouslyAllowBrowser, got ${String(threw)}`,
      );
    },
  });
  window.__results = results;
  document.body.append(JSON.stringify(results, null, 2));
  document.body.dataset['done'] = '1';
}
void main();
