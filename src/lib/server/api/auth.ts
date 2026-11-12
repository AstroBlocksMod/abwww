import { error, type RequestEvent } from '@sveltejs/kit';
import { readEditorToken, type EditorToken } from '../auth/tokens.js';
import { findUserById } from '../auth/users.js';
import type { Actor } from '../projects/service.js';

/**
 * API callers are either the site itself (session cookie) or the editor (bearer token, scoped to
 * one project). Both end up as an actor plus the scope the caller may touch.
 */
export interface ApiCaller {
	actor: Actor;
	/** Null for a session: the user may touch any of their projects. */
	tokenScope: (EditorToken & { token: string }) | null;
}

function bearerToken(event: RequestEvent): string | null {
	const header = event.request.headers.get('authorization');
	if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
	return event.url.searchParams.get('token');
}

/** The caller, or null when the request carries no usable credentials. */
export async function apiCaller(event: RequestEvent): Promise<ApiCaller | null> {
	if (event.locals.user) {
		return {
			actor: { id: event.locals.user.id, username: event.locals.user.username },
			tokenScope: null
		};
	}
	const token = bearerToken(event);
	if (!token) return null;
	const grant = await readEditorToken(token);
	if (!grant) return null;
	const user = await findUserById(grant.userId);
	if (!user) return null;
	return { actor: { id: user.id, username: user.username }, tokenScope: { ...grant, token } };
}

export async function requireApiCaller(event: RequestEvent): Promise<ApiCaller> {
	const caller = await apiCaller(event);
	if (!caller) error(401, 'Sign in, or pass an editor token');
	return caller;
}

/** Tokens are scoped to one project (or to creating one). Sessions are not limited. */
export function assertScope(caller: ApiCaller, projectId: number | null): void {
	const scope = caller.tokenScope;
	if (!scope) return;
	if (projectId === null ? scope.projectId !== null : scope.projectId !== projectId) {
		error(403, 'This token is for a different project');
	}
}
