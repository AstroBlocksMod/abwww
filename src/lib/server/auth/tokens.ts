import { randomToken } from '../platform/ids.js';
import { kv, kvGetJson, kvSetJson } from '../platform/kv.js';

/**
 * Editor tokens let the editor, which runs on another origin without our cookies, read a private
 * project and save it back. A token is scoped to one user and one project (or to "a new project"
 * when `projectId` is null) and lives for a few hours. One token per user and project is reused
 * while it lives, so page reloads do not mint more.
 */
export interface EditorToken {
	userId: string;
	projectId: number | null;
}

const TTL_SECONDS = 12 * 60 * 60;
const key = (token: string) => `editor-token:${token}`;
const currentKey = (grant: EditorToken) =>
	`editor-token-for:${grant.userId}:${grant.projectId ?? 'new'}`;

export async function issueEditorToken(grant: EditorToken): Promise<string> {
	const existing = await kv.get(currentKey(grant));
	if (existing && (await readEditorToken(existing))) return existing;
	const token = `etk_${randomToken(24)}`;
	await kvSetJson(key(token), grant, TTL_SECONDS);
	await kv.send('SET', [currentKey(grant), token, 'EX', String(TTL_SECONDS)]);
	return token;
}

export async function readEditorToken(token: string): Promise<EditorToken | null> {
	if (!token.startsWith('etk_')) return null;
	return kvGetJson<EditorToken>(key(token));
}

/** Once a token has created a project, pin it to that project so it cannot create another. */
export async function bindEditorToken(token: string, projectId: number): Promise<void> {
	const grant = await readEditorToken(token);
	if (grant) await kvSetJson(key(token), { ...grant, projectId }, TTL_SECONDS);
}
