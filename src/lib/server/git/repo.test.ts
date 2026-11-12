import { describe, expect, test } from 'bun:test';
import { minimalProjectJson } from '../projects/fixtures.js';
import { commitSnapshot, listHistory, readSnapshot } from './repo.js';

const author = { name: 'tester', email: 'tester@localhost' };

describe('git repo', () => {
	test('records versions and reads them back', async () => {
		const projectId = Math.floor(Math.random() * 1e9);
		const first = minimalProjectJson({ extensions: ['pen'] });
		const second = minimalProjectJson({ extensions: ['pen', 'music'] });
		const manifest = { 'abc.svg': 'f'.repeat(64) };

		const oid1 = await commitSnapshot(projectId, { projectJson: first, manifest }, author, 'First');
		const oid2 = await commitSnapshot(
			projectId,
			{ projectJson: second, manifest },
			author,
			'Second'
		);
		expect(oid1).not.toBe(oid2);

		const history = await listHistory(projectId);
		expect(history.map((entry) => entry.message)).toEqual(['Second', 'First']);
		expect(history[0]?.parent).toBe(oid1);
		expect(history[1]?.parent).toBeNull();

		expect(await readSnapshot(projectId, oid1)).toEqual({ projectJson: first, manifest });
		expect(await readSnapshot(projectId, oid2)).toEqual({ projectJson: second, manifest });
	});

	test('refuses commits that belong to another project', async () => {
		const a = Math.floor(Math.random() * 1e9);
		const b = a + 1;
		const oid = await commitSnapshot(
			a,
			{ projectJson: minimalProjectJson(), manifest: {} },
			author,
			'A'
		);
		await commitSnapshot(b, { projectJson: minimalProjectJson(), manifest: {} }, author, 'B');
		expect(await readSnapshot(b, oid)).toBeNull();
		expect(await readSnapshot(b, 'not-a-sha')).toBeNull();
		expect(await listHistory(a + 2)).toEqual([]);
	});
});
