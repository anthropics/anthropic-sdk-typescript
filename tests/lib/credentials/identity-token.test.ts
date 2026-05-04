import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  identityTokenFromFile,
  identityTokenFromValue,
} from '@anthropic-ai/sdk/lib/credentials/identity-token';

describe('identityTokenFromFile', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), 'identity-token-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true });
  });

  it('reads and trims the token from a file', async () => {
    const tokenPath = path.join(testDir, 'token');
    fs.writeFileSync(tokenPath, '  my-jwt-token\n');

    const provider = identityTokenFromFile(tokenPath);
    expect(await provider()).toBe('my-jwt-token');
  });

  it('re-reads the file on every call (supports rotation)', async () => {
    const tokenPath = path.join(testDir, 'token');
    fs.writeFileSync(tokenPath, 'token-v1');

    const provider = identityTokenFromFile(tokenPath);
    expect(await provider()).toBe('token-v1');

    fs.writeFileSync(tokenPath, 'token-v2');
    expect(await provider()).toBe('token-v2');
  });

  it('throws if the file does not exist', async () => {
    const provider = identityTokenFromFile(path.join(testDir, 'missing'));
    await expect(provider()).rejects.toThrow('Failed to read identity token file');
  });

  it('throws if the file is empty', async () => {
    const tokenPath = path.join(testDir, 'token');
    fs.writeFileSync(tokenPath, '   \n');

    const provider = identityTokenFromFile(tokenPath);
    await expect(provider()).rejects.toThrow('is empty');
  });

  it('throws immediately if path is empty', () => {
    expect(() => identityTokenFromFile('')).toThrow('Identity token file path is empty');
  });
});

describe('identityTokenFromValue', () => {
  it('returns the static token', async () => {
    const provider = identityTokenFromValue('static-jwt');
    expect(await provider()).toBe('static-jwt');
  });

  it('throws immediately if value is empty', () => {
    expect(() => identityTokenFromValue('')).toThrow('Identity token value is empty');
  });
});
