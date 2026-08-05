#!/usr/bin/env -S npm run tsn -T

import Anthropic, { type Middleware } from '@anthropic-ai/sdk';

// Middleware is portable across backends: on the Bedrock, Vertex, and Foundry
// clients it observes the same canonical Anthropic-shaped request (`model` and
// `stream` in the body, `anthropic-beta` as a header) and normalized SSE
// streaming responses, because backend URL/body rewriting, request signing,
// and response normalization all happen inside `next`.

/**
 * Logs every HTTP attempt the client makes, including the SDK's automatic
 * retries (each attempt passes through the middleware chain).
 */
const logger: Middleware = async (request, next) => {
  const retryCount = request.headers.get('x-stainless-retry-count');
  const start = Date.now();
  console.log(`-> ${request.method} ${request.url} (retry ${retryCount})`);
  const response = await next(request);
  console.log(`<- ${response.status} ${request.url} in ${Date.now() - start}ms`);
  return response;
};

/**
 * Adds a header to every outgoing request.
 */
const requestStamper: Middleware = (request, next) => {
  request.headers.set('x-my-app-request', crypto.randomUUID());
  return next(request);
};

/**
 * Observes the parsed response body without consuming it: `ctx.parse()` reads
 * through an internal clone, parses the way the SDK would, and caches the
 * result for any other middleware in the chain.
 */
const usageLogger: Middleware = async (request, next, ctx) => {
  const response = await next(request);
  const data = await ctx.parse<Anthropic.Message>(response);
  if (data?.type === 'message') {
    console.log(`usage: ${data.usage.input_tokens} in / ${data.usage.output_tokens} out`);
  }
  return response;
};

const client = new Anthropic({ middleware: [logger, requestStamper, usageLogger] });

async function main() {
  const message = await client.messages.create(
    {
      model: 'claude-opus-4-8',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hey Claude!?' }],
    },
    {
      // middleware can also be scoped to a single request; these run
      // after (inside) the client-level middleware above
      middleware: [
        async (request, next) => {
          const response = await next(request);
          console.log(`request-id: ${response.headers.get('request-id')}`);
          return response;
        },
      ],
    },
  );
  console.dir(message, { depth: 4 });
}

main();
