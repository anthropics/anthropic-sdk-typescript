# @opuz/anthropic-sdk

Enhanced Anthropic SDK with Opuz functionality. This package wraps the official [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) and adds Opuz and CheckBuilder functionalities.

## Installation

```bash
npm install @opuz/anthropic-sdk
# or
yarn add @opuz/anthropic-sdk
```

## Usage

### Basic Anthropic SDK Usage

You can use all the functionality from the official Anthropic SDK as normal:

```typescript
import { Anthropic } from '@opuz/anthropic-sdk';

const anthropic = new Anthropic({
  apiKey: 'your-api-key',
});

const message = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude!' }],
});
```

### Opuz and CheckBuilder

Additionally, you can use the Opuz and CheckBuilder functionality:

```typescript
import { Anthropic, Opuz, CheckBuilder } from '@opuz/anthropic-sdk';

// Initialize Opuz
const opuz = new Opuz();

// Create checks using CheckBuilder
const checks = new CheckBuilder()
  .contains('specific text')
  .minLength(10)
  .maxLength(100)
  .noToxicity()
  .noPII()
  .getChecks();

// Use with Anthropic and trace the response
const anthropic = new Anthropic({
  apiKey: 'your-anthropic-api-key',
});

const message = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude!' }],
});

// Trace the request and response with checks
await opuz.trace({
  request: { messages: [{ role: 'user', content: 'Hello, Claude!' }] },
  response: message,
  duration: 1000, // milliseconds
  checks: checks,
});
```

## Environment Variables

- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `OPUZ_API_KEY`: Your Opuz API key

## Features

- All features from the official Anthropic SDK
- Opuz tracing functionality
- CheckBuilder for creating validation checks:
  - Content validation (contains, min/max length, regex)
  - Safety checks (toxicity, PII)
  - Quality checks (sentiment, factual accuracy)
  - Performance checks (latency)
  - And more...

## License

MIT
