import { page } from 'vitest/browser';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Player from './Player.svelte';

describe('Player', () => {
	test('embeds the player in a frame that cannot navigate the page', async () => {
		const src = 'http://localhost:5173/editor/embed.html?project_url=x#0';
		await render(Player, { src, title: 'My project' });
		const frame = page.getByTitle('My project');
		await expect.element(frame).toBeInTheDocument();
		const element = frame.element() as HTMLIFrameElement;
		expect(element.getAttribute('src')).toBe(src);
		const sandbox = element.getAttribute('sandbox') ?? '';
		// The SVG renderer inside the editor needs these two.
		expect(sandbox).toContain('allow-scripts');
		expect(sandbox).toContain('allow-same-origin');
		expect(sandbox).not.toContain('allow-top-navigation');
	});
});
