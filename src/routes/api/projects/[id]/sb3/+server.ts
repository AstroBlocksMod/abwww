import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiCaller, assertScope } from '#lib/server/api/auth.js';
import { bytesResponse } from '#lib/server/api/response.js';
import { readSnapshot } from '#lib/server/git/repo.js';
import { readBlob } from '#lib/server/platform/blobs.js';
import { decompress } from '#lib/server/platform/compress.js';
import { packSb3 } from '#lib/server/projects/sb3.js';
import { canView, getProject, readProjectAssets } from '#lib/server/projects/service.js';

/** The project as an .sb3, which is also what the player and editor load. */
export const GET: RequestHandler = async (event) => {
	const id = Number(event.params.id);
	const project = await getProject(id);
	const caller = await apiCaller(event);
	if (!project || !canView(project, caller?.actor ?? null)) error(404, 'Project not found');
	if (caller?.tokenScope) assertScope(caller, id);

	const version = event.url.searchParams.get('version');
	let projectJson: string;
	let assets: Map<string, Uint8Array>;
	if (version) {
		const snapshot = await readSnapshot(project.id, version);
		if (!snapshot) error(404, 'That version does not exist');
		projectJson = snapshot.projectJson;
		assets = new Map();
		for (const [md5ext, sha256] of Object.entries(snapshot.manifest)) {
			const bytes = await readBlob(sha256);
			if (!bytes) error(500, `Asset ${md5ext} is missing`);
			assets.set(md5ext, bytes);
		}
	} else {
		projectJson = new TextDecoder().decode(await decompress(project.projectJson));
		assets = await readProjectAssets(project);
	}
	const safeTitle = project.title.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'project';
	return bytesResponse(packSb3(projectJson, assets), {
		headers: {
			'Content-Type': 'application/x.scratch.sb3',
			'Content-Disposition': `attachment; filename="${safeTitle}.sb3"`,
			'Cache-Control':
				project.visibility === 'public' && !version ? 'public, max-age=30' : 'private, no-store',
			Vary: 'Authorization'
		}
	});
};
