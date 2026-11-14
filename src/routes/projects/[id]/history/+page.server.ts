import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { formText } from '#lib/server/api/form.js';
import { mapErrors } from '#lib/server/api/errors.js';
import { listHistory } from '#lib/server/git/repo.js';
import { canEdit, canView, getProject, restoreVersion } from '#lib/server/projects/service.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	const project = await getProject(Number(params.id));
	if (!project || !canView(project, locals.user)) error(404, 'Project not found');
	return {
		project: { id: project.id, title: project.title, headCommit: project.headCommit },
		isOwner: canEdit(project, locals.user),
		history: await listHistory(project.id, 100)
	};
};

export const actions: Actions = {
	restore: async ({ params, request, locals }) => {
		const project = await getProject(Number(params.id));
		if (!project || !canView(project, locals.user)) error(404, 'Project not found');
		if (!locals.user || !canEdit(project, locals.user))
			error(403, 'Only the owner can restore versions');
		const form = await request.formData();
		const oid = formText(form, 'oid');
		if (!/^[0-9a-f]{40}$/.test(oid)) return fail(400, { error: 'Unknown version' });
		await mapErrors(() =>
			restoreVersion(project.id, oid, { id: locals.user!.id, username: locals.user!.username })
		);
		return { restored: oid };
	}
};
