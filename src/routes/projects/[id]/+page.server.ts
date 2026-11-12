import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { mapErrors } from '#lib/server/api/errors.js';
import { issueEditorToken } from '#lib/server/auth/tokens.js';
import { findUserById } from '#lib/server/auth/users.js';
import { config } from '#lib/server/config.js';
import { projectVisibility, type Project } from '#lib/server/db/schema/index.js';
import { announceSharedProject } from '#lib/server/federation/index.js';
import { readSnapshot } from '#lib/server/git/repo.js';
import { decompress } from '#lib/server/platform/compress.js';
import { unpackSb3 } from '#lib/server/projects/sb3.js';
import {
	canEdit,
	canView,
	createProject,
	deleteProject,
	getProject,
	saveProject,
	updateProjectDetails
} from '#lib/server/projects/service.js';
import { editorUrl, playerUrl, projectSb3Url } from '#lib/server/projects/urls.js';
import { enforceRateLimit } from '#lib/server/ratelimit.js';

function projectId(param: string): number {
	if (!/^\d+$/.test(param)) error(404, 'Project not found');
	return Number(param);
}

async function viewableProject(param: string, locals: App.Locals): Promise<Project> {
	const project = await getProject(projectId(param));
	if (!project || !canView(project, locals.user)) error(404, 'Project not found');
	return project;
}

async function ownedProject(param: string, locals: App.Locals): Promise<Project> {
	const project = await viewableProject(param, locals);
	if (!canEdit(project, locals.user)) error(403, 'Only the owner can do that');
	return project;
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const project = await viewableProject(params.id, locals);
	const owner = await findUserById(project.ownerId);
	const isOwner = canEdit(project, locals.user);
	const version = url.searchParams.get('v');
	if (version && !/^[0-9a-f]{40}$/.test(version)) error(404, 'That version does not exist');
	if (version && !(await readSnapshot(project.id, version)))
		error(404, 'That version does not exist');

	// Private projects are loaded by the player and editor with a token, since they run on
	// another origin without our cookies. Public ones need nothing.
	const token =
		project.visibility === 'private' && isOwner
			? await issueEditorToken({ userId: project.ownerId, projectId: project.id })
			: null;
	const remixOf = project.remixOfId ? await getProject(project.remixOfId) : null;
	const remixOwner = remixOf ? await findUserById(remixOf.ownerId) : null;

	return {
		project: {
			id: project.id,
			title: project.title,
			instructions: project.instructions,
			description: project.description,
			visibility: project.visibility,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt,
			sharedAt: project.sharedAt,
			scratchProjectId: project.scratchProjectId,
			headCommit: project.headCommit
		},
		owner: owner ? { username: owner.username, displayName: owner.displayName } : null,
		remixOf:
			remixOf && remixOwner
				? { id: remixOf.id, title: remixOf.title, owner: remixOwner.username }
				: null,
		isOwner,
		canRemix: Boolean(locals.user) && project.visibility !== 'private',
		version,
		urls: {
			player: playerUrl(project.id, { token, version }),
			editor: editorUrl(project.id, project.title, { token, version }),
			download: projectSb3Url(project.id, token, version)
		},
		maxUploadBytes: config.SB3_MAX_BYTES
	};
};

export const actions: Actions = {
	details: async ({ params, request, locals }) => {
		const project = await ownedProject(params.id, locals);
		const form = await request.formData();
		await updateProjectDetails(project, {
			title: String(form.get('title') ?? project.title),
			instructions: String(form.get('instructions') ?? ''),
			description: String(form.get('description') ?? '')
		});
		return { saved: true };
	},

	visibility: async ({ params, request, locals }) => {
		const project = await ownedProject(params.id, locals);
		const form = await request.formData();
		const value = String(form.get('visibility') ?? '');
		if (!projectVisibility.enumValues.includes(value as never))
			return fail(400, { error: 'Unknown visibility' });
		const result = await updateProjectDetails(project, {
			visibility: value as Project['visibility']
		});
		if (result.firstShare && locals.user) {
			announceSharedProject(result.project, locals.user).catch((err) =>
				console.error('Could not announce project', project.id, err)
			);
		}
		return { saved: true };
	},

	upload: async ({ params, request, locals }) => {
		const project = await ownedProject(params.id, locals);
		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { error: 'Choose an .sb3 file' });
		if (file.size > config.SB3_MAX_BYTES) return fail(413, { error: 'That file is too large' });
		const { projectJson, assets } = await mapErrors(async () =>
			unpackSb3(new Uint8Array(await file.arrayBuffer()))
		);
		await mapErrors(() =>
			saveProject({
				projectId: project.id,
				actor: { id: locals.user!.id, username: locals.user!.username },
				projectJson,
				assets,
				message: `Upload ${file.name}`
			})
		);
		return { saved: true };
	},

	remix: async ({ params, locals }) => {
		if (!locals.user) redirect(303, '/login');
		const project = await viewableProject(params.id, locals);
		await enforceRateLimit('project-create', locals.user.id, 60, 60 * 60);
		const projectJson = await decompress(project.projectJson);
		const remix = await mapErrors(() =>
			createProject({
				owner: { id: locals.user!.id, username: locals.user!.username },
				projectJson,
				title: `${project.title} remix`,
				instructions: project.instructions,
				description: project.description,
				remixOfId: project.id,
				inheritedManifest: project.assetManifest,
				message: `Remix of project ${project.id}`
			})
		);
		redirect(303, `/projects/${remix.id}`);
	},

	delete: async ({ params, locals }) => {
		const project = await ownedProject(params.id, locals);
		await deleteProject(project.id);
		redirect(303, `/users/${locals.user!.username}`);
	}
};
