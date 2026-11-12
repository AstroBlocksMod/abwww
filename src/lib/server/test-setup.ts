import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Preloaded by `bun test` (see bunfig.toml) before any server module reads its configuration.
 * Tests get a throwaway data directory and, when set, their own database and Valkey.
 */
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'abwww-test-'));
process.env.ORIGIN ??= 'http://localhost:5173';
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
if (process.env.TEST_VALKEY_URL) process.env.VALKEY_URL = process.env.TEST_VALKEY_URL;
