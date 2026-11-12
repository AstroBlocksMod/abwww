import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiCaller, assertScope, requireApiCaller } from '#lib/server/api/auth.js';
import { readProjectJsonBody } from '#lib/server/api/body.js';
import { mapErrors } from '#lib/server/api/errors.js';
import { bytesResponse } from '#lib/server/api/response.js';
import { readSnapshot } from '#lib/server/git/repo.js';
import { acceptsZstd, decompress } from '#lib/server/platform/compress.js';
import { canView, deleteProject, getProject, saveProject } from '#lib/server/projects/service.js';
import { enforceRateLimit } from '#lib/server/ratelimit.js';

function projectIdParam(id: string): number {
	const value = Number(id);
	if (!/^\d+$/.test(id) || !Number.isSafeInteger(value)) error(404, 'Project not found');
	return value;
}

/**
 * The current project.json. Stored compressed, so when the client accepts zstd the stored bytes
 * go out as they are. `?version=<commit>` serves an older version instead.
 */
export const GET: RequestHandler = async (event) => {
	const id = projectIdParam(event.params.id);
	const project = await getProject(id);
	const caller = await apiCaller(event);
	if (!project || !canView(project, caller?.actor ?? null)) error(404, 'Project not found');
	if (caller?.tokenScope) assertScope(caller, id);

	const version = event.url.searchParams.get('version');
	const headers = new Headers({
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control':
			project.visibility === 'public' && !version ? 'public, max-age=30' : 'private, no-store',
		Vary: 'Accept-Encoding, Authorization'
	});
	if (version) {
		const snapshot = await readSnapshot(project.id, version);
		if (!snapshot) error(404, 'That version does not exist');
		return new Response(snapshot.projectJson, { headers });
	}
	headers.set('ETag', `"${project.projectJsonSha256}"`);
	if (event.request.headers.get('if-none-match') === `"${project.projectJsonSha256}"`) {
		return new Response(null, { status: 304, headers });
	}
	if (acceptsZstd(event.request.headers.get('accept-encoding'))) {
		headers.set('Content-Encoding', 'zstd');
		return bytesResponse(project.projectJson, { headers });
	}
	headers.set('Content-Length', String(project.projectJsonSize));
	return bytesResponse(await decompress(project.projectJson), { headers });
};

/** Saves new content. Assets it names must be in the project already or uploaded beforehand. */
export const PUT: RequestHandler = async (event) => {
	const id = projectIdParam(event.params.id);
	const caller = await requireApiCaller(event);
	assertScope(caller, id);
	await enforceRateLimit('project-save', caller.actor.id, 600, 60 * 60);
	const body = await readProjectJsonBody(event.request);
	const project = await mapErrors(() =>
		saveProject({
			projectId: id,
			actor: caller.actor,
			projectJson: body,
			message: 'Save from editor'
		})
	);
	return Response.json({ status: 'ok', id: project.id, autosave_interval: '120' });
};

export const DELETE: RequestHandler = async (event) => {
	const id = projectIdParam(event.params.id);
	const caller = await requireApiCaller(event);
	if (caller.tokenScope) error(403, 'Editor tokens cannot delete projects');
	const project = await getProject(id);
	if (!project) error(404, 'Project not found');
	if (project.ownerId !== caller.actor.id) error(403, 'Only the owner can delete a project');
	await deleteProject(id);
	return new Response(null, { status: 204 });
};
