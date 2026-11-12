import { error } from '@sveltejs/kit';
import { join, normalize, resolve, sep } from 'node:path';
import type { RequestHandler } from './$types';
import { config } from '#lib/server/config.js';
import { fileResponse } from '#lib/server/platform/fs.js';

/**
 * Serves the editor's static build (editor.html, embed.html, its JavaScript and media) from
 * EDITOR_DIR. The directory is configured at run time, which is why this is a route and not part of
 * SvelteKit's `static/`. In production, point a separate hostname at this app and set EDITOR_URL to
 * it, so the editor never shares the site's origin.
 */
const CACHE_FOREVER = 'public, max-age=31536000, immutable';
const CACHE_SHORT = 'public, max-age=300';

export const GET: RequestHandler = async ({ params }) => {
	const root = resolve(config.EDITOR_DIR);
	const requested = params.path === '' ? 'editor.html' : params.path;
	const target = normalize(join(root, requested));
	if (target !== root && !target.startsWith(root + sep)) error(404, 'Not found');

	// Hashed bundles are immutable; HTML and anything unhashed may change with the next build.
	const hashed =
		/\.[0-9a-f]{8,}\.(js|css|wasm|map|woff2?)$/.test(requested) || requested.includes('/assets/');
	const response = await fileResponse(target, {
		'Cache-Control': hashed ? CACHE_FOREVER : CACHE_SHORT,
		// The player runs in a sandboxed frame and fetches its own fonts.
		'Access-Control-Allow-Origin': '*'
	});
	if (!response) error(404, 'The editor is not installed on this instance (EDITOR_DIR is empty)');
	return response;
};
