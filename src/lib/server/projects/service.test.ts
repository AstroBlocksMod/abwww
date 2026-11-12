import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { registerUser } from '../auth/users.js';
import { runMigrations } from '../db/migrate.js';
import { users, type User } from '../db/schema/index.js';
import { listHistory } from '../git/repo.js';
import { db } from '../platform/db.js';
import { backdropMd5Ext, backdropSvg, minimalProjectJson } from './fixtures.js';
import {
	canView,
	createProject,
	getProject,
	listByOwner,
	listRecentlyShared,
	ProjectError,
	readProjectAssets,
	readProjectJson,
	restoreVersion,
	saveProject,
	updateProjectDetails
} from './service.js';

let owner: User;
let other: User;

beforeAll(async () => {
	await runMigrations();
	owner = await registerUser(`t_${crypto.randomUUID().slice(0, 12)}`, 'password123');
	other = await registerUser(`t_${crypto.randomUUID().slice(0, 12)}`, 'password123');
});

afterAll(async () => {
	// Projects cascade with their owners.
	await db.delete(users).where(eq(users.id, owner.id));
	await db.delete(users).where(eq(users.id, other.id));
});

describe('projects', () => {
	test('creates, saves, lists and restores, with every save as a version', async () => {
		const actor = { id: owner.id, username: owner.username };
		const created = await createProject({
			owner: actor,
			projectJson: minimalProjectJson(),
			assets: new Map([[backdropMd5Ext, backdropSvg]]),
			title: 'Hello',
			message: 'Create'
		});
		expect(created.title).toBe('Hello');
		expect(created.visibility).toBe('private');
		expect(created.assetManifest[backdropMd5Ext]).toMatch(/^[0-9a-f]{64}$/);
		expect(created.headCommit).toMatch(/^[0-9a-f]{40}$/);
		expect(JSON.parse(new TextDecoder().decode(await readProjectJson(created)))).toEqual(
			JSON.parse(minimalProjectJson())
		);
		expect((await readProjectAssets(created)).get(backdropMd5Ext)).toEqual(backdropSvg);

		// Assets already in the project do not need to be sent again.
		const saved = await saveProject({
			projectId: created.id,
			actor,
			projectJson: minimalProjectJson({ extensions: ['pen'] }),
			message: 'Save'
		});
		expect(saved.headCommit).not.toBe(created.headCommit);
		expect(saved.assetManifest).toEqual(created.assetManifest);

		const history = await listHistory(created.id);
		expect(history.map((entry) => entry.message)).toEqual(['Save', 'Create']);

		const restored = await restoreVersion(created.id, created.headCommit!, actor);
		expect(JSON.parse(new TextDecoder().decode(await readProjectJson(restored)))).toEqual(
			JSON.parse(minimalProjectJson())
		);
		expect((await listHistory(created.id)).length).toBe(3);

		expect(await listByOwner(owner.id, true)).toHaveLength(1);
		expect(await listByOwner(owner.id, false)).toHaveLength(0);
		expect(canView(restored, null)).toBe(false);
		expect(canView(restored, { id: owner.id })).toBe(true);

		const { project: shared, firstShare } = await updateProjectDetails(restored, {
			visibility: 'public'
		});
		expect(firstShare).toBe(true);
		expect(shared.sharedAt).not.toBeNull();
		expect((await listRecentlyShared()).some((p) => p.id === shared.id)).toBe(true);
	});

	test('refuses saves by other users and projects with missing assets', async () => {
		const actor = { id: owner.id, username: owner.username };
		await expect(
			createProject({ owner: actor, projectJson: minimalProjectJson(), message: 'No assets' })
		).rejects.toBeInstanceOf(ProjectError);

		const created = await createProject({
			owner: actor,
			projectJson: minimalProjectJson(),
			assets: new Map([[backdropMd5Ext, backdropSvg]]),
			message: 'Create'
		});
		await expect(
			saveProject({
				projectId: created.id,
				actor: { id: other.id, username: other.username },
				projectJson: minimalProjectJson(),
				message: 'Hijack'
			})
		).rejects.toMatchObject({ status: 403 });
		expect(await getProject(created.id)).not.toBeNull();
	});

	test('rejects an asset whose bytes do not match its md5 name', async () => {
		const actor = { id: owner.id, username: owner.username };
		await expect(
			createProject({
				owner: actor,
				projectJson: minimalProjectJson(),
				assets: new Map([[backdropMd5Ext, new TextEncoder().encode('<svg/>')]]),
				message: 'Bad asset'
			})
		).rejects.toMatchObject({ status: 400 });
	});
});
