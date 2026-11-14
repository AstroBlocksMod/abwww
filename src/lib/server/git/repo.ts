import { join } from 'node:path';
import {
	init,
	isDescendent,
	log,
	readBlob,
	resolveRef,
	writeBlob,
	writeCommit,
	writeRef,
	writeTree
} from 'isomorphic-git';
import type { AssetManifest } from '../db/schema/index.js';
import { ensureDir, fileExists, gitFs, gitRoot, removeDir } from '../platform/fs.js';

/**
 * One bare git repository per project. Every save is a commit holding `project.json` (pretty
 * printed, so diffs mean something) and `assets.json` (md5ext to sha256). Asset bytes stay in the
 * blob store; the manifest is enough to rebuild any version.
 *
 * Only plumbing is used (blobs, trees, commits, refs), so there is no working tree or index.
 * Git object ids are SHA-1 and only ever identify history, never content we trust.
 */

const BRANCH = 'main';
const REF = `refs/heads/${BRANCH}`;

export interface Snapshot {
	projectJson: string;
	manifest: AssetManifest;
}

export interface CommitAuthor {
	name: string;
	email: string;
}

export interface HistoryEntry {
	oid: string;
	message: string;
	author: string;
	/** Unix seconds. */
	timestamp: number;
	parent: string | null;
}

function gitdirFor(projectId: number): string {
	return join(gitRoot(), `${projectId}.git`);
}

async function openRepo(projectId: number): Promise<string> {
	const gitdir = gitdirFor(projectId);
	if (!(await fileExists(join(gitdir, 'HEAD')))) {
		await ensureDir(gitdir);
		await init({ fs: gitFs, gitdir, bare: true, defaultBranch: BRANCH });
	}
	return gitdir;
}

async function headOid(gitdir: string): Promise<string | null> {
	try {
		return await resolveRef({ fs: gitFs, gitdir, ref: REF });
	} catch {
		return null;
	}
}

export function prettyProjectJson(projectJson: string): string {
	return `${JSON.stringify(JSON.parse(projectJson), null, '\t')}\n`;
}

function sortedManifest(manifest: AssetManifest): string {
	const sorted = Object.fromEntries(
		Object.entries(manifest).toSorted(([a], [b]) => (a < b ? -1 : 1))
	);
	return `${JSON.stringify(sorted, null, '\t')}\n`;
}

/** Records a snapshot as a new commit on top of the current head. Returns the commit id. */
export async function commitSnapshot(
	projectId: number,
	snapshot: Snapshot,
	author: CommitAuthor,
	message: string
): Promise<string> {
	const gitdir = await openRepo(projectId);
	const encoder = new TextEncoder();
	const fs = gitFs;
	const projectBlob = await writeBlob({
		fs,
		gitdir,
		blob: encoder.encode(prettyProjectJson(snapshot.projectJson))
	});
	const manifestBlob = await writeBlob({
		fs,
		gitdir,
		blob: encoder.encode(sortedManifest(snapshot.manifest))
	});
	const tree = await writeTree({
		fs,
		gitdir,
		tree: [
			{ mode: '100644', path: 'assets.json', oid: manifestBlob, type: 'blob' },
			{ mode: '100644', path: 'project.json', oid: projectBlob, type: 'blob' }
		]
	});
	const parent = await headOid(gitdir);
	const signature = {
		name: author.name,
		email: author.email,
		timestamp: Math.floor(Date.now() / 1000),
		timezoneOffset: 0
	};
	const oid = await writeCommit({
		fs,
		gitdir,
		commit: {
			message,
			tree,
			parent: parent ? [parent] : [],
			author: signature,
			committer: signature
		}
	});
	await writeRef({ fs, gitdir, ref: REF, value: oid, force: true });
	return oid;
}

/** Deletes a project's whole history. There is no undo; the caller has checked with the owner. */
export async function removeRepo(projectId: number): Promise<void> {
	await removeDir(gitdirFor(projectId));
}

export async function listHistory(projectId: number, depth = 50): Promise<HistoryEntry[]> {
	const gitdir = gitdirFor(projectId);
	if (!(await fileExists(join(gitdir, 'HEAD')))) return [];
	if ((await headOid(gitdir)) === null) return [];
	const entries = await log({ fs: gitFs, gitdir, ref: REF, depth });
	return entries.map((entry) => ({
		oid: entry.oid,
		message: entry.commit.message.trim(),
		author: entry.commit.author.name,
		timestamp: entry.commit.author.timestamp,
		parent: entry.commit.parent[0] ?? null
	}));
}

/** The snapshot stored in a commit, or null if the commit is not in this project's history. */
export async function readSnapshot(projectId: number, oid: string): Promise<Snapshot | null> {
	const gitdir = gitdirFor(projectId);
	if (!/^[0-9a-f]{40}$/.test(oid)) return null;
	const fs = gitFs;
	try {
		// Only accept commits reachable from this project's branch, so an oid from another
		// repository cannot be read through this one.
		const head = await headOid(gitdir);
		if (!head) return null;
		if (head !== oid && !(await isDescendent({ fs, gitdir, oid: head, ancestor: oid }))) {
			return null;
		}
		const decoder = new TextDecoder();
		const project = await readBlob({ fs, gitdir, oid, filepath: 'project.json' });
		const manifest = await readBlob({ fs, gitdir, oid, filepath: 'assets.json' });
		return {
			projectJson: JSON.stringify(JSON.parse(decoder.decode(project.blob))),
			manifest: JSON.parse(decoder.decode(manifest.blob)) as AssetManifest
		};
	} catch {
		return null;
	}
}
