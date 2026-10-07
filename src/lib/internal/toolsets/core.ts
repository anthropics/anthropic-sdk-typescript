/**
 * Shared building blocks for each toolset family's class.
 *
 * @internal
 */
import { APIUserAbortError } from '../../../core/error';
import type { Promisable } from '../../tools/BetaRunnableTool';
import type { ToolsetFamily } from './family';
import { throwIfPropagates } from './run';
import { ToolError } from '../../tools/ToolError';
import {
  ConfirmDeclinedError,
  ConfirmFailedError,
  DisabledMemberError,
  ToolsetConfigError,
  UnavailableMemberError,
  UnknownMemberError,
} from './errors';
import type { BetaToolConfigs, BetaToolsetCallContext } from './hooks';
import { FIELD_MAX, cutPoints, errorTextContent } from './sanitize';
import type { BetaBase64ImageSource, BetaTextBlockParam } from '../../../resources/beta';

// --- results ---------------------------------------------------------------------------------------------

/** A screenshot or zoom image from either toolset, rendered as one image block. */
export interface BetaScreenshotResult {
  /** Base64 image bytes, without a `data:` prefix. */
  data: string;
  /** Defaults to `'image/png'`. */
  mediaType?: BetaBase64ImageSource['media_type'] | undefined;
}

// --- the member registry ---------------------------------------------------------------------------------

/**
 * The kinds of value a member hands back, each rendered by `render.ts`. `point` is a cursor position. `none` is a
 * pure action, rendered from its confirmation template and then the line it returned, if any.
 */
export type ResultKind = 'navigate' | 'screenshot' | 'text' | 'tab' | 'tabs' | 'point' | 'none';

/**
 * One member of a toolset: what the generated types do not carry about it, kept by hand in the family's registry.
 * `Kind` is the result kinds the family's rows use.
 */
export interface ToolsetMember<Name extends string = string, Kind extends ResultKind = ResultKind> {
  readonly name: Name;
  readonly result: Kind;
  /**
   * The confirmation the model reads after a pure action, with the placeholders `render.ts` knows (`{text}`,
   * `{duration}`, …; `{ref}` reads `target.ref`) filled from the input. A line the action returned follows it.
   */
  readonly text?: string;
  readonly enabledByDefault: boolean;
}

/**
 * A registry row as a family writes it: result kind, confirmation template, default-enabled flag. A family writes its
 * rows `as const`, so each member's result kind is a literal the result types below can read.
 */
export type MemberRow = readonly [ResultKind, string | null, boolean];

/** The declared result type (`Results[K]`) of every member whose row in `Rows` gives result kind `R`. */
export type KindResultOf<
  Name extends string,
  Rows extends { readonly [K in Name]: MemberRow },
  Results extends { readonly [K in Name]: unknown },
  R extends ResultKind,
> = { [K in Name]: Rows[K][0] extends R ? Results[K] : never }[Name];

/**
 * A member's result with its result kind, which says how to read it: for each kind `R` the family uses, `value` is
 * what that family's members of that kind declare. A family exports its own instantiation and a `typedResult` that
 * builds one, the one place the driver's declared result type is taken at its word.
 */
export type TypedResultOf<
  Name extends string,
  Rows extends { readonly [K in Name]: MemberRow },
  Results extends { readonly [K in Name]: unknown },
  R extends ResultKind = Rows[Name][0],
> = { [P in R]: { readonly kind: P; readonly value: KindResultOf<Name, Rows, Results, P> } }[R];

/** The member table from a family's rows, in the order of `names`. */
export function buildMembers<Name extends string, Rows extends { readonly [K in Name]: MemberRow }>(
  names: readonly Name[],
  rows: Rows,
): ReadonlyMap<Name, ToolsetMember<Name, Rows[Name][0]>> {
  return new Map(
    names.map((name) => {
      const [result, text, enabledByDefault] = rows[name];
      return [name, { name, result, ...(text !== null ? { text } : {}), enabledByDefault }];
    }),
  );
}

