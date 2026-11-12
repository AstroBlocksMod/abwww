import { expect, test } from 'bun:test';
import { md5Hex, sha256Hex } from './hash.js';

test('digests match the known vectors', () => {
	expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
	expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(sha256Hex('abc'));
});
