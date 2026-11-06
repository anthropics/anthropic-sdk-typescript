import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import type Anthropic from '@anthropic-ai/sdk';
import type { ClientOptions, ResolvedOpenTelemetryOptions } from '@anthropic-ai/sdk';
import { provider, makeClient, json, MESSAGE, PARAMS, spans, onlySpan, setUpTracing } from './utils';

setUpTracing();

const ENVIRONMENT_VARIABLES = [
  'ANTHROPIC_OPEN_TELEMETRY',
  'ANTHROPIC_OPEN_TELEMETRY_PROPAGATION',
  'ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE',
  'ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES',
];

const DEFAULT_TRACES = { enabled: true, contentMode: 'metadata_only', maxContentBytes: 750_000 } as const;

type Option = ClientOptions['openTelemetry'];

/** A tracer provider of the test's own, and the spans that it has finished. */
function ownProvider() {
  const ownExporter = new InMemorySpanExporter();
  const own = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(ownExporter)] });
  return { own, ownSpans: () => ownExporter.getFinishedSpans() };
}

describe('the openTelemetry client option', () => {
  afterEach(() => {
    for (const name of ENVIRONMENT_VARIABLES) {
      delete process.env[name];
    }
  });

  describe('client.openTelemetry', () => {
    test.each<[string, Option, ResolvedOpenTelemetryOptions['traces']]>([
      ['no option', undefined, DEFAULT_TRACES],
      ['an empty option', {}, DEFAULT_TRACES],
      ['false', false, { ...DEFAULT_TRACES, enabled: false }],
      ['traces: false', { traces: false }, { ...DEFAULT_TRACES, enabled: false }],
      ['traces: true', { traces: true }, DEFAULT_TRACES],
      ['an empty traces', { traces: {} }, DEFAULT_TRACES],
      [
        'every field of traces',
        { traces: { enabled: false, contentMode: 'content', maxContentBytes: 2_048 } },
        { enabled: false, contentMode: 'content', maxContentBytes: 2_048 },
      ],
    ])('has every field of traces settled, with %s', (_name, openTelemetry, expected) => {
      const { client } = makeClient([], { openTelemetry });

      expect(client.openTelemetry).toEqual({
        tracerProvider: undefined,
        propagation: true,
        traces: expected,
      });
    });

    test.each<[string, Option, string | undefined, boolean]>([
      ['no option', undefined, undefined, true],
      ['false', false, undefined, true],
      ['propagation: false', { propagation: false }, undefined, false],
      ['propagation: true', { propagation: true }, undefined, true],
      ['no option and the variable set to False', undefined, 'False', false],
      ['an option that leaves it unset and the variable set to false', { traces: true }, 'false', true],
      ['propagation: undefined and the variable set to false', { propagation: undefined }, 'false', true],
      ['propagation: true and the variable set to false', { propagation: true }, 'false', true],
      ['propagation: false and the variable set to true', { propagation: false }, 'true', false],
      ['no option and the variable set to something else', undefined, '0', true],
    ])('has propagation settled, with %s', (_name, openTelemetry, variable, expected) => {
      if (variable !== undefined) {
        process.env['ANTHROPIC_OPEN_TELEMETRY_PROPAGATION'] = variable;
      }
      const { client } = makeClient([], { openTelemetry });

      expect(client.openTelemetry.propagation).toBe(expected);
    });

    test('has the tracer provider of the option', () => {
      const { own } = ownProvider();
      const { client } = makeClient([], { openTelemetry: { tracerProvider: own } });

      expect(client.openTelemetry.tracerProvider).toBe(own);
    });

    test('is frozen, and so is its traces', () => {
      const { client } = makeClient([]);
      const resolved: { traces: { enabled: boolean } } = client.openTelemetry;

      expect(Object.isFrozen(resolved)).toBe(true);
      expect(() => {
        resolved.traces.enabled = false;
      }).toThrow(TypeError);
      expect(client.openTelemetry.traces.enabled).toBe(true);
    });

    test('does not share the object that the application passed', () => {
      const traces = { contentMode: 'content' as const };
      const { client } = makeClient([], { openTelemetry: { traces } });

      expect(Object.isFrozen(traces)).toBe(false);
      expect(client.openTelemetry.traces).not.toBe(traces);
    });

    test.each<[string, string, string, Partial<ResolvedOpenTelemetryOptions['traces']>]>([
      ['ANTHROPIC_OPEN_TELEMETRY', 'False', 'enabled', { enabled: false }],
      ['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE', 'CONTENT', 'contentMode', { contentMode: 'content' }],
      [
        'ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES',
        '4096',
        'maxContentBytes',
        { maxContentBytes: 4_096 },
      ],
    ])('%s=%s gives traces.%s of a client without the option', (name, value, _field, expected) => {
      process.env[name] = value;

      expect(makeClient([]).client.openTelemetry.traces).toEqual({ ...DEFAULT_TRACES, ...expected });
      expect(makeClient([], { openTelemetry: undefined }).client.openTelemetry.traces).toEqual({
        ...DEFAULT_TRACES,
        ...expected,
      });
    });

    test.each<[string, Option, Partial<ResolvedOpenTelemetryOptions['traces']>]>([
      ['an empty option', {}, {}],
      ['false', false, { enabled: false }],
      ['traces: false', { traces: false }, { enabled: false }],
      ['a tracer provider alone', { tracerProvider: ownProvider().own }, {}],
      ['an empty traces', { traces: {} }, {}],
      ['traces: true', { traces: true }, {}],
      ['a field of traces that is undefined', { traces: { enabled: undefined } }, {}],
      ['one field of traces', { traces: { maxContentBytes: 10 } }, { maxContentBytes: 10 }],
      [
        'every field of traces',
        { traces: { enabled: true, contentMode: 'metadata_only', maxContentBytes: 10 } },
        { maxContentBytes: 10 },
      ],
    ])('the environment variables do not reach a client with %s', (_name, openTelemetry, given) => {
      process.env['ANTHROPIC_OPEN_TELEMETRY'] = 'false';
      process.env['ANTHROPIC_OPEN_TELEMETRY_PROPAGATION'] = 'false';
      process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'] = 'content';
      process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES'] = '4096';
      const { client } = makeClient([], { openTelemetry });

      expect(client.openTelemetry.propagation).toBe(true);
      expect(client.openTelemetry.traces).toEqual({ ...DEFAULT_TRACES, ...given });
    });

    test.each(['0', '-1', '1.5', '1e3', '0x10', 'many', ' '])(
      'ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES=%j is ignored',
      (value) => {
        process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES'] = value;
        const { client } = makeClient([]);

        expect(client.openTelemetry.traces.maxContentBytes).toBe(750_000);
      },
    );

    test.each([0, -1, 1.5, NaN, Infinity])(
      'traces.maxContentBytes: %s is the default size',
      (maxContentBytes) => {
        process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES'] = '4096';
        const { client } = makeClient([], { openTelemetry: { traces: { maxContentBytes } } });

        expect(client.openTelemetry.traces.maxContentBytes).toBe(750_000);
      },
    );
  });

  describe('withOptions()', () => {
    test("a copy without its own option keeps the client's, and does not read the environment again", () => {
      process.env['ANTHROPIC_OPEN_TELEMETRY'] = 'false';
      process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'] = 'content';
      const { client } = makeClient([]);
      process.env['ANTHROPIC_OPEN_TELEMETRY'] = 'true';
      process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'] = 'metadata_only';
      process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES'] = '4096';

      const expected = {
        tracerProvider: undefined,
        propagation: true,
        traces: { ...DEFAULT_TRACES, enabled: false, contentMode: 'content' },
      };
      expect(client.withOptions({ timeout: 1000 }).openTelemetry).toEqual(expected);
      expect(client.withOptions({ openTelemetry: undefined }).openTelemetry).toEqual(expected);
    });

    test("a copy with its own option keeps no field of the client's", () => {
      const { own } = ownProvider();
      const { client } = makeClient([], {
        openTelemetry: {
          tracerProvider: own,
          traces: { enabled: false, contentMode: 'content', maxContentBytes: 10 },
        },
      });

      for (const openTelemetry of [{}, { traces: {} }, { traces: true }]) {
        expect(client.withOptions({ openTelemetry }).openTelemetry).toEqual({
          tracerProvider: undefined,
          propagation: true,
          traces: DEFAULT_TRACES,
        });
      }
      expect(
        client.withOptions({ openTelemetry: { traces: { contentMode: 'content' } } }).openTelemetry,
      ).toEqual({
        tracerProvider: undefined,
        propagation: true,
        traces: { ...DEFAULT_TRACES, contentMode: 'content' },
      });
    });

    test("a copy keeps the client's propagation, or takes its own option's and does not read the variable", () => {
      process.env['ANTHROPIC_OPEN_TELEMETRY_PROPAGATION'] = 'false';
      const { client } = makeClient([]);
      delete process.env['ANTHROPIC_OPEN_TELEMETRY_PROPAGATION'];

      expect(client.withOptions({ timeout: 1000 }).openTelemetry.propagation).toBe(false);

      process.env['ANTHROPIC_OPEN_TELEMETRY_PROPAGATION'] = 'false';
      expect(client.withOptions({ openTelemetry: {} }).openTelemetry.propagation).toBe(true);
      expect(client.withOptions({ openTelemetry: { propagation: true } }).openTelemetry.propagation).toBe(
        true,
      );
    });

    test('a copy with its own option does not read the environment', () => {
      const { client } = makeClient([], { openTelemetry: { traces: { contentMode: 'content' } } });
      process.env['ANTHROPIC_OPEN_TELEMETRY'] = 'false';
      process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE'] = 'content';
      process.env['ANTHROPIC_OPEN_TELEMETRY_TRACES_MAX_CONTENT_BYTES'] = '4096';

      const copy = client.withOptions({ openTelemetry: { traces: { maxContentBytes: 10 } } });

      expect(copy.openTelemetry.traces).toEqual({ ...DEFAULT_TRACES, maxContentBytes: 10 });
    });

    test.each<{
      name: string;
      client: (own: BasicTracerProvider) => Option;
      copy: (client: Anthropic) => Option;
      expected: 'own' | 'registered' | 'none';
    }>([
      {
        name: "without its own option emits its spans with the client's tracer provider",
        client: (own) => ({ tracerProvider: own }),
        copy: () => undefined,
        expected: 'own',
      },
      {
        name: 'with an option that has no tracer provider emits its spans with the registered one',
        client: (own) => ({ tracerProvider: own }),
        copy: () => ({ traces: { contentMode: 'content' } }),
        expected: 'registered',
      },
      {
        name: 'with its own tracer provider emits its spans with that',
        client: (own) => ({ tracerProvider: own }),
        copy: () => ({ tracerProvider: provider }),
        expected: 'registered',
      },
      {
        name: 'of a disabled client, with an empty option, emits spans',
        client: () => false,
        copy: () => ({}),
        expected: 'registered',
      },
      {
        name: 'enabled by traces: true does not keep the tracer provider',
        client: (own) => ({ tracerProvider: own, traces: false }),
        copy: () => ({ traces: true }),
        expected: 'registered',
      },
      {
        name: 'is disabled by false',
        client: (own) => ({ tracerProvider: own }),
        copy: () => false,
        expected: 'none',
      },
      {
        name: "with the client's settled option spread into its own keeps the tracer provider",
        client: (own) => ({ tracerProvider: own, traces: false }),
        copy: (client) => ({ ...client.openTelemetry, traces: true }),
        expected: 'own',
      },
    ])('a copy $name', async ({ client: option, copy, expected }) => {
      const { own, ownSpans } = ownProvider();
      const { client } = makeClient([json(MESSAGE)], { openTelemetry: option(own) });

      await client.withOptions({ openTelemetry: copy(client) }).messages.create(PARAMS);

      expect({ own: ownSpans().length, registered: spans().length }).toEqual({
        own: expected === 'own' ? 1 : 0,
        registered: expected === 'registered' ? 1 : 0,
      });
    });

    test("a copy that spreads the client's settled option changes one setting and keeps the others", async () => {
      const { own, ownSpans } = ownProvider();
      const { client } = makeClient([json(MESSAGE), json(MESSAGE)], {
        openTelemetry: { tracerProvider: own, propagation: false, traces: { maxContentBytes: 4_096 } },
      });
      const { openTelemetry } = client;

      const copy = client.withOptions({
        openTelemetry: { ...openTelemetry, traces: { ...openTelemetry.traces, contentMode: 'content' } },
      });

      expect(copy.openTelemetry).toEqual({
        tracerProvider: own,
        propagation: false,
        traces: { enabled: true, contentMode: 'content', maxContentBytes: 4_096 },
      });
      expect(client.openTelemetry.traces.contentMode).toBe('metadata_only');

      await client.messages.create(PARAMS);
      await copy.messages.create(PARAMS);

      expect(spans()).toHaveLength(0);
      expect(ownSpans().map((span) => span.attributes['gen_ai.input.messages'])).toEqual([
        undefined,
        expect.any(String),
      ]);
    });

    test('a copy of a copy that false disabled starts from the settled option of that copy', async () => {
      const { own } = ownProvider();
      const { client } = makeClient([json(MESSAGE)], {
        openTelemetry: { tracerProvider: own, traces: { contentMode: 'content' } },
      });

      const disabled = client.withOptions({ openTelemetry: false });
      await disabled.withOptions({ openTelemetry: { traces: true } }).messages.create(PARAMS);

      expect(disabled.openTelemetry).toEqual({
        tracerProvider: undefined,
        propagation: true,
        traces: { ...DEFAULT_TRACES, enabled: false },
      });
      expect(onlySpan('anthropic.messages.create').attributes['gen_ai.input.messages']).toBeUndefined();
    });
  });
});