/** A family's member registry, as the parts of a toolset class shared by every family read it. */
export interface Registry<Name extends string, M extends ToolsetMember<Name> = ToolsetMember<Name>> {
  /** The family stamped on member blocks, matched against `tool_use.toolset_name`. */
  readonly family: ToolsetFamily;
  /** Every member name, in canonical order. */
  readonly names: readonly Name[];
  readonly members: ReadonlyMap<Name, M>;
  /** Members the API withholds unless `configs` enables them. */
  readonly defaultDisabled: ReadonlySet<string>;
}

/** The registry row for a model-supplied name, or undefined when it names no member. */
export function memberOf<Name extends string, M extends ToolsetMember<Name>>(
  registry: Registry<Name, M>,
  name: string,
): M | undefined {
  return registry.members.get(name as Name);
}

/** A wire entry's `configs` (any generated `*ToolsetConfigs`), read as `{ [member]: { enabled? } }`. */
export type MemberConfigs = object | undefined;

/**
 * Whether `configs` leave `name` enabled, failing closed when the answer is unclear.
 *
 * Only a real boolean `enabled` turns a member on or off. Any other value fails closed, so a malformed
 * entry (a `"false"` string that came through JSON or an environment variable) can never turn on a
 * member that is off by default.
 */
export function isEnabled(
  name: string,
  configs: MemberConfigs,
  defaultDisabled: ReadonlySet<string>,
): boolean {
  // Own properties only: `in` would walk the prototype chain, so a member named `constructor` would find an entry.
  const entry =
    configs != null && Object.prototype.hasOwnProperty.call(configs, name) ?
      (configs as Record<string, { enabled?: boolean | null } | null | undefined>)[name]
    : undefined;

  // an entry that is neither an object nor null (`{ navigate: false }`) reads as off, not as the member's default
  if (entry != null && typeof entry !== 'object') return false;

  const enabled = entry?.enabled;
  if (enabled === true) return true;
  if (enabled !== undefined && enabled !== null) return false;
  return !defaultDisabled.has(name);
}

// --- constructor options -----------------------------------------------------------------------------------

/** The constructor options every family takes; a family's own options type adds to them. */
export interface ToolsetOptions<Configs extends object, Confirm> {
  configs?: Configs | undefined;
  confirm?: Confirm | undefined;
  toolConfigs?: BetaToolConfigs | undefined;
}

/** What the dispatch gate reads: the wire configs, and which members the class serves and the caller configured. */
export interface ServedMembers {
  /** What `toJSON` sends: the caller's `configs` plus `enabled: false` for every member the subclass does not serve. */
  readonly wireConfigs: MemberConfigs;
  /** The members a sampled call may reach: the implemented ones, or all of them for an execute-only subclass. */
  readonly served: ReadonlySet<string>;
  /** Members the caller's own `configs` mention. */
  readonly configured: ReadonlySet<string>;
}

