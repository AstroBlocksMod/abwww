import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { formText } from '#lib/server/api/form.js';
import { mapErrors } from '#lib/server/api/errors.js';
import { config } from '#lib/server/config.js';
import { unpackSb3 } from '#lib/server/projects/sb3.js';
import { createProject } from '#lib/server/projects/service.js';
import { enforceRateLimit } from '#lib/server/ratelimit.js';

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	return { maxBytes: config.SB3_MAX_BYTES };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login');
		await enforceRateLimit('project-create', locals.user.id, 60, 60 * 60);
		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { error: 'Choose an .sb3 file' });
		if (file.size > config.SB3_MAX_BYTES) {
			return fail(413, { error: `Files can be at most ${config.SB3_MAX_BYTES} bytes` });
		}
		const title = formText(form, 'title').trim() || file.name.replace(/\.sb3$/i, '');
		const { projectJson, assets } = await mapErrors(async () =>
			unpackSb3(new Uint8Array(await file.arrayBuffer()))
		);
		const project = await mapErrors(() =>
			createProject({
				owner: { id: locals.user!.id, username: locals.user!.username },
				projectJson,
				assets,
				title,
				message: `Upload ${file.name}`
			})
		);
		redirect(303, `/projects/${project.id}`);
	}
};
