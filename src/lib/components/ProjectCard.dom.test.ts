import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import ProjectCard from './ProjectCard.svelte';

let instance: ReturnType<typeof mount> | null = null;

afterEach(() => {
	if (instance) unmount(instance);
	instance = null;
	document.body.innerHTML = '';
});

describe('ProjectCard', () => {
	test('links to the project and names the owner', () => {
		instance = mount(ProjectCard, {
			target: document.body,
			props: { id: 42, title: 'Cat goes brr', ownerUsername: 'johndoe' }
		});
		flushSync();
		const link = document.querySelector('a.project-card');
		expect(link?.getAttribute('href')).toBe('/projects/42');
		expect(link?.textContent).toContain('Cat goes brr');
		expect(link?.textContent).toContain('by johndoe');
		expect(document.querySelector('.pill')).toBeNull();
	});

	test('marks projects that are not public', () => {
		instance = mount(ProjectCard, {
			target: document.body,
			props: { id: 1, title: 'Secret', ownerUsername: 'johndoe', visibility: 'private' }
		});
		flushSync();
		expect(document.querySelector('.pill')?.textContent).toBe('private');
	});
});
