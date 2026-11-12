import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { readStagedAsset, unstageAssets } from '../assets/staging.js';
import { AssetError, storeAsset } from '../assets/store.js';
import { config } from '../config.js';
import {
	projects,
	users,
	type AssetManifest,
	type Project,
	type ProjectVisibility
} from '../db/schema/index.js';
import { commitSnapshot, readSnapshot, removeRepo, type CommitAuthor } from '../git/repo.js';
import { readBlob } from '../platform/blobs.js';
import { compress, decompress } from '../platform/compress.js';
import { db } from '../platform/db.js';
import { sha256Hex } from '../platform/hash.js';
import { kvDelete, kvSetJsonIfAbsent } from '../platform/kv.js';
import { sleep } from '../platform/time.js';
import { parseProjectJson, referencedAssets, titleFromProject } from './validate.js';

/** Who is acting: enough to own a project and sign a commit. */
export interface Actor {
	id: string;
	username: string;
}

export class ProjectError extends Error {
	constructor(
		readonly status: 400 | 403 | 404 | 409 | 413,
		message: string
	) {
		super(message);
	}
}

export interface ProjectSummary {
	id: number;
	title: string;
	ownerUsername: string;
	visibility: ProjectVisibility;
	updatedAt: Date;
	sharedAt: Date | null;
}

const LOCK_TTL_SECONDS = 30;

/** Saves to one project happen one at a time, so commits never race for the same parent. */
async function withProjectLock<T>(projectId: number, fn: () => Promise<T>): Promise<T> {
	const key = `lock:project:${projectId}`;
	const deadline = Date.now() + 10_000;
	while (!(await kvSetJsonIfAbsent(key, 1, LOCK_TTL_SECONDS))) {
		if (Date.now() > deadline) throw new ProjectError(409, 'The project is busy, try again');
		await sleep(100);
	}
	try {
		return await fn();
	} finally {
		await kvDelete(key);
	}
}

function commitAuthor(actor: Actor): CommitAuthor {
	const host = new URL(config.ORIGIN).host;
	return { name: actor.username, email: `${actor.username}@${host}` };
}

interface ResolveAssetsInput {
	referenced: Set<string>;
	/** Bytes that arrived with this save, by md5ext. */
	provided: Map<string, Uint8Array>;
	/** The manifest of the version being replaced. */
	previous: AssetManifest;
	/** Whose staged uploads may be claimed. */
	stagedFor: string | null;
}

/**
 * Builds the manifest for a new version: every asset the JSON names must come from this save,
 * the previous version, or the user's staged uploads. Nothing is ever looked up by md5 globally.
 */
async function resolveAssets(input: ResolveAssetsInput): Promise<AssetManifest> {
	const manifest: AssetManifest = {};
	const missing: string[] = [];
	for (const md5ext of input.referenced) {
		const bytes = input.provided.get(md5ext);
		if (bytes) {
			try {
				const stored = await storeAsset(bytes, md5ext.slice(0, 32));
				manifest[md5ext] = stored.sha256;
			} catch (error) {
				if (error instanceof AssetError) throw new ProjectError(error.status, error.message);
				throw error;
			}
			continue;
		}
		const previous = input.previous[md5ext];
		if (previous) {
			manifest[md5ext] = previous;
			continue;
		}
		const staged = input.stagedFor ? await readStagedAsset(input.stagedFor, md5ext) : null;
		if (staged) {
			manifest[md5ext] = staged;
			continue;
		}
		missing.push(md5ext);
	}
	if (missing.length > 0) {
		throw new ProjectError(
			400,
			`The project references assets that were not uploaded: ${missing.join(', ')}`
		);
	}
	return manifest;
}

interface PreparedJson {
	json: string;
	bytes: Uint8Array;
	compressed: Uint8Array;
	sha256: string;
}

async function prepareJson(parsed: unknown): Promise<PreparedJson> {
	const json = JSON.stringify(parsed);
	const bytes = new TextEncoder().encode(json);
	if (bytes.byteLength > config.PROJECT_JSON_MAX_BYTES) {
		throw new ProjectError(
			413,
			`project.json can be at most ${config.PROJECT_JSON_MAX_BYTES} bytes`
		);
	}
	return { json, bytes, compressed: await compress(bytes), sha256: sha256Hex(bytes) };
}

