import { z } from 'zod';
import { config } from '../config.js';
import { kvGetJson, kvSetJson } from '../platform/kv.js';
import { sleep } from '../platform/time.js';

/**
 * The only module that talks to Scratch. It identifies this instance in the User-Agent, caches
 * what it can, and backs off when Scratch pushes back. We depend on them tolerating us.
 */

const API = 'https://api.scratch.mit.edu';
const PROJECTS = 'https://projects.scratch.mit.edu';
const ASSETS = 'https://assets.scratch.mit.edu';
const TIMEOUT_MS = 20_000;

export class ScratchApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

function userAgent(): string {
	const contact = config.SCRATCH_CONTACT ? `; ${config.SCRATCH_CONTACT}` : '';
	return `abwww/0.1 (+${config.ORIGIN}${contact})`;
}

async function scratchFetch(url: string, attempt = 0): Promise<Response> {
	const response = await fetch(url, {
		headers: { 'User-Agent': userAgent(), Accept: 'application/json, */*' },
		signal: AbortSignal.timeout(TIMEOUT_MS),
		redirect: 'follow'
	});
	if ((response.status === 429 || response.status >= 500) && attempt < 2) {
		const retryAfter = Number(response.headers.get('retry-after'));
		const delay =
			Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
		await response.body?.cancel();
		await sleep(Math.min(delay, 10_000));
		return scratchFetch(url, attempt + 1);
	}
	return response;
}

async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
	const hit = await kvGetJson<T>(`scratch:${key}`);
	if (hit !== null) return hit;
	const value = await load();
	await kvSetJson(`scratch:${key}`, value, ttlSeconds);
	return value;
}

const projectMetaSchema = z.looseObject({
	id: z.number(),
	title: z.string(),
	description: z.string().default(''),
	instructions: z.string().default(''),
	author: z.looseObject({ username: z.string() }),
	project_token: z.string().optional(),
	image: z.string().optional(),
	history: z.looseObject({ shared: z.string().nullable().optional() }).optional()
});
export type ScratchProjectMeta = z.infer<typeof projectMetaSchema>;

/** Project metadata, including the token the project server wants. Null when it is not public. */
export async function getProjectMeta(id: number): Promise<ScratchProjectMeta | null> {
	const response = await scratchFetch(`${API}/projects/${id}`);
	if (response.status === 404) return null;
	if (!response.ok)
		throw new ScratchApiError(`Scratch returned ${response.status}`, response.status);
	return projectMetaSchema.parse(await response.json());
}

const commentSchema = z.looseObject({
	id: z.number(),
	content: z.string(),
	author: z.looseObject({ username: z.string() }),
	datetime_created: z.string()
});
export type ScratchComment = z.infer<typeof commentSchema>;

/** The newest top-level comments on a project. Not cached: verification needs the live list. */
export async function getProjectComments(
	owner: string,
	projectId: number,
	limit = 40,
	offset = 0
): Promise<ScratchComment[]> {
	const url = `${API}/users/${encodeURIComponent(owner)}/projects/${projectId}/comments?offset=${offset}&limit=${limit}`;
	const response = await scratchFetch(url);
	if (response.status === 404) return [];
	if (!response.ok)
		throw new ScratchApiError(`Scratch returned ${response.status}`, response.status);
	return z.array(commentSchema).parse(await response.json());
}

const projectSummarySchema = z.looseObject({
	id: z.number(),
	title: z.string(),
	image: z.string().optional(),
	history: z.looseObject({ modified: z.string().optional() }).optional()
});
export type ScratchProjectSummary = z.infer<typeof projectSummarySchema>;

/** A user's shared projects. Cached briefly, since people refresh this page a lot. */
export async function getUserProjects(
	username: string,
	limit = 40,
	offset = 0
): Promise<ScratchProjectSummary[]> {
	return cached(`user-projects:${username.toLowerCase()}:${limit}:${offset}`, 120, async () => {
		const url = `${API}/users/${encodeURIComponent(username)}/projects?limit=${limit}&offset=${offset}`;
		const response = await scratchFetch(url);
		if (response.status === 404) return [];
		if (!response.ok)
			throw new ScratchApiError(`Scratch returned ${response.status}`, response.status);
		return z.array(projectSummarySchema).parse(await response.json());
	});
}

/** Raw project bytes (project.json, or a zipped sb3 for very old projects). */
export async function downloadProjectBytes(id: number, token: string): Promise<Uint8Array> {
	const response = await scratchFetch(`${PROJECTS}/${id}?token=${encodeURIComponent(token)}`);
	if (!response.ok) throw new ScratchApiError(`Could not download project ${id}`, response.status);
	const length = Number(response.headers.get('content-length'));
	if (length > config.SB3_MAX_BYTES)
		throw new ScratchApiError('Project is too large to import', 413);
	return new Uint8Array(await response.arrayBuffer());
}

export async function downloadAsset(md5ext: string): Promise<Uint8Array> {
	const response = await scratchFetch(`${ASSETS}/internalapi/asset/${md5ext}/get/`);
	if (!response.ok)
		throw new ScratchApiError(`Could not download asset ${md5ext}`, response.status);
	const length = Number(response.headers.get('content-length'));
	if (length > config.ASSET_MAX_BYTES)
		throw new ScratchApiError(`Asset ${md5ext} is too large`, 413);
	return new Uint8Array(await response.arrayBuffer());
}
