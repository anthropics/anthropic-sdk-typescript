/** The file policy: `betaCheckUploadPath` and `BetaNodeFilePolicy`. */
import fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ToolsetUsageError,
  ToolError,
  UploadRefusedError,
  type BetaURLContext,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import { BetaNodeFilePolicy, betaCheckUploadPath } from '@anthropic-ai/sdk/helpers/beta/toolsets/node';

// The refusal texts the model reads for an upload path; pinned because they must never name a root.
const UPLOAD_OUTSIDE_ROOTS = 'file_upload path is outside the configured upload roots';
const UPLOAD_DOTDOT = "file_upload path must not contain a '..' component";

describe('betaCheckUploadPath', () => {
  let base: string;
  let root: string;
  beforeAll(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'toolset-upload-'));
    root = path.join(base, 'upload');
    fs.mkdirSync(root);
    fs.mkdirSync(path.join(base, 'uploads-old'));
    fs.mkdirSync(path.join(base, 'outside'));
    fs.writeFileSync(path.join(root, 'ok.txt'), 'x');
    fs.writeFileSync(path.join(base, 'outside', 'secret.txt'), 'x');
    fs.writeFileSync(path.join(base, 'uploads-old', 'x.txt'), 'x');
    fs.symlinkSync(path.join(base, 'outside', 'secret.txt'), path.join(root, 'link-out'));
    fs.symlinkSync(path.join(root, 'link-out'), path.join(root, 'link-chain'));
    fs.symlinkSync(path.join(root, 'ok.txt'), path.join(root, 'link-in'));
  });
  afterAll(() => fs.rmSync(base, { recursive: true, force: true }));

  const outside = new UploadRefusedError('file_upload path is outside the configured upload roots');

  it('accepts the root, a file in it, a symlink staying inside, and a not-yet-existing child', async () => {
    const realRoot = fs.realpathSync.native(root);
    expect(await betaCheckUploadPath(root, [root])).toBe(realRoot);
    expect(await betaCheckUploadPath(path.join(root, 'ok.txt'), [root])).toBe(path.join(realRoot, 'ok.txt'));
    expect(await betaCheckUploadPath(path.join(root, 'link-in'), [root])).toBe(path.join(realRoot, 'ok.txt'));
    expect(await betaCheckUploadPath(path.join(root, 'new', 'file.bin'), [root])).toBe(
      path.join(realRoot, 'new', 'file.bin'),
    );
  });

  it('refuses traversal, sibling-prefix roots, symlinks out, symlink chains and relative escapes', async () => {
    await expect(betaCheckUploadPath(path.join(root, '..', 'outside', 'secret.txt'), [root])).rejects.toThrow(
      outside,
    );
    await expect(betaCheckUploadPath(path.join(base, 'uploads-old', 'x.txt'), [root])).rejects.toThrow(
      outside,
    );
    await expect(betaCheckUploadPath(path.join(root, 'link-out'), [root])).rejects.toThrow(outside);
    await expect(betaCheckUploadPath(path.join(root, 'link-chain'), [root])).rejects.toThrow(outside);
    // A relative path that escapes carries a `..` component, so it is refused by the `..` check.
    await expect(
      betaCheckUploadPath(path.relative(process.cwd(), path.join(base, 'outside', 'secret.txt')), [root]),
    ).rejects.toThrow(new UploadRefusedError(UPLOAD_DOTDOT));
    // A literal `..` component is refused before resolution (path.join above strips `..`).
    await expect(betaCheckUploadPath(`${root}/ghost/../file.bin`, [root])).rejects.toThrow(
      new UploadRefusedError(UPLOAD_DOTDOT),
    );
    await expect(betaCheckUploadPath('.', [root])).rejects.toThrow(outside);
  });

  it('refuses empty roots, empty paths and NUL bytes', async () => {
    await expect(betaCheckUploadPath(path.join(root, 'ok.txt'), [])).rejects.toThrow(
      new UploadRefusedError('file_upload has no configured upload roots'),
    );
    await expect(betaCheckUploadPath('', [root])).rejects.toThrow(
      new UploadRefusedError('file_upload path is empty or contains a NUL byte'),
    );
    await expect(betaCheckUploadPath(`${root}/ok.txt\0`, [root])).rejects.toThrow(
      new UploadRefusedError('file_upload path is empty or contains a NUL byte'),
    );
  });

  it('refuses a path outside every root on its text, before touching the filesystem', async () => {
    // A path that does not even claim to be under an upload root is refused without a stat or a realpath, so the
    // model cannot probe or automount a path of its choosing; a path that does claim to be under a root is still
    // resolved, so a symlink inside the root that points out of it is refused.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexical-'));
    const root = path.join(dir, 'uploads');
    fs.mkdirSync(root);
    fs.symlinkSync(dir, path.join(root, 'escape'));
    const spies = [vi.spyOn(fs.promises, 'lstat'), vi.spyOn(fs.promises, 'realpath')];
    try {
      await expect(betaCheckUploadPath('/net/elsewhere.example/share/f', [root])).rejects.toThrow(
        UPLOAD_OUTSIDE_ROOTS,
      );
      const paths = spies.flatMap((spy) => spy.mock.calls.map(([p]) => String(p)));
      expect(paths.filter((p) => p.includes('elsewhere'))).toEqual([]);
      // and the spies do see the SDK's calls: a path that claims to be under the root is resolved
      await betaCheckUploadPath(path.join(root, 'f.txt'), [root]);
      expect(spies[1]!.mock.calls.length).toBeGreaterThan(0);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
    await expect(betaCheckUploadPath(path.join(root, 'escape', 'secret'), [root])).rejects.toThrow(
      UPLOAD_OUTSIDE_ROOTS,
    );
    expect(await betaCheckUploadPath(path.join(root, 'f.txt'), [root])).toBe(
      path.join(fs.realpathSync(root), 'f.txt'),
    );
  });

  it('refuses a blank root entry instead of resolving it to the working directory', async () => {
    // path.resolve('') is the cwd, so a blank root entry — roots: [''], e.g. a blank env var split
    // on ',' — would open the entire working tree to file_upload if it were resolved instead of refused.
    const noRoots = new UploadRefusedError('file_upload has no configured upload roots');
    await expect(betaCheckUploadPath(path.join(process.cwd(), 'package.json'), [''])).rejects.toThrow(
      noRoots,
    );
    await expect(betaCheckUploadPath(path.join(process.cwd(), 'package.json'), ['', '  '])).rejects.toThrow(
      noRoots,
    );
    await expect(betaCheckUploadPath(path.join(process.cwd(), 'package.json'), [''])).rejects.toThrow(
      UploadRefusedError,
    );
  });

  it('refuses a dangling symlink and a symlink cycle rather than answering lexically', async () => {
    // realpath fails for both; re-appending the component verbatim would return an in-root path for
    // an entry that actually points outside every root.
    const dir = fs.mkdtempSync(path.join(base, 'lenient-'));
    fs.symlinkSync(path.join(base, 'outside', 'gone.txt'), path.join(dir, 'dangling'));
    fs.symlinkSync(path.join(dir, 'b'), path.join(dir, 'a'));
    fs.symlinkSync(path.join(dir, 'a'), path.join(dir, 'b'));
    await expect(betaCheckUploadPath(path.join(dir, 'dangling'), [dir])).rejects.toThrow(outside);
    await expect(betaCheckUploadPath(path.join(dir, 'a'), [dir])).rejects.toThrow(outside);
    await expect(betaCheckUploadPath(path.join(dir, 'a', 'x'), [dir])).rejects.toThrow(outside);
    // a genuinely absent child is still fine
    expect(await betaCheckUploadPath(path.join(dir, 'new.bin'), [dir])).toBe(
      path.join(fs.realpathSync.native(dir), 'new.bin'),
    );
  });

  it('refuses a single string where a list of paths is expected', async () => {
    // Iterable<string> is satisfied by a bare string, whose iteration yields characters: the '/'
    // element is a parent of every absolute path and would approve everything.
    await expect(betaCheckUploadPath('/etc/passwd', '/srv/uploads' as unknown as string[])).rejects.toThrow(
      ToolsetUsageError,
    );
  });
});

