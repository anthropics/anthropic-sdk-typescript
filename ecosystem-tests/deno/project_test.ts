import Anthropic from '@anthropic-ai/sdk';
import { Messages } from '@anthropic-ai/sdk/resources/messages';
import { check, equal } from './shared/cases.ts';

Deno.test('running under Deno, subpath export shares the root module instance', () => {
  equal(typeof Deno.version.deno, 'string');
  check(new Anthropic().messages instanceof Messages, 'subpath export resolved to a second module instance');
});
