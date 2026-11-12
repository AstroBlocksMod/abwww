import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { safeRedirect } from '#lib/server/auth/redirect.js';
import { createSession, setSessionCookie } from '#lib/server/auth/sessions.js';
import { authenticate } from '#lib/server/auth/users.js';
import { enforceRateLimit } from '#lib/server/ratelimit.js';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirect(url.searchParams.get('redirectTo'), url.origin));
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		await enforceRateLimit('login', event.getClientAddress(), 30, 15 * 60);
		const form = await event.request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const user = username && password ? await authenticate(username, password) : null;
		if (!user) return fail(400, { error: 'Wrong username or password', username });
		const sessionId = await createSession({
			id: user.id,
			username: user.username,
			isAdmin: user.isAdmin
		});
		setSessionCookie(event.cookies, sessionId);
		redirect(303, safeRedirect(event.url.searchParams.get('redirectTo'), event.url.origin));
	}
};
