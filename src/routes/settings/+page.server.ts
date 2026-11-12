import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { mapErrors } from '#lib/server/api/errors.js';
import { findUserById, toPublicUser, updateProfile } from '#lib/server/auth/users.js';
import { getUserProjects, type ScratchProjectSummary } from '#lib/server/scratch/client.js';
import { importScratchProject } from '#lib/server/scratch/import.js';
import {
	cancelVerification,
	checkVerification,
	pendingVerification,
	startVerification,
	unlinkScratch,
	VerificationError,
	verificationTarget
} from '#lib/server/scratch/verify.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	const user = await findUserById(locals.user.id);
	if (!user) redirect(303, '/logout');

	let scratchProjects: ScratchProjectSummary[] = [];
	let scratchError: string | null = null;
	if (user.scratchUsername) {
		try {
			scratchProjects = await getUserProjects(user.scratchUsername);
		} catch (err) {
			scratchError = err instanceof Error ? err.message : 'Could not reach Scratch';
		}
	}
	return {
		profile: toPublicUser(user),
		pending: await pendingVerification(user.id),
		target: verificationTarget(),
		scratchProjects,
		scratchError
	};
};

function requireUser(locals: App.Locals) {
	if (!locals.user) redirect(303, '/login');
	return locals.user;
}

export const actions: Actions = {
	profile: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const displayName = String(form.get('displayName') ?? '')
			.trim()
			.slice(0, 50);
		const bio = String(form.get('bio') ?? '').slice(0, 2000);
		await updateProfile(user.id, { displayName: displayName || null, bio });
		return { profileSaved: true };
	},

	startVerification: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const scratchUsername = String(form.get('scratchUsername') ?? '').trim();
		try {
			await startVerification(user.id, scratchUsername);
		} catch (err) {
			if (err instanceof VerificationError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { started: true };
	},

	checkVerification: async ({ locals }) => {
		const user = requireUser(locals);
		const result = await mapErrors(() => checkVerification(user.id));
		const messages = {
			linked: 'Your Scratch account is linked.',
			'not-found': 'No comment with your code yet. Post it and check again in a moment.',
			expired: 'That code expired. Start again.',
			taken: 'That Scratch account is already linked to another account here.'
		} as const;
		return result === 'linked' ? { linked: true } : fail(400, { error: messages[result] });
	},

	cancelVerification: async ({ locals }) => {
		const user = requireUser(locals);
		await cancelVerification(user.id);
		return {};
	},

	unlink: async ({ locals }) => {
		const user = requireUser(locals);
		await unlinkScratch(user.id);
		return { unlinked: true };
	},

	import: async ({ request, locals }) => {
		const session = requireUser(locals);
		const user = await findUserById(session.id);
		if (!user) redirect(303, '/logout');
		const form = await request.formData();
		const scratchProjectId = Number(form.get('scratchProjectId'));
		if (!Number.isSafeInteger(scratchProjectId) || scratchProjectId <= 0) {
			return fail(400, { error: 'Pick a project to import' });
		}
		const project = await mapErrors(() =>
			importScratchProject(
				{ id: user.id, username: user.username, scratchUsername: user.scratchUsername },
				scratchProjectId
			)
		);
		redirect(303, `/projects/${project.id}`);
	}
};
