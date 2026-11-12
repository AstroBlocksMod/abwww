import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { findUserByUsername, toPublicUser } from '#lib/server/auth/users.js';
import { listByOwner } from '#lib/server/projects/service.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = await findUserByUsername(params.username);
	if (!user) error(404, 'No such user');
	const isOwner = locals.user?.id === user.id;
	return {
		profile: toPublicUser(user),
		isOwner,
		projects: await listByOwner(user.id, isOwner)
	};
};