/** The shared constructor options, validated and resolved once at construction. */
export interface ResolvedToolsetOptions<Configs extends object, Confirm> extends ServedMembers {
  readonly wireConfigs: Configs | undefined;
  readonly confirm: Confirm | undefined;
  /** Spread onto the `tools[]` entry `toJSON` returns: your `toolConfigs`, copied and frozen at construction. */
  readonly toolConfigs: BetaToolConfigs | undefined;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/** The prototype property a member's method is defined under (`type` is `type_`). */
function methodKey(name: string): string {
  return name === 'type' ? 'type_' : name;
}

/** Whether `instance`'s class chain overrides `key` before reaching `base`, by own-property lookup. Nothing is called. */
export function overrides(instance: object, base: object, key: string): boolean {
  let proto: object | null = Object.getPrototypeOf(instance);
  while (proto !== null && proto !== base) {
    if (Object.prototype.hasOwnProperty.call(proto, key)) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

function wireConfigs<Configs extends object>(
  names: readonly string[],
  configs: Configs | undefined,
  served: ReadonlySet<string>,
): Configs | undefined {
  // The copy is what is both checked and sent, so whatever `configs` holds that JSON drops (an entry on a
  // prototype, a non-enumerable one) can neither pass the check nor reach the wire: the member stays at its default.
  const wire: Record<string, Record<string, unknown>> = JSON.parse(JSON.stringify(configs ?? {}));

  const unserved = names.filter((name) => !served.has(name) && wire[name]?.['enabled'] === true);
  if (unserved.length) {
    // Offering the model a member that can only ever answer "not available" is a configuration mistake:
    // implement the method (a subclass that overrides execute alone serves every member).
    throw new ToolsetConfigError(
      `configs enables member(s) this toolset does not implement: ${JSON.stringify(unserved.sort())} ` +
        '(override the member method; a subclass that overrides only execute() serves every member)',
    );
  }

  for (const name of names) {
    if (served.has(name)) continue;
    wire[name] = { ...wire[name], enabled: false };
  }

  // Frozen: this object is what the dispatch gate reads and what toJSON() copies, and the runner snapshots the wire
  // entry when it is created. A later mutation would let the gate accept a member the API was told is off.
  return Object.keys(wire).length ? (deepFreeze(wire) as Configs) : undefined;
}

/**
 * Check and resolve the options every family shares, once, at construction. A family checks its own options in its
 * own class.
 */
export function resolveToolsetOptions<
  Configs extends object,
  Confirm extends (ctx: never) => Promisable<boolean>,
>(
  registry: Registry<string>,
  instance: object,
  base: object,
  options: ToolsetOptions<Configs, Confirm>,
): ResolvedToolsetOptions<Configs, Confirm> {
  // a class that overrides execute serves every member, whether or not it also implements member methods
  const served = new Set<string>(
    overrides(instance, base, 'execute') ?
      registry.names
    : registry.names.filter((name) => overrides(instance, base, methodKey(name))),
  );
  const wire = wireConfigs(registry.names, options.configs, served);
  const confirm = options.confirm;
  // Copied once and frozen, like the wire configs: a later change to the object you passed never reaches a request.
  const toolConfigs: BetaToolConfigs | undefined =
    options.toolConfigs === undefined ?
      undefined
    : deepFreeze(JSON.parse(JSON.stringify(options.toolConfigs)));
  if (toolConfigs != null && 'configs' in toolConfigs) {
    // refused rather than left to silently replace, or be replaced by, what the `configs` option writes there
    throw new ToolsetConfigError(
      'toolConfigs sets "configs", which the toolset writes itself: pass member settings as the configs option',
    );
  }
  return {
    wireConfigs: wire,
    served,
    configured: new Set(Object.keys(options.configs ?? {})),
    confirm,
    toolConfigs,
  };
}

// --- a call's stages ---------------------------------------------------------------------------------------

/** One member call in flight: what each stage produced, for the stages after it. `Result` is the family's typed result. */
export class MemberCall<M extends ToolsetMember = ToolsetMember, Input = unknown, Result = unknown> {
  member: M | undefined = undefined;
  input: Input | undefined = undefined;
  result: Result | undefined = undefined;
  error: ToolError | undefined = undefined;

  constructor(
    readonly ctx: BetaToolsetCallContext,
    readonly name: string,
    readonly rawInput: unknown,
  ) {}

  get toolUseId(): string | undefined {
    return this.ctx.toolUse?.id;
  }
}

/**
 * Stage one of a call: the registry row for `name`, or the refusal the model reads (an unknown name, a
 * member this application disabled, or one the driver does not implement).
 */
export function resolveMember<Name extends string, M extends ToolsetMember<Name>>(
  registry: Registry<Name, M>,
  options: ServedMembers,
  name: string,
): M {
  const member = memberOf(registry, name);
  if (member === undefined) throw new UnknownMemberError(name, registry.family);
  if (!isEnabled(member.name, options.wireConfigs, registry.defaultDisabled)) {
    if (!options.served.has(member.name) && !options.configured.has(member.name)) {
      throw new UnavailableMemberError(member.name, registry.family);
    }
    throw new DisabledMemberError(member.name);
  }
  return member;
}

/**
 * `execute`'s default body: the member's method on `instance`, resolved through the registry rather than by property
 * name, since `instance[name]` on raw model output would reach `constructor`, `toString` or any other property.
 */
export async function dispatchMember<Name extends string>(
  registry: Registry<Name>,
  instance: object,
  ctx: BetaToolsetCallContext,
  name: Name,
  input: unknown,
): Promise<unknown> {
  if (registry.members.get(name) === undefined) throw new UnknownMemberError(name, registry.family);
  const method = (instance as unknown as Record<string, (c: BetaToolsetCallContext, i: unknown) => unknown>)[
    methodKey(name)
  ]!;
  return await method.call(instance, ctx, input);
}

/**
 * The text blocks of a `ToolError`'s content: an is_error result may hold text only (`errorTextContent`). An empty one
 * still signals that the call failed.
 */
export function errorContent(error: ToolError): BetaTextBlockParam[] {
  const content = errorTextContent(error.content);
  if (typeof content === 'string') return content === '' ? [] : [{ type: 'text', text: content }];
  return content;
}

/**
 * `error` with each text block run through `check` and then bounded to the field limit. The same object when nothing
 * changed. The bound comes after the check: a driver's exception can embed a page-sized payload, and cutting first
 * would let a page place a path across the cut where the check reads a shorter one.
 */
export async function checkedError(
  error: ToolError,
  check: (text: string) => Promisable<string> = (text) => text,
): Promise<ToolError> {
  const content = errorContent(error);
  const checked = await Promise.all(
    content.map(async (block) => ({ ...block, text: cutPoints(await check(block.text), FIELD_MAX) })),
  );
  if (checked.every((block, i) => block.text === content[i]!.text)) return error;
  return new ToolError(checked);
}

/**
 * Ask `confirm` about the call awaiting approval: returns when it approved, throws the refusal the model reads
 * otherwise. A `ToolError` it throws is relayed as-is. Any other exception means the prompt failed, and refuses the
 * call rather than ending the run. Anything but `true` declines the call.
 */
export async function confirmOrThrow<Context>(
  confirm: (ctx: Context) => Promisable<boolean>,
  ctx: Context,
  call: MemberCall,
): Promise<void> {
  const name = call.member!.name;

  let returned: unknown;
  try {
    returned = await confirm(ctx);
  } catch (error) {
    throwIfPropagates(error, call.ctx);
    if (error instanceof ToolError) throw error;
    throw new ConfirmFailedError(name);
  }

  if (returned !== true) throw new ConfirmDeclinedError(name);
}

// --- one call at a time ------------------------------------------------------------------------------------

/** The queue every top-level call of one toolset chains behind: calls run one at a time, in arrival order. */
export class CallQueue {
  #chain: Promise<void> = Promise.resolve();

  /** Run `turn` once the calls ahead of it have settled; a call whose `signal` aborts meanwhile leaves the queue at once. */
  enqueue<T>(signal: AbortSignal | null | undefined, turn: () => Promise<T>): Promise<T> {
    const previous = this.#chain;
    let ready: Promise<unknown> = previous;
    let onAbort = (): void => undefined;

    if (signal) {
      // A queued call whose run is aborted leaves the queue at once rather than when its turn comes.
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(new APIUserAbortError());
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      });
      aborted.catch(() => undefined);
      ready = Promise.race([previous, aborted]);
    }

    const run = ready.then(turn);
    if (signal) {
      // The listener goes when the call settles, so a long-lived signal shared by many calls does not collect one each.
      run.finally(() => signal.removeEventListener('abort', onAbort)).catch(() => undefined);
    }

    // The queue still waits for the call ahead even when this one gave up waiting for it, and a failed call does not
    // break it.
    this.#chain = Promise.allSettled([previous, run]).then(() => undefined);
    return run;
  }

  /** Settles once every call accepted so far has settled, failed ones included. */
  drain(): Promise<void> {
    return this.#chain;
  }
}

/**
 * Wire `Symbol.asyncDispose` on a toolset class's prototype to its `close()`, where the engine provides the symbol.
 * The tsconfig targets ES2020, so there is no typed `AsyncDisposable` member: `await using` works from JavaScript on
 * those engines, and TypeScript callers use `close()`.
 */
export function wireAsyncDispose(prototype: { close(): Promise<void> }): void {
  const asyncDispose = (Symbol as { asyncDispose?: symbol }).asyncDispose;
  if (!asyncDispose || Object.prototype.hasOwnProperty.call(prototype, asyncDispose)) return;
  Object.defineProperty(prototype, asyncDispose, {
    // Through `this`, so a subclass's `close()` override is what runs.
    value: function (this: { close(): Promise<void> }) {
      return this.close();
    },
    configurable: true,
    writable: true,
  });
}