export interface CreateProjectInput {
	owner: Actor;
	projectJson: string | Uint8Array;
	assets?: Map<string, Uint8Array>;
	title?: string | null;
	instructions?: string;
	description?: string;
	remixOfId?: number | null;
	scratchProjectId?: number | null;
	/** Assets a remix inherits from its parent. */
	inheritedManifest?: AssetManifest;
	message: string;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
	const parsed = parseProjectJson(input.projectJson);
	const referenced = referencedAssets(parsed);
	const manifest = await resolveAssets({
		referenced,
		provided: input.assets ?? new Map(),
		previous: input.inheritedManifest ?? {},
		stagedFor: input.owner.id
	});
	const prepared = await prepareJson(parsed);
	const title = (input.title?.trim() || titleFromProject(parsed) || 'Untitled').slice(0, 100);
	const [created] = await db
		.insert(projects)
		.values({
			ownerId: input.owner.id,
			title,
			instructions: input.instructions ?? '',
			description: input.description ?? '',
			remixOfId: input.remixOfId ?? null,
			scratchProjectId: input.scratchProjectId ?? null,
			projectJson: Buffer.from(prepared.compressed),
			projectJsonSha256: prepared.sha256,
			projectJsonSize: prepared.bytes.byteLength,
			assetManifest: manifest
		})
		.returning();
	if (!created) throw new Error('Insert returned no row');
	const oid = await commitSnapshot(
		created.id,
		{ projectJson: prepared.json, manifest },
		commitAuthor(input.owner),
		input.message
	);
	const [updated] = await db
		.update(projects)
		.set({ headCommit: oid })
		.where(eq(projects.id, created.id))
		.returning();
	await unstageAssets(input.owner.id, referenced);
	return updated ?? created;
}

export interface SaveProjectInput {
	projectId: number;
	actor: Actor;
	projectJson: string | Uint8Array;
	assets?: Map<string, Uint8Array>;
	message: string;
}

export async function saveProject(input: SaveProjectInput): Promise<Project> {
	return withProjectLock(input.projectId, async () => {
		const project = await getProject(input.projectId);
		if (!project) throw new ProjectError(404, 'Project not found');
		if (project.ownerId !== input.actor.id) throw new ProjectError(403, 'Only the owner can save');
		const parsed = parseProjectJson(input.projectJson);
		const referenced = referencedAssets(parsed);
		const manifest = await resolveAssets({
			referenced,
			provided: input.assets ?? new Map(),
			previous: project.assetManifest,
			stagedFor: input.actor.id
		});
		const prepared = await prepareJson(parsed);
		const oid = await commitSnapshot(
			project.id,
			{ projectJson: prepared.json, manifest },
			commitAuthor(input.actor),
			input.message
		);
		const [updated] = await db
			.update(projects)
			.set({
				projectJson: Buffer.from(prepared.compressed),
				projectJsonSha256: prepared.sha256,
				projectJsonSize: prepared.bytes.byteLength,
				assetManifest: manifest,
				headCommit: oid,
				updatedAt: new Date()
			})
			.where(eq(projects.id, project.id))
			.returning();
		if (!updated) throw new Error('Update returned no row');
		await unstageAssets(input.actor.id, referenced);
		return updated;
	});
}

/** Makes an older commit the current content again, as a new commit, so nothing is lost. */
export async function restoreVersion(
	projectId: number,
	oid: string,
	actor: Actor
): Promise<Project> {
	const snapshot = await readSnapshot(projectId, oid);
	if (!snapshot) throw new ProjectError(404, 'That version does not exist');
	return withProjectLock(projectId, async () => {
		const project = await getProject(projectId);
		if (!project) throw new ProjectError(404, 'Project not found');
		if (project.ownerId !== actor.id) throw new ProjectError(403, 'Only the owner can restore');
		const parsed = parseProjectJson(snapshot.projectJson);
		const referenced = referencedAssets(parsed);
		const manifest = await resolveAssets({
			referenced,
			provided: new Map(),
			previous: snapshot.manifest,
			stagedFor: null
		});
		const prepared = await prepareJson(parsed);
		const newOid = await commitSnapshot(
			project.id,
			{ projectJson: prepared.json, manifest },
			commitAuthor(actor),
			`Restore version ${oid.slice(0, 7)}`
		);
		const [updated] = await db
			.update(projects)
			.set({
				projectJson: Buffer.from(prepared.compressed),
				projectJsonSha256: prepared.sha256,
				projectJsonSize: prepared.bytes.byteLength,
				assetManifest: manifest,
				headCommit: newOid,
				updatedAt: new Date()
			})
			.where(eq(projects.id, project.id))
			.returning();
		if (!updated) throw new Error('Update returned no row');
		return updated;
	});
}

