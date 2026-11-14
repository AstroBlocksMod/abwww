import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { formText } from '#lib/server/api/form.js';
import { createSession, setSessionCookie } from '#lib/server/auth/sessions.js';
import {
	passwordSchema,
	registerUser,
	usernameSchema,
	UsernameTakenError
} from '#lib/server/auth/users.js';
import { config } from '#lib/server/config.js';
import { enforceRateLimit } from '#lib/server/ratelimit.js';

const formSchema = z.object({
	username: usernameSchema,
	password: passwordSchema
});

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
	if (config.REGISTRATION !== 'open') return { closed: true };
	return { closed: false };
};

export const actions: Actions = {
	default: async (event) => {
		if (config.REGISTRATION !== 'open')
			return fail(403, { error: 'Registration is closed', username: '' });
		await enforceRateLimit('register', event.getClientAddress(), 10, 60 * 60);
		const form = await event.request.formData();
		const parsed = formSchema.safeParse({
			username: form.get('username'),
			password: form.get('password')
		});
		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Check the form',
				username: formText(form, 'username')
			});
		}
		try {
			const user = await registerUser(parsed.data.username, parsed.data.password);
			const sessionId = await createSession({
				id: user.id,
				username: user.username,
				isAdmin: user.isAdmin
			});
			setSessionCookie(event.cookies, sessionId);
		} catch (err) {
			if (err instanceof UsernameTakenError) {
				return fail(409, { error: err.message, username: parsed.data.username });
			}
			throw err;
		}
		redirect(303, '/');
	}
};
