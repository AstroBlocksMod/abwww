import * as nodeFs from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';

/**
 * The filesystem that git repositories live on. isomorphic-git wants a Node-style `fs`; local disk
 * for now, under `DATA_DIR/git`. Swapping in object storage means handing isomorphic-git another
 * object with the same methods from this file.
 */
export const gitFs = nodeFs;

export function gitRoot(): string {
	return join(config.DATA_DIR, 'git');
}

export async function ensureDir(path: string): Promise<void> {
	await mkdir(path, { recursive: true });
}

export async function removeDir(path: string): Promise<void> {
	await rm(path, { recursive: true, force: true });
}

export function fileExists(path: string): Promise<boolean> {
	return Bun.file(path).exists();
}

/** A streaming response for a file on disk, or null when there is no such file. */
export async function fileResponse(
	path: string,
	headers: Record<string, string>
): Promise<Response | null> {
	const file = Bun.file(path);
	if (!(await file.exists())) return null;
	return new Response(file, {
		headers: { 'Content-Type': file.type || 'application/octet-stream', ...headers }
	});
}
