import { mkdir, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { config } from '../config.js';
import { randomToken } from './ids.js';

/**
 * Content-addressed blob storage, keyed by the sha256 of the bytes. Local disk for now, under
 * `DATA_DIR/assets`. Object storage later means reimplementing this file only.
 */

const HEX64 = /^[0-9a-f]{64}$/;

function pathFor(sha256: string): string {
	if (!HEX64.test(sha256)) throw new Error(`Not a sha256 hex digest: ${sha256}`);
	return join(config.DATA_DIR, 'assets', sha256.slice(0, 2), sha256);
}

export async function blobExists(sha256: string): Promise<boolean> {
	return Bun.file(pathFor(sha256)).exists();
}

/** The stored bytes, or null when the blob is missing. */
export async function readBlob(sha256: string): Promise<Uint8Array | null> {
	const file = Bun.file(pathFor(sha256));
	if (!(await file.exists())) return null;
	return file.bytes();
}

/** A stream of the stored bytes, for serving large assets without buffering them. */
export async function streamBlob(sha256: string): Promise<ReadableStream<Uint8Array> | null> {
	const file = Bun.file(pathFor(sha256));
	if (!(await file.exists())) return null;
	return file.stream();
}

/**
 * Stores bytes under their digest. Writes to a temporary file first and renames it, so a crash
 * never leaves a half-written blob that later reads would trust.
 */
export async function writeBlob(sha256: string, data: Uint8Array): Promise<void> {
	const target = pathFor(sha256);
	if (await Bun.file(target).exists()) return;
	await mkdir(dirname(target), { recursive: true });
	const temp = `${target}.${randomToken(8)}.tmp`;
	try {
		await Bun.write(temp, data);
		await rename(temp, target);
	} catch (error) {
		await unlink(temp).catch(() => {});
		throw error;
	}
}