export async function getProject(id: number): Promise<Project | null> {
	if (!Number.isSafeInteger(id) || id <= 0) return null;
	const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
	return rows[0] ?? null;
}

export function canView(project: Project, viewer: { id: string } | null): boolean {
	if (project.visibility !== 'private') return true;
	return viewer?.id === project.ownerId;
}

export function canEdit(project: Project, viewer: { id: string } | null): boolean {
	return viewer?.id === project.ownerId;
}

/** The current project.json, uncompressed. */
export async function readProjectJson(project: Project): Promise<Uint8Array> {
	return decompress(project.projectJson);
}

/** Every asset of the current version, by md5ext. Missing blobs are an invariant violation. */
export async function readProjectAssets(project: Project): Promise<Map<string, Uint8Array>> {
	const result = new Map<string, Uint8Array>();
	for (const [md5ext, sha256] of Object.entries(project.assetManifest)) {
		const bytes = await readBlob(sha256);
		if (!bytes) throw new Error(`Asset ${md5ext} (${sha256}) is missing from the blob store`);
		result.set(md5ext, bytes);
	}
	return result;
}

const summaryColumns = {
	id: projects.id,
	title: projects.title,
	ownerUsername: users.username,
	visibility: projects.visibility,
	updatedAt: projects.updatedAt,
	sharedAt: projects.sharedAt
};

export async function listRecentlyShared(limit = 24, offset = 0): Promise<ProjectSummary[]> {
	return db
		.select(summaryColumns)
		.from(projects)
		.innerJoin(users, eq(users.id, projects.ownerId))
		.where(and(eq(projects.visibility, 'public'), isNotNull(projects.sharedAt)))
		.orderBy(desc(projects.sharedAt))
		.limit(limit)
		.offset(offset);
}

export async function listByOwner(
	ownerId: string,
	includePrivate: boolean,
	limit = 100
): Promise<ProjectSummary[]> {
	const owned = eq(projects.ownerId, ownerId);
	return db
		.select(summaryColumns)
		.from(projects)
		.innerJoin(users, eq(users.id, projects.ownerId))
		.where(includePrivate ? owned : and(owned, eq(projects.visibility, 'public')))
		.orderBy(desc(projects.updatedAt))
		.limit(limit);
}

export interface ProjectDetailsPatch {
	title?: string;
	instructions?: string;
	description?: string;
	visibility?: ProjectVisibility;
}

/** Returns the updated project and whether it just became public for the first time. */
export async function updateProjectDetails(
	project: Project,
	patch: ProjectDetailsPatch
): Promise<{ project: Project; firstShare: boolean }> {
	const firstShare = patch.visibility === 'public' && project.sharedAt === null;
	const [updated] = await db
		.update(projects)
		.set({
			...(patch.title !== undefined
				? { title: patch.title.trim().slice(0, 100) || 'Untitled' }
				: {}),
			...(patch.instructions !== undefined
				? { instructions: patch.instructions.slice(0, 5000) }
				: {}),
			...(patch.description !== undefined ? { description: patch.description.slice(0, 5000) } : {}),
			...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
			...(firstShare ? { sharedAt: new Date() } : {})
		})
		.where(eq(projects.id, project.id))
		.returning();
	if (!updated) throw new ProjectError(404, 'Project not found');
	return { project: updated, firstShare };
}

/**
 * Removes the row and the git history. Asset blobs stay, since other projects may share them;
 * collecting unreferenced blobs is a separate job.
 */
export async function deleteProject(id: number): Promise<void> {
	await withProjectLock(id, async () => {
		await db.delete(projects).where(eq(projects.id, id));
		await removeRepo(id);
	});
}
