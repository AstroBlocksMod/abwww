import adapter from '@sveltejs/adapter-bun';
import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Runes everywhere except inside node_modules. Can go once Svelte 6 makes runes the default.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				out: 'build',
				precompress: true
			}),
			csrf: {
				// The editor and player run on their own origin and call the API with bearer tokens,
				// never with cookies, so they are not trusted origins for form posts.
				trustedOrigins: []
			}
		})
	],
	server: {
		// CORS for the API is handled in hooks.server.ts; the dev server must let preflights through.
		cors: { preflightContinue: true }
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				// Components in a real browser: *.svelte.test.ts
				extends: './vite.config.ts',
				test: {
					name: 'browser',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				// A simulated DOM for component logic that does not need a browser: *.dom.test.ts
				extends: './vite.config.ts',
				resolve: { conditions: ['browser'] },
				test: {
					name: 'dom',
					environment: 'happy-dom',
					include: ['src/**/*.dom.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			}
		]
	}
});
