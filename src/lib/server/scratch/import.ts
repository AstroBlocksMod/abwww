import type { Project } from '../db/schema/index.js';
import { createProject, ProjectError, type Actor } from '../projects/service.js';
import { unpackSb3 } from '../projects/sb3.js';
import { parseProjectJson, referencedAssets } from '../projects/validate.js';
import { enforceRateLimit } from '../ratelimit.js';
import { downloadAsset, downloadProjectBytes, getProjectMeta } from './client.js';

const ASSET_CONCURRENCY = 4;

/**
 * Copies one of the user's own Scratch projects here. Only the linked account's projects can be
 * imported: this is for moving your work, not for scraping other people's.
 */
export async function importScratchProject(
	actor: Actor & { scratchUsername: string | null },
	scratchProjectId: number
): Promise<Project> {
	if (!actor.scratchUsername) throw new ProjectError(403, 'Link your Scratch account first');
	await enforceRateLimit('scratch-import', actor.id, 20, 60 * 60);

	const meta = await getProjectMeta(scratchProjectId);
	if (!meta) throw new ProjectError(404, 'That Scratch project is not shared, or does not exist');
	if (meta.author.username.toLowerCase() !== actor.scratchUsername.toLowerCase()) {
		throw new ProjectError(403, 'You can only import projects from your own Scratch account');
	}
	if (!meta.project_token) throw new ProjectError(404, 'Scratch did not hand out a project token');

	const bytes = await downloadProjectBytes(scratchProjectId, meta.project_token);
	// Old projects come back as a zip; everything else as project.json.
	const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
	const unpacked = isZip ? unpackSb3(bytes) : null;
	const projectJson = unpacked?.projectJson ?? bytes;
	const assets = unpacked?.assets ?? new Map<string, Uint8Array>();

	const parsed = parseProjectJson(projectJson);
	const needed = [...referencedAssets(parsed)].filter((md5ext) => !assets.has(md5ext));
	for (let i = 0; i < needed.length; i += ASSET_CONCURRENCY) {
		const batch = needed.slice(i, i + ASSET_CONCURRENCY);
		const downloaded = await Promise.all(batch.map((md5ext) => downloadAsset(md5ext)));
		batch.forEach((md5ext, index) => assets.set(md5ext, downloaded[index]!));
	}

	return createProject({
		owner: actor,
		projectJson,
		assets,
		title: meta.title,
		instructions: meta.instructions,
		description: meta.description,
		scratchProjectId,
		message: `Import Scratch project ${scratchProjectId}`
	});
}
