/**
 * Tests for {@link FileStore} — the confined-folder filesystem layer.
 *
 * The verbs (`put` / `get` / `ls` / `findSymlinks` / `hashtree` / `hashFile` /
 * `move` / `remove`) plus the open and dispose lifecycle. These tests exercise
 * the filesystem directly; consumers (memory sync, the skills downloader, the
 * builtin memory tool) get their own suites.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  openFileStore,
  isPathLegal,
  FileStore,
  FileStoreError,
  LocalFileStore,
  type OpenFileStoreOptions,
  _internals,
} from '@anthropic-ai/sdk/internal/file-store';

function sha(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

function mode(p: string): number {
  return fs.statSync(p).mode & 0o777;
}

function rejects(p: Promise<unknown>) {
  return expect(p).rejects.toBeInstanceOf(FileStoreError);
}

function rejectsENOENT(p: Promise<unknown>) {
  return expect(p).rejects.toMatchObject({ code: 'ENOENT' });
}

async function createdStore(root: string, opts?: OpenFileStoreOptions): Promise<FileStore> {
  const s = await openFileStore(root, opts);
  await s.createRoot();
  return s;
}

const posixOnly = process.platform === 'win32' ? test.skip : test;
const nonRootOnly = process.getuid?.() === 0 || process.platform === 'win32' ? test.skip : test;

describe('FileStore', () => {
  let tmp: string;
  let root: string;
  let store: FileStore;
  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'filestore-'));
    root = path.join(tmp, 'store');
    store = await createdStore(root);
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('LocalFileStore is an alias for the combined class', () => {
    expect(LocalFileStore).toBe(FileStore);
  });

  test('put writes text and creates owner-only parents', async () => {
    await store.put('projects/foo/notes.md', 'héllo');
    const dest = path.join(root, 'projects', 'foo', 'notes.md');
    expect(fs.readFileSync(dest, 'utf-8')).toBe('héllo');
    expect(mode(path.dirname(dest))).toBe(0o700);
    expect(mode(dest)).toBe(0o600);
  });

  test('put executable sets owner exec', async () => {
    await store.put('run.sh', new TextEncoder().encode('#!/bin/sh\necho hi\n'), { executable: true });
    expect(mode(path.join(root, 'run.sh'))).toBe(0o700);
  });

  test('put is atomic and leaves no temp on success', async () => {
    await store.put('a.md', 'first');
    await store.put('a.md', 'second');
    expect(fs.readFileSync(path.join(root, 'a.md'), 'utf-8')).toBe('second');
    expect(fs.readdirSync(root).sort()).toEqual(['a.md']);
  });

  posixOnly('creates every parent owner-only under permissive umask', async () => {
    // Every directory the store creates — including intermediate parents,
    // which `mkdir({ recursive: true, mode })` would leave at the umask
    // default — is 0o700.
    const old = process.umask(0);
    try {
      const nested = path.join(tmp, 'nested', 'store');
      const s = await createdStore(nested);
      await s.put('projects/foo/notes.md', 'hi');
      for (const d of [
        path.join(tmp, 'nested'),
        nested,
        path.join(nested, 'projects'),
        path.join(nested, 'projects', 'foo'),
      ]) {
        expect(mode(d)).toBe(0o700);
      }
    } finally {
      process.umask(old);
    }
  });

  test('every verb refuses an escaping path', async () => {
    // `..` (and absolute) paths raise FileStoreError on every verb; nothing
    // is read or written outside the root.
    fs.writeFileSync(path.join(tmp, 'secret.md'), 'top secret');
    await store.put('ok.md', 'ok');

    for (const bad of ['../secret.md', 'a/../../secret.md']) {
      await rejects(store.put(bad, 'nope'));
      await rejects(store.get(bad));
      await rejects(store.ls(bad));
      await rejects(store.hashtree(bad));
      await rejects(store.hashFile(bad));
      await rejects(store.findSymlinks(bad));
      await rejects(store.move('ok.md', bad));
      await rejects(store.move(bad, 'landed.md'));
      await rejects(store.remove(bad));
    }
    const err = await store.get('../secret.md').then(
      () => null,
      (e) => e as FileStoreError,
    );
    expect(err!.reason).toBe(FileStoreError.ESCAPES_ROOT);

    expect(fs.readFileSync(path.join(tmp, 'secret.md'), 'utf-8')).toBe('top secret');
    expect(fs.readdirSync(tmp).sort()).toEqual(['secret.md', 'store']);
  });

  test('openFileStore refuses a platform without O_NOFOLLOW', async () => {
    try {
      await jest.isolateModulesAsync(async () => {
        const real = jest.requireActual('node:fs');
        jest.doMock('node:fs', () => ({ ...real, constants: { ...real.constants, O_NOFOLLOW: 0 } }));
        const { openFileStore: open } = require('../../src/internal/file-store');
        await expect(open(path.join(tmp, 'gated'))).rejects.toThrow(/O_NOFOLLOW/);
      });
    } finally {
      jest.dontMock('node:fs');
    }
  });

  posixOnly('get does not follow a symlink leaf', async () => {
    // A symlink at the target is refused on read and replaced — not written
    // through — on put.
    await store.put('real.md', 'original');
    fs.symlinkSync(path.join(root, 'real.md'), path.join(root, 'link.md'));

    await rejects(store.get('link.md'));
    await store.put('link.md', 'new');
    expect(fs.readFileSync(path.join(root, 'real.md'), 'utf-8')).toBe('original');
    expect(fs.lstatSync(path.join(root, 'link.md')).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(path.join(root, 'link.md'), 'utf-8')).toBe('new');
  });

  posixOnly('get refuses a non-regular file', async () => {
    // A present-but-non-regular leaf (fifo, symlink, ...) raises
    // FileStoreError instead of hanging or being read: the open itself must
    // refuse the fifo (O_NONBLOCK + fstat) — it must not block the read
    // forever.
    execFileSync('mkfifo', [path.join(root, 'pipe.md')]);
    fs.symlinkSync(path.join(root, 'pipe.md'), path.join(root, 'link.md'));

    await expect(store.get('pipe.md')).rejects.toThrow(/is not a regular file/);
    await expect(store.get('link.md')).rejects.toThrow(/is a symlink/);
  });

  test('get returns null when absent', async () => {
    expect(await store.get('absent.md')).toBeNull();
    await store.put('present.md', 'here');
    expect(new TextDecoder().decode((await store.get('present.md'))!)).toBe('here');
  });

  posixOnly('ls lists recursively and never descends symlinks', async () => {
    await store.put('a.md', 'alpha');
    await store.put('sub/b.md', 'bravo');
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 's.md'), 'secret');
    fs.symlinkSync(outside, path.join(root, 'lnkdir'));
    fs.symlinkSync(path.join(outside, 's.md'), path.join(root, 'lnk.md'));

    expect(await store.ls()).toEqual(new Set(['a.md', 'sub/b.md']));
    expect(await store.ls('sub')).toEqual(new Set(['sub/b.md']));
    expect(await store.ls('absent')).toEqual(new Set());
    expect(await store.ls('a.md/under')).toEqual(new Set());
    await expect(store.ls('a.md')).rejects.toThrow(/is not a directory/);
  });

  posixOnly('findSymlinks reports every symlink', async () => {
    // Listings skip symlinks silently; `findSymlinks` is how a caller sees them.
    await store.put('a.md', 'alpha');
    await store.put('sub/b.md', 'bravo');
    expect(await store.findSymlinks()).toEqual(new Set());

    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 's.md'), 'secret');
    fs.symlinkSync(outside, path.join(root, 'lnkdir'));
    fs.symlinkSync(path.join(outside, 's.md'), path.join(root, 'sub', 'lnk.md'));
    fs.symlinkSync(path.join(root, 'gone.md'), path.join(root, 'dangling.md'));

    expect(await store.findSymlinks()).toEqual(new Set(['lnkdir', 'sub/lnk.md', 'dangling.md']));
    expect(await store.findSymlinks('sub')).toEqual(new Set(['sub/lnk.md']));
    expect(await store.findSymlinks('absent')).toEqual(new Set());
    // A base that is itself a symlink is reported, not walked through.
    expect(await store.findSymlinks('lnkdir')).toEqual(new Set(['lnkdir']));
  });

  posixOnly('hashtree hashes regular files and skips symlinks', async () => {
    await store.put('a.md', 'alpha');
    await store.put('sub/b.md', 'bravo');
    fs.writeFileSync(path.join(tmp, 'secret.txt'), 'secret');
    fs.symlinkSync(path.join(tmp, 'secret.txt'), path.join(root, 'link.md'));

    expect(await store.hashtree()).toEqual({ 'a.md': sha('alpha'), 'sub/b.md': sha('bravo') });
    expect(await store.hashtree('sub/')).toEqual({ 'sub/b.md': sha('bravo') });
  });

  nonRootOnly('listings raise on an unreadable subdirectory', async () => {
    // An unreadable subdirectory fails the listing rather than dropping out of it.
    await store.put('a.md', 'alpha');
    await store.put('locked/b.md', 'bravo');
    const locked = path.join(root, 'locked');
    fs.chmodSync(locked, 0o000);
    try {
      await expect(store.hashtree()).rejects.toMatchObject({ code: 'EACCES' });
      await expect(store.ls()).rejects.toMatchObject({ code: 'EACCES' });
      await expect(store.findSymlinks()).rejects.toMatchObject({ code: 'EACCES' });
    } finally {
      fs.chmodSync(locked, 0o700);
    }
    expect(await store.hashtree()).toEqual({ 'a.md': sha('alpha'), 'locked/b.md': sha('bravo') });
  });

  posixOnly('hashtree refuses a symlinked prefix', async () => {
    // A prefix that is a symlink (here to a directory outside the root) is
    // refused, not silently listed as empty.
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'secret.md'), 'secret');
    fs.symlinkSync(outside, path.join(root, 'sub'));

    await rejects(store.hashtree('sub'));
  });

  posixOnly('hashFile hashes one file and shares the cache', async () => {
    const hashed: string[] = [];
    const realHash = _internals.hashFile;
    const spy = jest.spyOn(_internals, 'hashFile').mockImplementation((full) => {
      hashed.push(path.basename(full));
      return realHash(full);
    });
    const realMargin = _internals.timestampTrustMarginNs;
    _internals.timestampTrustMarginNs = -1_000_000_000_000_000n;
    try {
      await store.put('a.md', 'alpha');
      expect(await store.hashFile('a.md')).toBe(sha('alpha'));
      expect(await store.hashFile('absent.md')).toBeNull();
      // hashtree reuses the entry hashFile just cached.
      expect(await store.hashtree()).toEqual({ 'a.md': sha('alpha') });
      expect(hashed).toEqual(['a.md']);

      fs.symlinkSync(path.join(root, 'a.md'), path.join(root, 'lnk.md'));
      await expect(store.hashFile('lnk.md')).rejects.toThrow(/is a symlink/);
    } finally {
      _internals.timestampTrustMarginNs = realMargin;
      spy.mockRestore();
    }
  });

  test('move renames within root and refuses existing dest', async () => {
    await store.put('a.md', 'alpha');
    await store.move('a.md', 'nested/b.md');
    expect(new TextDecoder().decode((await store.get('nested/b.md'))!)).toBe('alpha');
    expect(await store.get('a.md')).toBeNull();

    await store.put('c.md', 'charlie');
    await expect(store.move('nested/b.md', 'c.md')).rejects.toThrow(/exists/);
  });

  test('root path is banned from the interface', async () => {
    // A relPath resolving to the root: put/get refuse, move/remove do nothing.
    await store.put('x.md', 'x');

    await store.remove('/'); // no-op
    expect(new TextDecoder().decode((await store.get('x.md'))!)).toBe('x');
    await store.move('/', 'elsewhere'); // no-op
    await store.move('x.md', '/'); // no-op
    expect(await store.ls()).toEqual(new Set(['x.md']));

    await rejects(store.put('/', 'data'));
    await expect(store.get('/')).rejects.toThrow(/is not a regular file/);
  });

  test('remove deletes file and subtree', async () => {
    await store.put('a.md', 'a');
    await store.put('sub/b.md', 'b');

    await store.remove('a.md');
    expect(fs.existsSync(path.join(root, 'a.md'))).toBe(false);
    await store.remove('sub');
    expect(fs.existsSync(path.join(root, 'sub'))).toBe(false);
    await store.remove('absent.md'); // no-op
  });

  posixOnly('remove unlinks a dangling symlink', async () => {
    fs.symlinkSync(path.join(root, 'gone.md'), path.join(root, 'dangling.md'));

    await store.remove('dangling.md');
    expect(fs.lstatSync(path.join(root, 'dangling.md'), { throwIfNoEntry: false })).toBeUndefined();
  });

  nonRootOnly('open raises on an unreadable mount path', async () => {
    // A mount path the process cannot stat raises at open — it is never read
    // as absent, which would mark a real directory ours to remove on dispose.
    const locked = path.join(tmp, 'locked');
    fs.mkdirSync(path.join(locked, 'store'), { recursive: true });
    fs.chmodSync(locked, 0o000);
    try {
      const err = await openFileStore(path.join(locked, 'store')).then(
        () => null,
        (e) => e as NodeJS.ErrnoException,
      );
      expect(err).not.toBeInstanceOf(FileStoreError);
      expect(err!.code).toBe('EACCES');
    } finally {
      fs.chmodSync(locked, 0o700);
    }
  });

  test('async dispose removes root only if created', async () => {
    // The `await using` lifecycle: `Symbol.asyncDispose` is `dispose`.
    const asyncDispose = (Symbol as { asyncDispose?: symbol }).asyncDispose;
    if (!asyncDispose) return; // engine without explicit resource management
    {
      const s = await createdStore(path.join(tmp, 'fresh'));
      await s.put('x.md', 'x');
      expect(s.root()).toEqual({ path: path.resolve(tmp, 'fresh'), removedOnDispose: true });
      await (s as unknown as Record<symbol, () => Promise<void>>)[asyncDispose]!();
      expect(fs.existsSync(path.join(tmp, 'fresh'))).toBe(false);
    }
    {
      fs.mkdirSync(path.join(tmp, 'old'));
      const s = await openFileStore(path.join(tmp, 'old'));
      await s.put('y.md', 'y');
      expect(s.root().removedOnDispose).toBe(false);
      await (s as unknown as Record<symbol, () => Promise<void>>)[asyncDispose]!();
      expect(fs.readFileSync(path.join(tmp, 'old', 'y.md'), 'utf-8')).toBe('y');
    }
  });

  test('dispose removes the root it created and keeps preexisting', async () => {
    const fresh = await createdStore(path.join(tmp, 'fresh'));
    await fresh.put('x.md', 'x');
    await fresh.dispose();
    expect(fs.existsSync(path.join(tmp, 'fresh'))).toBe(false);

    fs.mkdirSync(path.join(tmp, 'old'));
    const old = await openFileStore(path.join(tmp, 'old'));
    await old.put('y.md', 'y');
    await old.dispose();
    expect(fs.readFileSync(path.join(tmp, 'old', 'y.md'), 'utf-8')).toBe('y');
  });

  test('createRoot makes the folder owner-only', async () => {
    const fresh = path.join(tmp, 'fresh');
    const s = await openFileStore(fresh);
    await s.createRoot();
    expect(mode(fresh)).toBe(0o700);
    await s.createRoot(); // already existing is fine
    expect(s.root().removedOnDispose).toBe(true);
  });

  test('put never creates a missing root', async () => {
    // Only createRoot() makes the folder: a put into a store that was never
    // created, or whose folder was removed, rejects and re-creates nothing —
    // not the root and nothing above it.
    const mnt = path.join(tmp, 'mnt');
    const nested = path.join(mnt, 'store');
    const s = await openFileStore(nested);

    await rejectsENOENT(s.put('a.md', 'a'));
    await rejectsENOENT(s.put('sub/a.md', 'a'));
    expect(fs.existsSync(mnt)).toBe(false);

    await s.createRoot();
    await s.put('a.md', 'a');
    fs.rmSync(nested, { recursive: true, force: true });
    await rejectsENOENT(s.put('b.md', 'b'));
    await rejectsENOENT(s.put('sub/b.md', 'b'));
    expect(fs.existsSync(nested)).toBe(false);

    fs.rmSync(mnt, { recursive: true, force: true });
    await rejectsENOENT(s.put('z.md', 'z'));
    expect(fs.existsSync(mnt)).toBe(false);

    await s.createRoot();
    await s.put('z.md', 'z');
    expect(new TextDecoder().decode((await s.get('z.md'))!)).toBe('z');
  });

  test('move never creates a missing root', async () => {
    await store.put('a.md', 'a');
    fs.rmSync(root, { recursive: true, force: true });

    await rejectsENOENT(store.move('a.md', 'sub/b.md'));
    expect(fs.existsSync(root)).toBe(false);
  });

  test('put writes archive-shaped bytes verbatim', async () => {
    // Archive-shaped bytes land as a single byte-identical file — extraction
    // is never inferred from the content.
    const blob = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...Array.from({ length: 64 }, (_, i) => i)]);
    await store.put('bundle.zip', blob);

    expect(await store.get('bundle.zip')).toEqual(blob);
    expect(await store.hashtree()).toEqual({ 'bundle.zip': sha(blob) });
  });

  test('put refuses a directory rel', async () => {
    for (const bad of ['bundles/v1/', 'dir/.', '.', '/', '', 'bundles\\v1\\']) {
      const err = await store.put(bad, 'data').then(
        () => null,
        (e) => e as FileStoreError,
      );
      expect(err).toBeInstanceOf(FileStoreError);
      expect(err!.reason).toBe(FileStoreError.NOT_A_FILE);
    }
    expect(await store.hashtree()).toEqual({});
  });

  test('utf8 restriction refuses binary content', async () => {
    // A store opened with `utf8: true` refuses binary content on both verbs
    // that touch it: a put of invalid bytes writes nothing, and a get of a
    // file that bypassed the store (written directly to disk) is refused
    // rather than returned — so callers that decode get's result can never
    // throw.
    const restricted = await createdStore(path.join(tmp, 'restricted'), { utf8: true });
    const binary = new Uint8Array([0xff, 0xfe, 0x00, 0x20, 0x6e, 0x6f, 0x74]);

    await expect(restricted.put('blob.bin', binary)).rejects.toThrow(/is not valid utf-8/);
    expect(fs.existsSync(path.join(tmp, 'restricted', 'blob.bin'))).toBe(false);

    // String puts and conforming bytes are unaffected.
    await restricted.put('note.md', 'hello');
    await restricted.put('bytes.md', new TextEncoder().encode('hello'));
    expect(new TextDecoder().decode((await restricted.get('note.md'))!)).toBe('hello');

    // A file smuggled in behind the store's back is refused at get.
    fs.writeFileSync(path.join(tmp, 'restricted', 'smuggled.bin'), binary);
    await expect(restricted.get('smuggled.bin')).rejects.toThrow(/is not valid utf-8/);

    // An unrestricted store keeps returning raw bytes.
    const loose = await createdStore(path.join(tmp, 'loose'));
    await loose.put('blob.bin', binary);
    expect(await loose.get('blob.bin')).toEqual(binary);
  });

  test('isPathLegal', () => {
    expect(isPathLegal('/mnt/memory/notes')).toBe(true);
    expect(isPathLegal('mnt/relative')).toBe(false);
    expect(isPathLegal('/mnt/../../etc/cron.d')).toBe(false);
    expect(isPathLegal('')).toBe(false);
    expect(LocalFileStore.isPathLegal('/mnt/memory/notes')).toBe(true);
  });

  test('hashtree lists files with prototype-colliding names', async () => {
    // A plain `{}` would swallow `out['__proto__'] = …` (prototype write) and
    // alias `constructor`; the hashtree map must treat them as ordinary keys.
    await store.put('__proto__', 'proto');
    await store.put('constructor', 'ctor');
    const tree = await store.hashtree();
    expect(Object.getOwnPropertyNames(tree).sort()).toEqual(['__proto__', 'constructor']);
    expect(tree['constructor']).toBe(sha('ctor'));
    expect(Object.getOwnPropertyDescriptor(tree, '__proto__')!.value).toBe(sha('proto'));
  });

  test('hashtree re-hashes only what changed', async () => {
    // A file whose stat identity (mtime, ctime, size) is unchanged since the
    // last walk is served from the cache; a changed file is re-read. The
    // trust margin is disabled here so fresh files cache immediately; a
    // writer that restores mtime and size (`rsync -t` style) is still
    // re-hashed, because userspace cannot restore ctime.
    const hashed: string[] = [];
    const realHash = _internals.hashFile;
    const spy = jest.spyOn(_internals, 'hashFile').mockImplementation((full) => {
      hashed.push(path.basename(full));
      return realHash(full);
    });
    const realMargin = _internals.timestampTrustMarginNs;
    _internals.timestampTrustMarginNs = -1_000_000_000_000_000n;
    try {
      await store.put('a.md', 'alpha');
      await store.put('b.md', 'bravo');
      // A whole-second stamp survives the utimes double→timespec round-trip
      // exactly, so the rewrite below can restore it byte-identically.
      const stamp = Math.floor(Date.now() / 1000);
      const b = path.join(root, 'b.md');
      fs.utimesSync(path.join(root, 'a.md'), stamp, stamp);
      fs.utimesSync(b, stamp, stamp);

      expect(await store.hashtree()).toEqual({ 'a.md': sha('alpha'), 'b.md': sha('bravo') });
      expect(hashed.sort()).toEqual(['a.md', 'b.md']);

      hashed.length = 0;
      expect(await store.hashtree()).toEqual({ 'a.md': sha('alpha'), 'b.md': sha('bravo') });
      expect(hashed).toEqual([]);

      // An mtime-and-size-preserving rewrite: same length, mtime restored.
      // The sleep guarantees the rewrite's ctime lands on a later
      // coarse-clock tick than the original's — ctime is the one stamp the
      // rewrite cannot restore.
      await new Promise((resolve) => setTimeout(resolve, 50));
      fs.writeFileSync(b, 'BRAVO');
      fs.utimesSync(b, stamp, stamp);
      expect((await store.hashtree())['b.md']).toBe(sha('BRAVO'));
      expect(hashed).toEqual(['b.md']);
    } finally {
      _internals.timestampTrustMarginNs = realMargin;
      spy.mockRestore();
    }
  });

  test('hashtree distrusts fresh stamps', async () => {
    // Filesystems stamp times with coarse clocks, so a same-tick rewrite can
    // reuse the exact stat identity of the version just hashed. A file whose
    // stamps are within the trust margin of the walk is never cached — pinned
    // by freezing the walk clock at the file's own stamp time.
    const hashed: string[] = [];
    const realHash = _internals.hashFile;
    const spy = jest.spyOn(_internals, 'hashFile').mockImplementation((full) => {
      hashed.push(path.basename(full));
      return realHash(full);
    });
    const realNow = _internals.nowNs;
    try {
      await store.put('racy.md', 'AAAAAA');
      const stamp = fs.statSync(path.join(root, 'racy.md'), { bigint: true }).ctimeNs;
      _internals.nowNs = () => stamp;

      expect((await store.hashtree())['racy.md']).toBe(sha('AAAAAA'));
      expect((await store.hashtree())['racy.md']).toBe(sha('AAAAAA'));
      // Both walks hashed: nothing this fresh is ever cached.
      expect(hashed).toEqual(['racy.md', 'racy.md']);

      // What the margin defends: a same-tick rewrite that preserves the whole
      // stat identity must be seen by the next walk.
      fs.writeFileSync(path.join(root, 'racy.md'), 'BBBBBB');
      expect((await store.hashtree())['racy.md']).toBe(sha('BBBBBB'));

      // The margin's width is part of the contract: stamps 1.5s old are still
      // distrusted (coarse filesystems stamp in whole seconds); 10s-old stamps
      // are safely past it.
      hashed.length = 0;
      const now = fs.statSync(path.join(root, 'racy.md'), { bigint: true }).ctimeNs;
      _internals.nowNs = () => now + 1_500_000_000n;
      await store.hashtree();
      await store.hashtree();
      expect(hashed).toEqual(['racy.md', 'racy.md']);
      _internals.nowNs = () => now + 10_000_000_000n;
      await store.hashtree();
      await store.hashtree();
      expect(hashed).toEqual(['racy.md', 'racy.md', 'racy.md']);
    } finally {
      _internals.nowNs = realNow;
      spy.mockRestore();
    }
  });
});
