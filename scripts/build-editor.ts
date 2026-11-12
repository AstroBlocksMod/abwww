#!/usr/bin/env bun
/**
 * Builds the AstroBlocks editor from its own repository and places the static output in
 * EDITOR_DIR (default ./editor). The editor keeps its own toolchain (Node, pnpm, rspack, and
 * Python plus Java for scratch-blocks); nothing from it enters this project's dependencies.
 *
 *   bun run editor:build              # clone and build the pinned commit
 *   EDITOR_REF=main bun run editor:build
 *   EDITOR_SOURCE=../monorepo bun run editor:build   # build an existing checkout
 */
import { $ } from 'bun';
import { cp, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const REPO = 'https://github.com/AstroBlocksMod/monorepo.git';
/** The editor commit this site was last tested with. Bump it deliberately. */
const PINNED_REF = '18bd299ddd087a068f6876871d6a8a7bd83e39a6';

const ref = process.env.EDITOR_REF ?? PINNED_REF;
const out = resolve(process.env.EDITOR_DIR ?? './editor');
const source = process.env.EDITOR_SOURCE
	? resolve(process.env.EDITOR_SOURCE)
	: join(process.env.TMPDIR ?? '/tmp', 'abwww-editor-source');

for (const tool of ['node', 'pnpm', 'python3', 'java']) {
	if (!Bun.which(tool)) {
		console.error(`The editor build needs ${tool} on the PATH.`);
		process.exit(1);
	}
}

if (!process.env.EDITOR_SOURCE) {
	if (await Bun.file(join(source, '.git', 'HEAD')).exists()) {
		await $`git -C ${source} fetch --depth 1 origin ${ref}`;
	} else {
		await rm(source, { recursive: true, force: true });
		await $`git clone --filter=blob:none ${REPO} ${source}`;
		await $`git -C ${source} fetch --depth 1 origin ${ref}`;
	}
	await $`git -C ${source} checkout --detach FETCH_HEAD`;
}

console.log(`Building the editor from ${source} ...`);
await $`pnpm install --frozen-lockfile`.cwd(source);
// scratch-vm copies scratch-render's web build during its own build, but the workspace graph does
// not order them, so scratch-render goes first on its own.
await $`pnpm --filter scratch-render run build`.cwd(source);
await $`pnpm --filter "scratch-gui..." run build`.cwd(source).env({
	...process.env,
	NODE_ENV: 'production',
	// The editor is served under /editor/ by the site (or at the root of its own origin).
	ROOT: process.env.EDITOR_ROOT ?? '/editor/',
	NODE_OPTIONS: '--max-old-space-size=6144'
});

const built = join(source, 'packages', 'scratch-gui', 'build');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(built, out, { recursive: true });
console.log(`Editor build copied to ${out}`);
