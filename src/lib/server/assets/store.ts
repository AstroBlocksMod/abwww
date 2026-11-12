import { config } from '../config.js';
import { assets } from '../db/schema/index.js';
import { writeBlob } from '../platform/blobs.js';
import { db } from '../platform/db.js';
import { md5Hex, sha256Hex } from '../platform/hash.js';

/** `<32 hex md5>.<format>`, the way Scratch names every asset. */
const MD5EXT = /^([0-9a-f]{32})\.([a-z0-9]{1,8})$/;

const CONTENT_TYPES: Record<string, string> = {
	png: 'image/png',
	svg: 'image/svg+xml',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	bmp: 'image/bmp',
	wav: 'audio/wav',
	mp3: 'audio/mpeg'
};

export function parseMd5Ext(name: string): { md5: string; format: string } | null {
	const match = MD5EXT.exec(name);
	if (!match || !match[1] || !match[2]) return null;
	return { md5: match[1], format: match[2] };
}

export function isAllowedFormat(format: string): boolean {
	return format in CONTENT_TYPES;
}

export function contentTypeFor(format: string): string {
	return CONTENT_TYPES[format] ?? 'application/octet-stream';
}

export class AssetError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 413 = 400
	) {
		super(message);
	}
}

export interface StoredAsset {
	sha256: string;
	md5: string;
	size: number;
}

/**
 * Stores bytes under their sha256 and records the row. When the caller knows the md5 the bytes
 * were uploaded under, it is checked, so a file can never be filed under another file's name.
 */
export async function storeAsset(bytes: Uint8Array, expectedMd5?: string): Promise<StoredAsset> {
	if (bytes.byteLength === 0) throw new AssetError('Empty asset');
	if (bytes.byteLength > config.ASSET_MAX_BYTES) {
		throw new AssetError(`Assets can be at most ${config.ASSET_MAX_BYTES} bytes`, 413);
	}
	const md5 = md5Hex(bytes);
	if (expectedMd5 !== undefined && md5 !== expectedMd5) {
		throw new AssetError(`Asset content does not match its name (md5 ${expectedMd5})`);
	}
	const sha256 = sha256Hex(bytes);
	await writeBlob(sha256, bytes);
	await db
		.insert(assets)
		.values({ sha256, size: bytes.byteLength })
		.onConflictDoNothing({ target: assets.sha256 });
	return { sha256, md5, size: bytes.byteLength };
}
