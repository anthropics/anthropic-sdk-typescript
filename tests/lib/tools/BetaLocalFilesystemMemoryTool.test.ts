import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { BetaLocalFilesystemMemoryTool, betaMemoryTool } from '../../../src/tools/memory/node';
import type { BetaMemoryTool20250818Command } from '../../../src/resources/beta';
import { runRunnableTool } from '../../../src/lib/tools/BetaRunnableTool';

// Keep real filesystem operations, but let failure-path tests replace individual calls.
jest.mock('fs/promises', () => ({ __esModule: true, ...jest.requireActual('fs/promises') }));

async function getDirectorySnapshot(basePath: string): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(basePath, fullPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        snapshot[relativePath] = content;
      }
    }
  }

  try {
    await walk(basePath);
  } catch (error) {
    // Directory might not exist or be empty
  }

  return snapshot;
}

describe('BetaLocalFilesystemMemoryTool', () => {
  let tempDir: string;
  let tool: BetaLocalFilesystemMemoryTool;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'memory-test-'));
    tool = await BetaLocalFilesystemMemoryTool.init(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('should create a file successfully', async () => {
      const result = await tool.create({
        command: 'create',
        file_text: 'Hello, World!',
        path: '/memories/test_file.txt',
      });

      expect(result).toBe('File created successfully at: /memories/test_file.txt');

      const dirSnapshot = await getDirectorySnapshot(tempDir);
      expect(dirSnapshot).toEqual({
        'memories/test_file.txt': 'Hello, World!',
      });
    });

    it('should create nested directories', async () => {
      const result = await tool.create({
        command: 'create',
        file_text: 'Nested file',
        path: '/memories/deep/nested/file.txt',
      });

      expect(result).toBe('File created successfully at: /memories/deep/nested/file.txt');

      const dirSnapshot = await getDirectorySnapshot(tempDir);
      expect(dirSnapshot).toEqual({
        'memories/deep/nested/file.txt': 'Nested file',
      });
    });

    it('should error if file already exists', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Original',
        path: '/memories/existing.txt',
      });

      await expect(
        tool.create({
          command: 'create',
          file_text: 'New',
          path: '/memories/existing.txt',
        }),
      ).rejects.toThrow('File /memories/existing.txt already exists');
    });
  });

  describe('view', () => {
    it('should view a file with line numbers', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Line 1\nLine 2\nLine 3',
        path: '/memories/view_test.txt',
      });

      const result = await tool.view({
        command: 'view',
        path: '/memories/view_test.txt',
      });

      expect(result).toMatchInlineSnapshot(`
"Here's the content of /memories/view_test.txt with line numbers:
     1	Line 1
     2	Line 2
     3	Line 3"
`);
    });

    it('should view a directory', async () => {
      await tool.create({
        command: 'create',
        file_text: 'File 1',
        path: '/memories/dir/file1.txt',
      });

      await tool.create({
        command: 'create',
        file_text: 'File 2',
        path: '/memories/dir/file2.txt',
      });

      const result = await tool.view({
        command: 'view',
        path: '/memories/dir',
      });

      expect(result).toContain("Here're the files and directories up to 2 levels deep in /memories/dir");
      expect(result).toContain('/memories/dir');
      expect(result).toContain('/memories/dir/file1.txt');
      expect(result).toContain('/memories/dir/file2.txt');
    });

    it('should view file with range', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
        path: '/memories/range_test.txt',
      });

      const result = await tool.view({
        command: 'view',
        path: '/memories/range_test.txt',
        view_range: [2, 4],
      });

      expect(result).toMatchInlineSnapshot(`
"Here's the content of /memories/range_test.txt with line numbers:
     2	Line 2
     3	Line 3
     4	Line 4"
`);
    });

    it('should error for non-existent file', async () => {
      await expect(
        tool.view({
          command: 'view',
          path: '/memories/nonexistent.txt',
        }),
      ).rejects.toThrow('The path /memories/nonexistent.txt does not exist. Please provide a valid path.');
    });

    it('should error for files with too many lines', async () => {
      const tooManyLines = Array(1000000).fill('line').join('\n');
      await tool.create({
        command: 'create',
        file_text: tooManyLines,
        path: '/memories/huge.txt',
      });

      await expect(
        tool.view({
          command: 'view',
          path: '/memories/huge.txt',
        }),
      ).rejects.toThrow(/Maximum is 999,999 lines/);
    });
  });

  describe('str_replace', () => {
    it('should replace string in file', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Line 1\nOld Text\nLine 3',
        path: '/memories/replace_test.txt',
      });

      const result = await tool.str_replace({
        command: 'str_replace',
        path: '/memories/replace_test.txt',
        old_str: 'Old Text',
        new_str: 'New Text',
      });

      expect(result).toMatchInlineSnapshot(`
"The memory file has been edited. Here is the snippet showing the change (with line numbers):
     1	Line 1
     2	New Text
     3	Line 3"
`);

      const dirSnapshot = await getDirectorySnapshot(tempDir);
      expect(dirSnapshot).toEqual({
        'memories/replace_test.txt': 'Line 1\nNew Text\nLine 3',
      });
    });

    it('should throw error when string not found', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Hello, World!',
        path: '/memories/replace_test.txt',
      });

      await expect(
        tool.str_replace({
          command: 'str_replace',
          path: '/memories/replace_test.txt',
          old_str: 'NotFound',
          new_str: 'Python',
        }),
      ).rejects.toThrow(
        'No replacement was performed, old_str `NotFound` did not appear verbatim in /memories/replace_test.txt.',
      );
    });

    it('should throw error when string appears multiple times', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Hello\nMiddle\nHello',
        path: '/memories/replace_test.txt',
      });

      await expect(
        tool.str_replace({
          command: 'str_replace',
          path: '/memories/replace_test.txt',
          old_str: 'Hello',
          new_str: 'Hi',
        }),
      ).rejects.toThrow(
        'No replacement was performed. Multiple occurrences of old_str `Hello` in lines: 1, 3. Please ensure it is unique',
      );
    });

    it('should throw error for non-existent file', async () => {
      await expect(
        tool.str_replace({
          command: 'str_replace',
          path: '/memories/nonexistent.txt',
          old_str: 'old',
          new_str: 'new',
        }),
      ).rejects.toThrow('The path /memories/nonexistent.txt does not exist. Please provide a valid path.');
    });
  });

  describe('insert', () => {
    it('should insert text at specified line', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Line 1\nLine 2',
        path: '/memories/insert_test.txt',
      });

      const result = await tool.insert({
        command: 'insert',
        path: '/memories/insert_test.txt',
        insert_line: 1,
        insert_text: 'Inserted Line',
      });

      expect(result).toBe('The file /memories/insert_test.txt has been edited.');

      const dirSnapshot = await getDirectorySnapshot(tempDir);
      expect(dirSnapshot).toEqual({
        'memories/insert_test.txt': 'Line 1\nInserted Line\nLine 2',
      });
    });

    it('should insert at beginning of file', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Line 1\nLine 2',
        path: '/memories/insert_test.txt',
      });

      await tool.insert({
        command: 'insert',
        path: '/memories/insert_test.txt',
        insert_line: 0,
        insert_text: 'First Line',
      });

      const dirSnapshot = await getDirectorySnapshot(tempDir);
      expect(dirSnapshot).toEqual({
        'memories/insert_test.txt': 'First Line\nLine 1\nLine 2',
      });
    });

    it('should insert at end of file', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Line 1\nLine 2',
        path: '/memories/insert_test.txt',
      });

      await tool.insert({
        command: 'insert',
        path: '/memories/insert_test.txt',
        insert_line: 2,
        insert_text: 'Last Line',
      });

      const dirSnapshot = await getDirectorySnapshot(tempDir);
      expect(dirSnapshot).toEqual({
        'memories/insert_test.txt': 'Line 1\nLine 2\nLast Line',
      });
    });

    it('should throw error for non-existent file', async () => {
      await expect(
        tool.insert({
          command: 'insert',
          path: '/memories/nonexistent.txt',
          insert_line: 0,
          insert_text: 'text',
        }),
      ).rejects.toThrow('The path /memories/nonexistent.txt does not exist. Please provide a valid path.');
    });

    it('should throw error for invalid insert_line', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Line 1\nLine 2',
        path: '/memories/insert_test.txt',
      });

      await expect(
        tool.insert({
          command: 'insert',
          path: '/memories/insert_test.txt',
          insert_line: 10,
          insert_text: 'text',
        }),
      ).rejects.toThrow(
        'Invalid `insert_line` parameter: 10. It should be within the range of lines of the file: [0, 2]',
      );
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      await tool.create({
        command: 'create',
        file_text: 'To be deleted',
        path: '/memories/delete_me.txt',
      });

      const result = await tool.delete({
        command: 'delete',
        path: '/memories/delete_me.txt',
      });

      expect(result).toBe('Successfully deleted /memories/delete_me.txt');

      const dirSnapshot = await getDirectorySnapshot(tempDir);
      expect(dirSnapshot).toEqual({});
    });

    it('should delete a directory', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Content',
        path: '/memories/subdir/file.txt',
      });

      const result = await tool.delete({
        command: 'delete',
        path: '/memories/subdir',
      });

      expect(result).toBe('Successfully deleted /memories/subdir');

      const dirSnapshot = await getDirectorySnapshot(tempDir);
      expect(dirSnapshot).toEqual({});
    });

    it('should throw error when file not found', async () => {
      await expect(
        tool.delete({
          command: 'delete',
          path: '/memories/nonexistent.txt',
        }),
      ).rejects.toThrow('The path /memories/nonexistent.txt does not exist');
    });

    it('should not allow deleting /memories directory', async () => {
      await expect(
        tool.delete({
          command: 'delete',
          path: '/memories',
        }),
      ).rejects.toThrow('Cannot delete the /memories directory itself');
    });
  });

  describe('rename', () => {
    it.each(['/memories', '/memories/', '/memories/.', '/memories/dir/..'])(
      'should reject renaming the root through %s without changing files',
      async (rootPath) => {
        await tool.create({ command: 'create', path: '/memories/file.txt', file_text: 'keep' });
        const before = await getDirectorySnapshot(tempDir);

        for (const [old_path, new_path] of [
          [rootPath, '/memories/archive'],
          ['/memories/file.txt', rootPath],
        ] as const) {
          await expect(tool.rename({ command: 'rename', old_path, new_path })).rejects.toThrow(
            'Cannot rename the /memories directory itself',
          );
          expect(await getDirectorySnapshot(tempDir)).toEqual(before);
          expect(await fs.readdir(path.join(tempDir, 'memories'))).toEqual(['file.txt']);
        }
      },
    );

    it('should report a directory rename into itself without exposing host paths', async () => {
      await tool.create({ command: 'create', path: '/memories/a/file.txt', file_text: 'keep' });

      const error = await tool
        .rename({ command: 'rename', old_path: '/memories/a', new_path: '/memories/a/sub' })
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('/memories/a');
      expect(String(error)).not.toContain(tempDir);
      expect(await getDirectorySnapshot(tempDir)).toEqual({ 'memories/a/file.txt': 'keep' });
    });

    it('should rename a file', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Original content',
        path: '/memories/old_name.txt',
      });

      const result = await tool.rename({
        command: 'rename',
        old_path: '/memories/old_name.txt',
        new_path: '/memories/new_name.txt',
      });

      expect(result).toBe('Successfully renamed /memories/old_name.txt to /memories/new_name.txt');

      const dirSnapshot = await getDirectorySnapshot(tempDir);
      expect(dirSnapshot).toEqual({
        'memories/new_name.txt': 'Original content',
      });
    });

    it('should rename to a nested path', async () => {
      await tool.create({
        command: 'create',
        file_text: 'Content',
        path: '/memories/file.txt',
      });

      const result = await tool.rename({
        command: 'rename',
        old_path: '/memories/file.txt',
        new_path: '/memories/nested/dir/file.txt',
      });

      expect(result).toBe('Successfully renamed /memories/file.txt to /memories/nested/dir/file.txt');

      const dirSnapshot = await getDirectorySnapshot(tempDir);
      expect(dirSnapshot).toEqual({
        'memories/nested/dir/file.txt': 'Content',
      });
    });

    it('should throw error when source not found', async () => {
      await expect(
        tool.rename({
          command: 'rename',
          old_path: '/memories/nonexistent.txt',
          new_path: '/memories/new.txt',
        }),
      ).rejects.toThrow('The path /memories/nonexistent.txt does not exist');
    });

    it('should throw error when destination exists', async () => {
      await tool.create({
        command: 'create',
        file_text: 'File 1',
        path: '/memories/file1.txt',
      });

      await tool.create({
        command: 'create',
        file_text: 'File 2',
        path: '/memories/file2.txt',
      });

      await expect(
        tool.rename({
          command: 'rename',
          old_path: '/memories/file1.txt',
          new_path: '/memories/file2.txt',
        }),
      ).rejects.toThrow('The destination /memories/file2.txt already exists');
    });
  });

  describe('path validation', () => {
    it('should reject paths not starting with /memories', async () => {
      await expect(
        tool.create({
          command: 'create',
          file_text: 'Invalid',
          path: '/invalid/path.txt',
        }),
      ).rejects.toThrow('Path must start with /memories');
    });

    it('should reject paths trying to escape /memories', async () => {
      await expect(
        tool.create({
          command: 'create',
          file_text: 'Escape attempt',
          path: '/memories/../../../etc/passwd',
        }),
      ).rejects.toThrow('Path /memories/../../../etc/passwd would escape /memories directory');
    });
  });

  describe('filesystem errors', () => {
    const invalidPath = '/memories/file.txt/child.txt';
    const commands: BetaMemoryTool20250818Command[] = [
      { command: 'view', path: invalidPath },
      { command: 'create', path: invalidPath, file_text: 'new' },
      { command: 'str_replace', path: invalidPath, old_str: 'old', new_str: 'new' },
      { command: 'insert', path: invalidPath, insert_line: 0, insert_text: 'new' },
      { command: 'delete', path: invalidPath },
      { command: 'rename', old_path: invalidPath, new_path: '/memories/new.txt' },
      { command: 'rename', old_path: '/memories/file.txt', new_path: invalidPath },
    ];

    it.each(commands)('should use virtual paths for $command with a file as a parent', async (command) => {
      await tool.create({ command: 'create', path: '/memories/file.txt', file_text: 'old' });
      const memory = betaMemoryTool(tool);
      const error = await Promise.resolve(memory.run(command)).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(`A parent of ${invalidPath} is a file, not a directory`);
      expect(String(error)).not.toContain(tempDir);
      expect(error).not.toHaveProperty('cause');
      expect(error).not.toHaveProperty('path');
      expect(error).not.toHaveProperty('dest');
      expect(await getDirectorySnapshot(tempDir)).toEqual({ 'memories/file.txt': 'old' });
    });

    const failures: Array<{
      syscall: 'readdir' | 'readFile' | 'mkdir' | 'open' | 'rename' | 'rm';
      command: BetaMemoryTool20250818Command;
      code: string;
      message: string;
    }> = [
      {
        syscall: 'readdir',
        command: { command: 'view', path: '/memories' },
        code: 'EIO',
        message: 'Filesystem operation failed for /memories (EIO)',
      },
      {
        syscall: 'readFile',
        command: { command: 'view', path: '/memories/file.txt' },
        code: 'EACCES',
        message: 'Permission denied for /memories/file.txt',
      },
      {
        syscall: 'mkdir',
        command: { command: 'create', path: '/memories/new.txt', file_text: 'new' },
        code: 'EPERM',
        message: 'Permission denied for /memories/new.txt',
      },
      {
        syscall: 'open',
        command: { command: 'create', path: '/memories/new.txt', file_text: 'new' },
        code: 'EIO',
        message: 'Filesystem operation failed for /memories/new.txt (EIO)',
      },
      {
        syscall: 'open',
        command: { command: 'insert', path: '/memories/file.txt', insert_line: 0, insert_text: 'new' },
        code: 'EIO',
        message: 'Filesystem operation failed for /memories/file.txt (EIO)',
      },
      {
        syscall: 'rename',
        command: { command: 'str_replace', path: '/memories/file.txt', old_str: 'old', new_str: 'new' },
        code: 'EIO',
        message: 'Filesystem operation failed for /memories/file.txt (EIO)',
      },
      {
        syscall: 'rm',
        command: { command: 'delete', path: '/memories/file.txt' },
        code: 'EIO',
        message: 'Filesystem operation failed for /memories/file.txt (EIO)',
      },
      {
        syscall: 'rename',
        command: { command: 'rename', old_path: '/memories/file.txt', new_path: '/memories/new.txt' },
        code: 'EINVAL',
        message: 'Invalid filesystem operation for /memories/file.txt to /memories/new.txt',
      },
    ];

    it.each(failures)(
      'should sanitize $syscall errors from $command.command for the tool runner',
      async ({ syscall, command, code, message }) => {
        await tool.create({ command: 'create', path: '/memories/file.txt', file_text: 'old' });
        const hostPath = path.join(tempDir, 'memories', 'file.txt');
        const rawError = Object.assign(new Error(`${code}: ${syscall} '${hostPath}'`), {
          code,
          syscall,
          path: hostPath,
          dest: path.join(tempDir, 'memories', 'new.txt'),
          cause: new Error(`Private host path: ${hostPath}`),
        });
        const spy = jest.spyOn(fs, syscall).mockRejectedValueOnce(rawError);

        try {
          const toolUse = { type: 'tool_use' as const, id: 'memory_1', name: 'memory', input: command };
          const result = await runRunnableTool(betaMemoryTool(tool), command, {
            toolUse,
            toolUseBlock: toolUse,
          });
          expect(result).toEqual({ isError: true, content: `Error: ${message}` });
          expect(JSON.stringify(result)).not.toContain(tempDir);
        } finally {
          spy.mockRestore();
        }

        expect(await getDirectorySnapshot(tempDir)).toEqual({ 'memories/file.txt': 'old' });
        expect(await fs.readdir(path.join(tempDir, 'memories'))).toEqual(['file.txt']);
      },
    );
  });

  describe('sibling directory prefix attack', () => {
    it('should reject symlink to a sibling directory whose name shares the memory root prefix', async () => {
      // Attack: create a sibling directory memories_backup next to memories,
      // then symlink from inside memories to it. Without the trailing separator
      // fix, validateNoSymlinkEscape's startsWith check would pass because
      // "/tmp/.../memories_backup".startsWith("/tmp/.../memories") is true.
      const memoriesDir = path.join(tempDir, 'memories');
      const siblingDir = path.join(tempDir, 'memories_backup');
      await fs.mkdir(siblingDir, { recursive: true });
      await fs.writeFile(path.join(siblingDir, 'secret.txt'), 'stolen data', 'utf-8');

      // Symlink from inside memories to the sibling
      await fs.symlink(siblingDir, path.join(memoriesDir, 'escape_link'), 'dir');

      await expect(
        tool.view({
          command: 'view',
          path: '/memories/escape_link/secret.txt',
        }),
      ).rejects.toThrow('would escape /memories directory');
    });

    it('should reject path traversal to a sibling prefix-matching directory', async () => {
      const siblingDir = path.join(tempDir, 'memories_backup');
      await fs.mkdir(siblingDir, { recursive: true });
      await fs.writeFile(path.join(siblingDir, 'secret.txt'), 'stolen data', 'utf-8');

      await expect(
        tool.view({
          command: 'view',
          path: '/memories/../memories_backup/secret.txt',
        }),
      ).rejects.toThrow('would escape /memories directory');
    });
  });

  describe('symlink validation', () => {
    let outsideDir: string;

    beforeEach(async () => {
      outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outside-'));
      await fs.writeFile(path.join(outsideDir, 'secret.txt'), 'sensitive data', 'utf-8');
    });

    afterEach(async () => {
      await fs.rm(outsideDir, { recursive: true, force: true });
    });

    it('should reject symlink pointing outside /memories', async () => {
      const memoriesPath = path.join(tempDir, 'memories');
      const symlinkPath = path.join(memoriesPath, 'escape_link');

      await fs.symlink(outsideDir, symlinkPath, 'dir');

      await expect(
        tool.view({
          command: 'view',
          path: '/memories/escape_link/secret.txt',
        }),
      ).rejects.toThrow('Path would escape /memories directory via symlink');
    });

    it('should reject creating files through symlink pointing outside', async () => {
      const memoriesPath = path.join(tempDir, 'memories');
      const symlinkPath = path.join(memoriesPath, 'bad_link');

      await fs.symlink(outsideDir, symlinkPath, 'dir');

      await expect(
        tool.create({
          command: 'create',
          file_text: 'malicious content',
          path: '/memories/bad_link/hacked.txt',
        }),
      ).rejects.toThrow('Path would escape /memories directory via symlink');
    });

    it('should reject parent directory that is a symlink pointing outside', async () => {
      const memoriesPath = path.join(tempDir, 'memories');
      const symlinkDirPath = path.join(memoriesPath, 'subdir');

      await fs.symlink(outsideDir, symlinkDirPath, 'dir');

      await expect(
        tool.create({
          command: 'create',
          file_text: 'content',
          path: '/memories/subdir/nested/file.txt',
        }),
      ).rejects.toThrow('Path would escape /memories directory via symlink');
    });
  });

  describe('line endings', () => {
    const CRLF_CONTENT = 'line1\r\nline2\r\nline3\r\n';

    async function writeRaw(name: string, content: string): Promise<string> {
      const filePath = path.join(tempDir, 'memories', name);
      await fs.writeFile(filePath, Buffer.from(content, 'utf-8'));
      return filePath;
    }

    it('view returns CRLF line endings intact', async () => {
      await writeRaw('crlf.txt', CRLF_CONTENT);

      const result = await tool.view({ command: 'view', path: '/memories/crlf.txt' });

      // view splits on '\n' only, so each numbered line keeps its trailing '\r'.
      expect(result).toBe(
        "Here's the content of /memories/crlf.txt with line numbers:\n" +
          '     1\tline1\r\n' +
          '     2\tline2\r\n' +
          '     3\tline3\r\n' +
          '     4\t',
      );
      expect(result).toContain('line1\r\n');
      expect(result).not.toMatch(/line\d(?!\r)\n/);
    });

    it('str_replace leaves CRLF bytes on disk untouched', async () => {
      const filePath = await writeRaw('crlf.txt', CRLF_CONTENT);

      await tool.str_replace({
        command: 'str_replace',
        path: '/memories/crlf.txt',
        old_str: 'line2',
        new_str: 'LINE2',
      });

      const onDisk = await fs.readFile(filePath);
      expect(onDisk.equals(Buffer.from('line1\r\nLINE2\r\nline3\r\n', 'utf-8'))).toBe(true);
    });

    it("insert does not rewrite the other lines' CRLF endings", async () => {
      const filePath = await writeRaw('crlf.txt', CRLF_CONTENT);

      await tool.insert({
        command: 'insert',
        path: '/memories/crlf.txt',
        insert_line: 1,
        insert_text: 'inserted',
      });

      // The inserted line is joined with '\n'; the pre-existing lines keep their '\r\n'.
      const onDisk = await fs.readFile(filePath);
      expect(onDisk.equals(Buffer.from('line1\r\ninserted\nline2\r\nline3\r\n', 'utf-8'))).toBe(true);
    });
  });

  describe('file permissions', () => {
    const itPosix = process.platform === 'win32' ? it.skip : it;
    let prevUmask: number;

    beforeEach(() => {
      prevUmask = process.umask(0o000);
    });

    afterEach(() => {
      process.umask(prevUmask);
    });

    itPosix('should create the memory root with mode 0o700', async () => {
      const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'memory-perm-'));
      try {
        await BetaLocalFilesystemMemoryTool.init(freshDir);
        const stat = await fs.stat(path.join(freshDir, 'memories'));
        expect(stat.mode & 0o777).toBe(0o700);
      } finally {
        await fs.rm(freshDir, { recursive: true, force: true });
      }
    });

    itPosix('should create files with mode 0o600', async () => {
      await tool.create({
        command: 'create',
        file_text: 'secret',
        path: '/memories/perm-test.txt',
      });

      const stat = await fs.stat(path.join(tempDir, 'memories', 'perm-test.txt'));
      expect(stat.mode & 0o777).toBe(0o600);
    });

    itPosix('should create intermediate directories with mode 0o700', async () => {
      await tool.create({
        command: 'create',
        file_text: 'secret',
        path: '/memories/nested/perm-test.txt',
      });

      const stat = await fs.stat(path.join(tempDir, 'memories', 'nested'));
      expect(stat.mode & 0o777).toBe(0o700);
    });

    itPosix('should create rename destination directories with mode 0o700', async () => {
      await tool.create({
        command: 'create',
        file_text: 'x',
        path: '/memories/src.txt',
      });
      await tool.rename({
        command: 'rename',
        old_path: '/memories/src.txt',
        new_path: '/memories/renamed/dst.txt',
      });

      const stat = await fs.stat(path.join(tempDir, 'memories', 'renamed'));
      expect(stat.mode & 0o777).toBe(0o700);
    });

    itPosix('should write atomic temp files with mode 0o600', async () => {
      await tool.create({
        command: 'create',
        file_text: 'old',
        path: '/memories/perm-test.txt',
      });
      await tool.str_replace({
        command: 'str_replace',
        path: '/memories/perm-test.txt',
        old_str: 'old',
        new_str: 'new',
      });

      const stat = await fs.stat(path.join(tempDir, 'memories', 'perm-test.txt'));
      expect(stat.mode & 0o777).toBe(0o600);
    });
  });
});
