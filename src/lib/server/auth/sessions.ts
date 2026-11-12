import type { Cookies } from '@sveltejs/kit';
import { config } from '../config.js';
import { randomToken } from '../platform/ids.js';
import { kvDelete, kvGetJson, kvSetJson } from '../platform/kv.js';

/** What a request knows about the signed-in user without touching the database. */
export interface SessionUser {
	id: string;
	username: string;
	isAdmin: boolean;
}

export const SESSION_COOKIE = 'abwww_session';

const sessionTtlSeconds = () => config.SESSION_TTL_DAYS * 24 * 60 * 60;
const key = (id: string) => `session:${id}`;

export async function createSession(user: SessionUser): Promise<string> {
	const id = randomToken(32);
	await kvSetJson(key(id), user, sessionTtlSeconds());
	return id;
}

export async function readSession(id: string): Promise<SessionUser | null> {
	return kvGetJson<SessionUser>(key(id));
}

/** Pushes the expiry out again. Called on requests, so active users stay signed in. */
export async function touchSession(id: string, user: SessionUser): Promise<void> {
	await kvSetJson(key(id), user, sessionTtlSeconds());
}

export async function destroySession(id: string): Promise<void> {
	await kvDelete(key(id));
}

export function setSessionCookie(cookies: Cookies, id: string): void {
	cookies.set(SESSION_COOKIE, id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: config.ORIGIN.startsWith('https://'),
		maxAge: sessionTtlSeconds()
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