/** Run `fn` with `process.platform` reporting `platform` until it settles. */
async function onPlatform<T>(platform: NodeJS.Platform, fn: () => Promise<T>): Promise<T> {
  const real = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { ...real, value: platform });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, 'platform', real);
  }
}

describe('upload paths that touch the network or a device on Windows', () => {
  it.each([
    '\\\\attacker.example\\share\\f.txt',
    '//attacker.example/share/f.txt',
    '/\\attacker.example\\share\\f.txt', // mixed separators are UNC to Windows too
    '\\/?\\C:\\x',
    '\\\\?\\C:\\x',
    'CON',
    'com1.tar',
    'NUL.txt',
    'C:CON', // drive-relative spelling: split on ':' too
    'C:NUL.txt',
    'COM1 ', // Win32 strips a trailing space before resolving the device name
    'f.txt:CON', // alternate-data-stream spelling
    'CON .txt', // Win32 truncates the name at the extension dot after stripping the trailing space
    'NUL   .bin',
    'COM1 .log',
    'COM0', // reserved on current Windows too
    'lpt0.txt',
    'CONIN$', // console device handles
    'CONOUT$',
  ])('is refused before the filesystem is consulted: %j', async (candidate) => {
    // Resolving a UNC path makes the Windows redirector authenticate to the named host, and a
    // DOS device name opens the device, not a file.
    const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'toolset-')));
    const target = /^[\\/]/.test(candidate) ? candidate : path.join(dir, candidate);
    const resolved = vi.spyOn(fs.promises, 'realpath');
    try {
      await onPlatform('win32', async () => {
        await expect(betaCheckUploadPath(target, [dir])).rejects.toThrow(
          new UploadRefusedError(UPLOAD_OUTSIDE_ROOTS),
        );
      });
      expect(resolved).not.toHaveBeenCalled(); // refused before anything is resolved
    } finally {
      resolved.mockRestore();
    }
  });

  it('elsewhere a device-named file is an ordinary file, and two leading slashes an ordinary absolute path', async () => {
    const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'toolset-')));
    fs.mkdirSync(path.join(dir, 'aux'));
    await onPlatform('linux', async () => {
      for (const name of ['CON', 'con.pdf', 'aux/notes.txt', 'COM1 .log']) {
        expect(await betaCheckUploadPath(path.join(dir, name), [dir])).toBe(path.join(dir, name));
      }
      expect(await betaCheckUploadPath('/' + dir + '/f.txt', [dir])).toBe(path.join(dir, 'f.txt'));
      await expect(betaCheckUploadPath('//attacker.example/share/f.txt', [dir])).rejects.toThrow(
        new UploadRefusedError(UPLOAD_OUTSIDE_ROOTS),
      );
      const policy = new BetaNodeFilePolicy({ downloadDir: dir, exposeDownloadPaths: true });
      expect(await policy.isPathVisible(path.join(dir, 'nul.bin'))).toBe(true);
    });
    await onPlatform('win32', async () => {
      const policy = new BetaNodeFilePolicy({ downloadDir: dir, exposeDownloadPaths: true });
      expect(await policy.isPathVisible(path.join(dir, 'nul.bin'))).toBe(false);
    });
  });
});

