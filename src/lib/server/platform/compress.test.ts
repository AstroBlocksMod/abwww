import { describe, expect, test } from 'bun:test';
import { acceptsZstd, compress, decompress } from './compress.js';

describe('compress', () => {
	test('round-trips bytes and shrinks repetitive JSON', async () => {
		const json = JSON.stringify({
			targets: Array.from({ length: 200 }, (_, i) => ({ name: `Sprite${i}` }))
		});
		const compressed = await compress(json);
		expect(compressed.byteLength).toBeLessThan(json.length / 4);
		expect(new TextDecoder().decode(await decompress(compressed))).toBe(json);
	});
});

describe('acceptsZstd', () => {
	test('reads Accept-Encoding the way browsers send it', () => {
		expect(acceptsZstd('gzip, deflate, br, zstd')).toBe(true);
		expect(acceptsZstd('zstd;q=0.9, gzip')).toBe(true);
		expect(acceptsZstd('gzip, deflate, br')).toBe(false);
		expect(acceptsZstd('zstd;q=0')).toBe(false);
		expect(acceptsZstd(null)).toBe(false);
	});
});
