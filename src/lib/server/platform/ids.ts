/** Time-ordered UUIDs, so primary keys index well and sort by creation. */
export function newId(): string {
	return Bun.randomUUIDv7();
}

/** A random, URL-safe secret. 32 bytes gives 256 bits, plenty for sessions and tokens. */
export function randomToken(bytes = 32): string {
	const buffer = new Uint8Array(bytes);
	crypto.getRandomValues(buffer);
	return Buffer.from(buffer).toString('base64url');
}

/** A short code people can type or paste into a comment. Unambiguous letters and digits only. */
export function humanCode(length = 8): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const buffer = new Uint8Array(length);
	crypto.getRandomValues(buffer);
	let out = '';
	for (const byte of buffer) out += alphabet[byte % alphabet.length];
	return out;
}
