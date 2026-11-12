import { expect, test } from 'bun:test';
import { safeRedirect } from './redirect.js';

const origin = 'https://example.test';

test('keeps paths on this site', () => {
	expect(safeRedirect('/settings', origin)).toBe('/settings');
	expect(safeRedirect('/projects/1?v=abc#top', origin)).toBe('/projects/1?v=abc#top');
});

test('refuses anything that leaves the site', () => {
	expect(safeRedirect(null, origin)).toBe('/');
	expect(safeRedirect('https://evil.test/', origin)).toBe('/');
	expect(safeRedirect('//evil.test/', origin)).toBe('/');
	expect(safeRedirect('/\\evil.test/', origin)).toBe('/');
	expect(safeRedirect('javascript:alert(1)', origin)).toBe('/');
});
