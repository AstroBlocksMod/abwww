import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { clearSessionCookie, destroySession } from '#lib/server/auth/sessions.js';

export const load: PageServerLoad = () => {
	redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ locals, cookies }) => {
		if (locals.sessionId) await destroySession(locals.sessionId);
		clearSessionCookie(cookies);
		redirect(303, '/');
	}
};