describe('BetaNodeFilePolicy', () => {
  let base: string;
  const ctx: BetaURLContext = { member: 'file_upload' };
  beforeAll(() => {
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'toolset-filepolicy-')));
    fs.mkdirSync(path.join(base, 'uploads'));
    fs.mkdirSync(path.join(base, 'downloads'));
    fs.writeFileSync(path.join(base, 'uploads', 'form.pdf'), 'x');
  });
  afterAll(() => fs.rmSync(base, { recursive: true, force: true }));

  it('vets document ids against its allowlist', () => {
    // Document ids (Files API files) are denied unless listed, like paths outside the upload roots; the refusal names
    // no id, and a listed id passes through unchanged.
    expect(() => new BetaNodeFilePolicy().resolveUploadDocuments(ctx, ['file_abc'])).toThrow(
      /not in the upload allowlist/,
    );
    const policy = new BetaNodeFilePolicy({ uploadDocumentIds: ['file_abc', 'file_def'] });
    expect(policy.resolveUploadDocuments(ctx, ['file_def'])).toEqual(['file_def']);
    expect(() => policy.resolveUploadDocuments(ctx, ['file_def', 'file_xyz'])).toThrow(ToolError);
    try {
      policy.resolveUploadDocuments(ctx, ['file_xyz']);
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('file_xyz');
    }
  });

  it('resolves uploads under its roots and refuses everything else', async () => {
    const policy = new BetaNodeFilePolicy({ uploadRoots: [path.join(base, 'uploads')] });
    expect(await policy.resolveUploadPaths(ctx, [path.join(base, 'uploads', 'form.pdf')])).toEqual([
      path.join(base, 'uploads', 'form.pdf'),
    ]);
    await expect(policy.resolveUploadPaths(ctx, [path.join(base, 'secret')])).rejects.toThrow(
      UPLOAD_OUTSIDE_ROOTS,
    );
    await expect(policy.resolveUploadPaths(ctx, [path.join(base, 'uploads') + '/../secret'])).rejects.toThrow(
      UPLOAD_DOTDOT,
    );
    // No roots: every path-bearing upload is refused.
    await expect(
      new BetaNodeFilePolicy().resolveUploadPaths(ctx, [path.join(base, 'uploads', 'form.pdf')]),
    ).rejects.toThrow('file_upload has no configured upload roots');
  });

  it('exposes download paths only when asked and only inside downloadDir', async () => {
    const downloads = path.join(base, 'downloads');
    expect(
      await new BetaNodeFilePolicy({ downloadDir: downloads }).isPathVisible(path.join(downloads, 'a.bin')),
    ).toBe(false);
    const exposing = new BetaNodeFilePolicy({ downloadDir: downloads, exposeDownloadPaths: true });
    expect(await exposing.isPathVisible(path.join(downloads, 'a.bin'))).toBe(true);
    expect(await exposing.isPathVisible(path.join(downloads, 'sub', 'not-yet.bin'))).toBe(true);
    expect(await exposing.isPathVisible(downloads + '/../a.bin')).toBe(false);
    expect(await exposing.isPathVisible('/etc/passwd')).toBe(false);
    expect(await exposing.isPathVisible('')).toBe(false);
    // A path with a `..` component is hidden before anything is resolved, even when its text collapses into
    // downloadDir: resolving it would walk the prefix the page chose.
    const sep = path.sep;
    const spies = [vi.spyOn(fs.promises, 'lstat'), vi.spyOn(fs.promises, 'realpath')];
    try {
      expect(await exposing.isPathVisible(`${base}${sep}probe${sep}..${sep}downloads${sep}a.bin`)).toBe(
        false,
      );
      expect(await exposing.isPathVisible(`${downloads}${sep}sub${sep}..${sep}a.bin`)).toBe(false);
      expect(spies.flatMap((spy) => spy.mock.calls.map(([p]) => String(p)))).toEqual([]);
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
    // a downloadDir that exists but does not resolve (a dangling link) is a configuration error, not a literal path
    fs.symlinkSync(path.join(base, 'nowhere'), path.join(base, 'dangling-downloads'));
    expect(() => new BetaNodeFilePolicy({ downloadDir: path.join(base, 'dangling-downloads') })).toThrow(
      /downloadDir does not resolve/,
    );
    expect(() => new BetaNodeFilePolicy({ uploadRoots: [path.join(base, 'dangling-downloads')] })).toThrow(
      /an uploadRoots entry does not resolve/,
    );
    // a root that simply does not exist is fine: it grants nothing until it does
    new BetaNodeFilePolicy({ uploadRoots: [path.join(base, 'not-yet')] });
  });

  it('refuses a configured directory that is, or sits under, a link that does not resolve', () => {
    const uploads = path.join(base, 'uploads');
    // a download folder that links to a folder not yet created inside an upload root
    const toNotYet = path.join(base, 'to-not-yet');
    fs.symlinkSync(path.join(uploads, 'not-yet'), toNotYet);
    const refused = (downloadDir: string) =>
      expect(() => new BetaNodeFilePolicy({ uploadRoots: [uploads], downloadDir })).toThrow(
        /downloadDir does not resolve/,
      );
    refused(toNotYet); // the broken link is the download folder
    refused(path.join(toNotYet, 'sub', 'dl')); // the broken link is a parent of it, and nothing below it exists
    // a chain whose last link is broken
    fs.symlinkSync(toNotYet, path.join(base, 'chain'));
    refused(path.join(base, 'chain'));
    // a link cycle, as the folder and as a parent
    fs.symlinkSync(path.join(base, 'cycle-b'), path.join(base, 'cycle-a'));
    fs.symlinkSync(path.join(base, 'cycle-a'), path.join(base, 'cycle-b'));
    refused(path.join(base, 'cycle-a'));
    refused(path.join(base, 'cycle-a', 'dl'));
    // an upload root gets the same check
    expect(() => new BetaNodeFilePolicy({ uploadRoots: [path.join(toNotYet, 'sub')] })).toThrow(
      /an uploadRoots entry does not resolve/,
    );
    // a link that resolves, and a folder that does not exist yet under a folder that does, are fine
    fs.mkdirSync(path.join(base, 'real-target'));
    fs.symlinkSync(path.join(base, 'real-target'), path.join(base, 'good-link'));
    for (const downloadDir of [path.join(base, 'good-link'), path.join(base, 'good-link', 'sub', 'dl')]) {
      expect(() => new BetaNodeFilePolicy({ uploadRoots: [uploads], downloadDir })).not.toThrow();
    }
    expect(
      () => new BetaNodeFilePolicy({ uploadRoots: [uploads], downloadDir: path.join(base, 'no-such', 'dl') }),
    ).not.toThrow();
  });

  it('refuses a configured directory under a regular file', () => {
    // lstat reports ENOTDIR for a path under a file, not ENOENT: there is nothing to walk up from
    fs.writeFileSync(path.join(base, 'a-file'), 'x');
    expect(
      () =>
        new BetaNodeFilePolicy({
          uploadRoots: [path.join(base, 'uploads')],
          downloadDir: path.join(base, 'a-file', 'sub', 'dl'),
        }),
    ).toThrow(/downloadDir does not resolve/);
    expect(() => new BetaNodeFilePolicy({ uploadRoots: [path.join(base, 'a-file', 'sub')] })).toThrow(
      /an uploadRoots entry does not resolve/,
    );
  });

  // lstat fails with EACCES on a path under a folder that cannot be searched. Going up a level would stop at a folder
  // that exists and hide the broken link. A user that is root can search any folder, so this one runs for other users.
  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'refuses a broken link into an upload folder, under a folder that cannot be searched',
    () => {
      const locked = path.join(base, 'locked');
      fs.mkdirSync(locked);
      fs.symlinkSync(path.join(base, 'uploads', 'not-yet'), path.join(locked, 'link'));
      fs.chmodSync(locked, 0o000);
      try {
        for (const downloadDir of [path.join(locked, 'link'), path.join(locked, 'link', 'sub', 'dl')]) {
          expect(
            () => new BetaNodeFilePolicy({ uploadRoots: [path.join(base, 'uploads')], downloadDir }),
          ).toThrow(/downloadDir does not resolve/);
        }
      } finally {
        fs.chmodSync(locked, 0o700);
      }
    },
  );

  it('checks its construction', () => {
    const config = (fn: () => unknown, match: RegExp) => {
      expect(fn).toThrow(ToolsetUsageError);
      expect(fn).toThrow(match);
    };
    expect(() => new BetaNodeFilePolicy({ uploadRoots: '/srv/uploads' as never })).toThrow(TypeError);
    config(() => new BetaNodeFilePolicy({ uploadRoots: [''] }), /non-empty/);
    config(() => new BetaNodeFilePolicy({ downloadDir: ' ' }), /non-empty/);
    // The download-then-upload loop: a download directory inside (or containing) an upload root.
    config(
      () => new BetaNodeFilePolicy({ uploadRoots: [base], downloadDir: path.join(base, 'dl') }),
      /outside every upload root/,
    );
    config(
      () => new BetaNodeFilePolicy({ uploadRoots: [path.join(base, 'up')], downloadDir: base }),
      /outside every upload root/,
    );
    // in another letter case too, on every platform: a macOS disk reads both spellings as one directory
    config(
      () =>
        new BetaNodeFilePolicy({
          uploadRoots: [path.join(base, 'Up')],
          downloadDir: path.join(base, 'up', 'dl'),
        }),
      /outside every upload root/,
    );
    // and in another Unicode form: the same disk reads a composed and a decomposed spelling as one directory
    config(
      () =>
        new BetaNodeFilePolicy({
          uploadRoots: [path.join(base, 't\u00e9l\u00e9')],
          downloadDir: path.join(base, 'te\u0301le\u0301'),
        }),
      /outside every upload root/,
    );
    // The overlap check compares the paths as written: a working symlink into the other directory is not caught, as
    // the `downloadDir` doc says. A link that does not resolve is refused (see the next test).
    fs.mkdirSync(path.join(base, 'uploads', 'dl'), { recursive: true });
    fs.symlinkSync(path.join(base, 'uploads', 'dl'), path.join(base, 'downloads-link'));
    expect(
      () =>
        new BetaNodeFilePolicy({
          uploadRoots: [path.join(base, 'uploads')],
          downloadDir: path.join(base, 'downloads-link'),
        }),
    ).not.toThrow();
    fs.mkdirSync(path.join(base, 'real-downloads'));
    fs.symlinkSync(path.join(base, 'real-downloads'), path.join(base, 'root-link'));
    expect(
      () =>
        new BetaNodeFilePolicy({
          uploadRoots: [path.join(base, 'root-link')],
          downloadDir: path.join(base, 'real-downloads', 'sub'),
        }),
    ).not.toThrow();
    // The constructor runs these checks itself, so a subclass that replaces the upload check cannot skip them.
    class OwnUploads extends BetaNodeFilePolicy {
      override async resolveUploadPaths(_ctx: BetaURLContext, paths: string[]): Promise<string[]> {
        return paths;
      }
    }
    config(
      () => new OwnUploads({ uploadRoots: [base], downloadDir: path.join(base, 'dl') }),
      /outside every upload root/,
    );
    const ok = new BetaNodeFilePolicy({
      uploadRoots: [path.join(base, 'up')],
      downloadDir: path.join(base, 'dl'),
    });
    expect(ok.uploadRoots).toEqual([path.join(base, 'up')]);
    expect(ok.downloadDir).toBe(path.join(base, 'dl'));
  });
});
