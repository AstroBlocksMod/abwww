export function sha256Hex(data: Uint8Array | string): string {
	return new Bun.CryptoHasher('sha256').update(data).digest('hex');
}

/** Only for Scratch's legacy asset names. Never use md5 to decide whether two files are the same. */
export function md5Hex(data: Uint8Array | string): string {
	return new Bun.CryptoHasher('md5').update(data).digest('hex');
}
