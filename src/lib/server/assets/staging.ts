import { kv, kvDelete } from '../platform/kv.js';

/**
 * The editor uploads each changed asset before it saves the project JSON that names it. Those
 * uploads wait here, per user, until a save claims them. Entries expire on their own.
 */
const TTL_SECONDS = 24 * 60 * 60;
const key = (userId: string, md5ext: string) => `staged-asset:${userId}:${md5ext}`;

export async function stageAsset(userId: string, md5ext: string, sha256: string): Promise<void> {
	await kv.send('SET', [key(userId, md5ext), sha256, 'EX', String(TTL_SECONDS)]);
}

export async function readStagedAsset(userId: string, md5ext: string): Promise<string | null> {
	return kv.get(key(userId, md5ext));
}

export async function unstageAssets(userId: string, md5exts: Iterable<string>): Promise<void> {
	await kvDelete(...Array.from(md5exts, (name) => key(userId, name)));
}
