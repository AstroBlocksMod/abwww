import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertScope, requireApiCaller } from '#lib/server/api/auth.js';
import { readProjectJsonBody } from '#lib/server/api/body.js';
import { mapErrors } from '#lib/server/api/errors.js';
import { bindEditorToken } from '#lib/server/auth/tokens.js';
import { canView, createProject, getProject } from '#lib/server/projects/service.js';
import { enforceRateLimit } from '#lib/server/ratelimit.js';

/**
 * Creates a project from a project.json body. Same shape as Scratch's project server, which the
 * editor's (currently dormant) save code speaks: the new id comes back as `content-name`.
 * Query: `title`, and `is_remix=1&original_id=<id>` for a remix made in the editor.
 */
export const POST: RequestHandler = async (event) => {
	const caller = await requireApiCaller(event);
	assertScope(caller, null);
	await enforceRateLimit('project-create', caller.actor.id, 60, 60 * 60);

	const body = await readProjectJsonBody(event.request);
	const originalId = Number(event.url.searchParams.get('original_id'));
	const isRemix =
		event.url.searchParams.get('is_remix') === '1' && Number.isSafeInteger(originalId);
	const original = isRemix ? await getProject(originalId) : null;
	if (isRemix && (!original || !canView(original, caller.actor))) {
		error(404, 'The project being remixed does not exist');
	}

	const project = await mapErrors(() =>
		createProject({
			owner: caller.actor,
			projectJson: body,
			title: event.url.searchParams.get('title'),
			remixOfId: original?.id ?? null,
			inheritedManifest: original?.assetManifest,
			message: original ? `Remix of project ${original.id}` : 'Create project'
		})
	);
	if (caller.tokenScope) await bindEditorToken(caller.tokenScope.token, project.id);
	return Response.json({ status: 'ok', 'content-name': String(project.id), id: project.id });
};
