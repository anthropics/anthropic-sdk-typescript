/**
 * The one module under `src/` that may import Node built-ins (eslint enforces this).
 * The package.json `browser` field swaps it for `./node.browser`, so only touch its
 * exports on code paths that run on Node-compatible runtimes.
 */
import * as child_process from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as stream from 'node:stream';
import * as util from 'node:util';

export { child_process, crypto, fs, os, path, stream, util };
