/**
 * zstd for stored project JSON. Level 9 is a good trade between size and the time a save takes;
 * decompression speed barely depends on it.
 */
const LEVEL = 9;

export async function compress(data: Uint8Array | string): Promise<Uint8Array> {
	return Bun.zstdCompress(data, { level: LEVEL });
}

export async function decompress(data: Uint8Array): Promise<Uint8Array> {
	return Bun.zstdDecompress(data);
}

/** Whether an `Accept-Encoding` header admits zstd, so compressed bytes can go out untouched. */
export function acceptsZstd(acceptEncoding: string | null): boolean {
	if (!acceptEncoding) return false;
	return acceptEncoding
		.split(',')
		.map((part) => part.trim())
		.some((part) => {
			const [coding, ...params] = part.split(';').map((s) => s.trim());
			if (coding !== 'zstd') return false;
			const q = params.find((p) => p.startsWith('q='));
			return q === undefined || Number(q.slice(2)) > 0;
		});
}
