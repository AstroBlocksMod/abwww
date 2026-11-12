import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiCaller, assertScope } from '#lib/server/api/auth.js';
import { contentTypeFor, parseMd5Ext } from '#lib/server/assets/store.js';
import { streamBlob } from '#lib/server/platform/blobs.js';
import { canView, getProject } from '#lib/server/projects/service.js';

/**
 * An asset, by the md5 name project.json uses, resolved through this project's manifest only.
 * The path mirrors Scratch's asset server so the editor can use `/api/projects/<id>` as its
 * asset host once it supports configuring one. scratch-storage asks with a trailing slash.
 */
export const trailingSlash = 'ignore';

export const GET: RequestHandler = async (event) => {
	const id = Number(event.params.id);
	if (!parseMd5Ext(event.params.md5ext)) error(404, 'Not found');
	const project = await getProject(id);
	const caller = await apiCaller(event);
	if (!project || !canView(project, caller?.actor ?? null)) error(404, 'Not found');
	if (caller?.tokenScope) assertScope(caller, id);

	const sha256 = project.assetManifest[event.params.md5ext];
	if (!sha256) error(404, 'This project has no such asset');
	const stream = await streamBlob(sha256);
	if (!stream) error(500, 'Asset bytes are missing');
	const format = event.params.md5ext.split('.')[1] ?? '';
	return new Response(stream, {
		headers: {
			'Content-Type': contentTypeFor(format),
			// Content-addressed, so it never changes under this name within the project.
			'Cache-Control': 'public, max-age=31536000, immutable',
			ETag: `"${sha256}"`,
			// Costumes are user-supplied SVGs. Opened directly, they must not run scripts on this
			// origin; as images they render fine with these headers.
			'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
