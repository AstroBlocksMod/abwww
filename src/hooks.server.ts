import { sequence } from '@sveltejs/kit/hooks';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { fedifyHook } from '@fedify/sveltekit';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
	clearSessionCookie,
	readSession,
	SESSION_COOKIE,
	touchSession
} from '#lib/server/auth/sessions.js';
import { config } from '#lib/server/config.js';
import { runMigrations } from '#lib/server/db/migrate.js';
import { federation } from '#lib/server/federation/index.js';

export const init: ServerInit = async () => {
	await runMigrations();
	await mkdir(join(config.DATA_DIR, 'assets'), { recursive: true });
	await mkdir(join(config.DATA_DIR, 'git'), { recursive: true });
	if (config.FEDERATION) {
		void federation.startQueue(undefined);
	}
	if (
		process.env.NODE_ENV === 'production' &&
		new URL(config.editorUrl).origin === new URL(config.ORIGIN).origin
	) {
		console.warn(
			'EDITOR_URL shares the site origin. Projects with custom extensions can then act as the ' +
				'person viewing them. Serve the editor from its own hostname in production (docs/editor.md).'
		);
	}
};

/** Loads the signed-in user from the session cookie and keeps the session alive. */
const session: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.sessionId = null;
	const id = event.cookies.get(SESSION_COOKIE);
	if (id) {
		const user = await readSession(id);
		if (user) {
			event.locals.user = user;
			event.locals.sessionId = id;
			await touchSession(id, user);
		} else {
			clearSessionCookie(event.cookies);
		}
	}
	return resolve(event);
};

/**
 * The editor and player live on their own origin and call `/api/` with bearer tokens or for
 * public data, so those routes answer cross-origin requests. Nothing else does.
 */
const cors: Handle = async ({ event, resolve }) => {
	if (!event.url.pathname.startsWith('/api/')) return resolve(event);
	const headers = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Authorization, Content-Type',
		'Access-Control-Max-Age': '86400'
	};
	if (event.request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
	const response = await resolve(event);
	for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
	return response;
};

// Built on the first request rather than at import, so the build step never reads configuration.
let chain: Handle | null = null;

export const handle: Handle = (input) => {
	if (!chain) {
		const handles: Handle[] = [];
		if (config.FEDERATION) handles.push(fedifyHook(federation, () => undefined));
		handles.push(cors, session);
		chain = sequence(...handles);
	}
	return chain(input);
};
