/**
 * An `Anthropic`-shaped stub backed by an in-memory store.
 *
 * A memory store is a folder: path → content. {@link MemoryServer} is that
 * dict plus a log of the writes the code under test sent it. The SDK-shaped
 * resource `SessionMemoryStores` actually calls is a private adapter.
 *
 * Paths are bare (`'push.md'`); the leading `/` the wire uses is added and
 * stripped internally so tests use one path vocabulary throughout.
 */

import { createHash } from 'node:crypto';
import { APIError } from '@anthropic-ai/sdk/core/error';
import type { Anthropic } from '@anthropic-ai/sdk/client';
import type { BetaManagedAgentsSession } from '@anthropic-ai/sdk/resources/beta/sessions/sessions';

export function sha(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function statusError(code: number): APIError {
  return new APIError(code, undefined, `status ${code}`, new Headers());
}

/** A request the sync sent, in domain terms: paths and content. */
export type Received = unknown[];

/**
 * The test's view of one remote memory store.
 *
 * `files` is its current state (path → content); `received` is every write
 * the code under test sent it. Arranging via {@link MemoryServer.write} /
 * {@link MemoryServer.delete} changes `files` without touching `received` —
 * only the sync's own requests are recorded.
 */
export class MemoryServer {
  /** A `null` value is a memory with null content — the wire allows it. */
  files: Record<string, string | null>;
  received: Received[] = [];
  /** Reject create/update whose content exceeds this many bytes with a 400. */
  maxContentBytes: number | null = null;
  /**
   * Session lookups the code under test performed (the worker shares one
   * fetch between the skills and memory downloads).
   */
  retrieves: string[] = [];
  /**
   * Single-memory content fetches (the sync's content pass), in arrival
   * order — a test asserting "no content moved" checks this stays empty.
   */
  contentFetches: string[] = [];
  /**
   * Called with the path as each content fetch arrives — throw to break the
   * fetch, or delete the path to race it against a server delete.
   */
  fetchHook: ((path: string) => void | Promise<void>) | null = null;
  /**
   * Awaited with the path as each create/update arrives, before the request
   * is recorded — park it to hold an upload open.
   */
  uploadHook: ((path: string) => void | Promise<void>) | null = null;

  constructor(initial: Record<string, string | null>) {
    this.files = { ...initial };
  }

  write(path: string, content: string): void {
    this.files[path] = content;
  }

  delete(path: string): void {
    delete this.files[path];
  }
}

// Requests recorded on `server.received`. `was` is the pre-image content the
// request's precondition guards on — the builder computes the sha.

export function created(path: string, content: string): Received {
  return ['create', path, content];
}

export function updated(path: string, content: string, was: string): Received {
  return ['update', path, content, sha(was)];
}

export function deleted(path: string, was: string): Received {
  return ['delete', path, sha(was)];
}

/**
 * Adapts a {@link MemoryServer} to the `client.beta.memoryStores.memories`
 * shape. Items are built on the fly from `server.files` so there is no cached
 * state to drift; ids are derived from paths so there is no id table.
 */
class MemoriesResource {
  constructor(
    private server: MemoryServer,
    private noise = false,
  ) {}

  private item(path: string, view: string = 'full') {
    const content = this.server.files[path] ?? null;
    return {
      type: 'memory',
      id: `mem:${path}`,
      path: '/' + path,
      content: view === 'full' ? content : null,
      content_sha256: sha(content ?? ''),
    };
  }

  list(memoryStoreId: string, params?: { view?: string }): AsyncIterable<unknown> {
    const view = params?.view ?? 'basic';
    const items = Object.keys(this.server.files).map((p) => this.item(p, view));
    const noise = this.noise;
    return {
      async *[Symbol.asyncIterator]() {
        if (noise) {
          // Depth-limited listings roll directories up as prefixes; only
          // `memory` items carry content.
          yield { type: 'memory_prefix', path: '/projects/' };
        }
        if (memoryStoreId === 'memstore_broken') {
          // One memory is listed, then the pager explodes.
          yield {
            type: 'memory',
            id: 'mem:half',
            path: '/half.md',
            content: view === 'full' ? 'partial' : null,
            content_sha256: sha('partial'),
          };
          throw new Error('list exploded');
        }
        for (const item of items) yield item;
      },
    };
  }

  async retrieve(memoryId: string, params: { memory_store_id: string; view?: string }): Promise<unknown> {
    const path = memoryId.replace(/^mem:/, '');
    this.server.contentFetches.push(path);
    await this.server.fetchHook?.(path);
    if (!(path in this.server.files)) throw statusError(404);
    return this.item(path, params.view ?? 'basic');
  }

  private checkSize(content: string): void {
    const cap = this.server.maxContentBytes;
    if (cap !== null && Buffer.byteLength(content, 'utf-8') > cap) throw statusError(400);
  }

  async create(_memoryStoreId: string, params: { path: string; content: string }): Promise<unknown> {
    const bare = params.path.replace(/^\/+/, '');
    await this.server.uploadHook?.(bare);
    this.server.received.push(created(bare, params.content));
    this.checkSize(params.content);
    this.server.files[bare] = params.content;
    return this.item(bare);
  }

  async update(
    memoryId: string,
    params: { memory_store_id: string; content: string; precondition: { content_sha256: string } },
  ): Promise<unknown> {
    const path = memoryId.replace(/^mem:/, '');
    await this.server.uploadHook?.(path);
    this.server.received.push(['update', path, params.content, params.precondition.content_sha256]);
    this.checkSize(params.content);
    if (!(path in this.server.files)) throw statusError(404);
    if (sha(this.server.files[path] ?? '') !== params.precondition.content_sha256) throw statusError(409);
    this.server.files[path] = params.content;
    return this.item(path);
  }

  async delete(
    memoryId: string,
    params: { memory_store_id: string; expected_content_sha256?: string },
  ): Promise<unknown> {
    const path = memoryId.replace(/^mem:/, '');
    this.server.received.push(['delete', path, params.expected_content_sha256]);
    if (!(path in this.server.files)) throw statusError(404);
    if (
      params.expected_content_sha256 !== undefined &&
      sha(this.server.files[path] ?? '') !== params.expected_content_sha256
    ) {
      throw statusError(409);
    }
    delete this.server.files[path];
    return { id: memoryId, type: 'memory_deleted' };
  }
}

/**
 * An `Anthropic`-shaped client with one memory store named `notes`.
 *
 * The store lands at `{workdir}/memory/notes`. Returns the client to hand to
 * `SessionMemoryStores`, the server handle for the test, and the log lines
 * everything under test emitted. `brokenStore` attaches a second store, ahead
 * of `notes`, whose listing explodes after one memory. `noise` adds a
 * non-store resource to the session and a `memory_prefix` rollup to every
 * listing.
 */
export function fakeAnthropic(
  initial: Record<string, string | null>,
  opts?: {
    access?: 'read_only' | 'read_write' | null;
    brokenStore?: boolean;
    mountPath?: string | null;
    noise?: boolean;
  },
): { client: never; server: MemoryServer; logs: string[]; memories: MemoriesResource } {
  const server = new MemoryServer(initial);
  const memories = new MemoriesResource(server, opts?.noise ?? false);
  const resources: unknown[] = [
    {
      type: 'memory_store',
      memory_store_id: 'memstore_notes',
      mount_path: opts?.mountPath ?? null,
      name: 'notes',
      access: opts?.access ?? null,
    },
  ];
  if (opts?.noise) {
    resources.unshift({ type: 'file', file_id: 'file_1' });
  }
  if (opts?.brokenStore) {
    resources.unshift({
      type: 'memory_store',
      memory_store_id: 'memstore_broken',
      mount_path: null,
      name: 'broken',
      access: null,
    });
  }
  const logs: string[] = [];
  const logAll = (...args: unknown[]) => logs.push(args.map((a) => JSON.stringify(a)).join(' '));

  const client = {
    logger: { error: logAll, warn: logAll, info: logAll, debug: logAll },
    logLevel: 'debug',
    beta: {
      sessions: {
        retrieve: async (sessionId: string) => {
          server.retrieves.push(sessionId);
          return { agent: { skills: [] }, resources };
        },
      },
      memoryStores: { memories },
    },
  };
  return { client: client as never, server, logs, memories };
}

/**
 * The fake's session, fetched the way the worker fetches it: once, up front,
 * then handed to `download` — which never looks it up itself.
 */
export function retrieveSession(client: Anthropic): Promise<BetaManagedAgentsSession> {
  return client.beta.sessions.retrieve('s1');
}

/**
 * Run `interrupt` once while a server listing started inside `run` is being
 * consumed: right after the sync has processed `afterItems` listed items, or
 * once the listing is exhausted when `afterItems` is omitted. This lands a
 * change on disk after the sync's directory scan and before whatever it does
 * next.
 */
export async function listingInterruptedBy(
  memories: MemoriesResource,
  interrupt: () => void,
  run: () => Promise<void>,
  opts?: { afterItems?: number },
): Promise<void> {
  const realList = memories.list.bind(memories);
  memories.list = (memoryStoreId: string, params?: { view?: string }) => {
    const inner = realList(memoryStoreId, params);
    return {
      async *[Symbol.asyncIterator]() {
        let consumed = 0;
        for await (const item of inner) {
          yield item;
          if (++consumed === opts?.afterItems) interrupt();
        }
        if (opts?.afterItems === undefined) interrupt();
      },
    };
  };
  try {
    await run();
  } finally {
    memories.list = realList;
  }
}
