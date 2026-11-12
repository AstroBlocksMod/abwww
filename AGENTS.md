# abwww

## Overview

abwww is the website for AstroBlocks: an alternative to the Scratch website, with TurboWarp-level features on top. The MVP is in place; `docs/roadmap.md` says what is done and what is next. When something here stops matching the code, fix it here. License: AGPL-3.0, so anyone running a modified copy as a service has to publish their source.

What it does:

- **Projects**: create, share, remix, comment, studios, the usual Scratch site features. Projects run in a player that has TurboWarp's features: the compiler, turbo mode, custom FPS, interpolation, high quality pen, custom stage sizes, and custom extensions.
- **Scratch account linking**: users prove they own a Scratch account by posting a verification code as a comment, the way AmpMod and CodeTorch do it. A linked account can import its projects from Scratch. We never ask for, see or store a Scratch password.
- **Version control**: every project is a git repository managed with [isomorphic-git](https://isomorphic-git.org). Saves become commits, and users get history, diffs, branches and reverts.
- **Federation**: users, projects and comments federate over ActivityPub through [Fedify](https://fedify.dev).
- **Self-hosting**: one `docker compose up` brings up a complete instance.

Stack:

- TypeScript everywhere, Svelte with runes, SvelteKit 3 (all configuration lives in `vite.config.ts`; there is no `svelte.config.js` any more), and the official `@sveltejs/adapter-bun` (1.0, needs Bun 1.4 or newer). The community `svelte-adapter-bun` package is deprecated, so don't use it.
- PostgreSQL for the database, through [Drizzle ORM](https://orm.drizzle.team) v1 on its `drizzle-orm/bun-sql` driver (`Bun.sql` underneath), with drizzle-kit for migrations.
- Valkey for key-value data (sessions, rate limits, verification codes, caches, Fedify's KV store and queue), through `Bun.redis` / `Bun.RedisClient`.
- zstd for stored `project.json` files, through `Bun.zstdCompress` and `Bun.zstdDecompress`.
- The editor is [AstroBlocksMod/monorepo](https://github.com/AstroBlocksMod/monorepo), a React fork of scratch-gui, scratch-vm, scratch-blocks, scratch-render and scratch-paint. It is built separately and dropped in as static files (see "The editor" below).

Hosting: self-hosted for now. If we grow to thousands of users we will likely move to Vercel. Cloudflare Workers is a distant second choice, since Workers does not run Bun and every Bun API would have to be swapped. Write code so that either move is a contained job, not a rewrite (see "Keep Bun behind a seam").

## Layout

- `src/routes/`: SvelteKit pages (form actions for everything the site itself does) and `api/` endpoints (what the editor calls). `src/routes/editor/` serves the editor's static build from `EDITOR_DIR`.
- `src/lib/components/`: Svelte components.
- `src/lib/server/`: server-only code. SvelteKit refuses to import it from client code, which is the point.
  - `platform/`: the only place that touches `Bun.*` or `bun:*` (database, Valkey, compression, hashing, passwords, blob store, filesystem for git, ids).
  - `db/`: the Drizzle schema (`schema/`, one file per area: users, projects, assets, federation) and the migration runner. drizzle-kit reads it through `drizzle.config.ts` at the root and writes migrations to `drizzle/`.
  - `auth/`: users, sessions and editor tokens (both in Valkey).
  - `assets/`: content-addressed storage and the staging area for assets the editor uploads before a save.
  - `projects/`: sb3 packing, `project.json` validation, the project service (create, save, restore, visibility) and the URLs the editor is opened with.
  - `git/`: one bare repository per project through isomorphic-git plumbing.
  - `scratch/`: the client for the Scratch API, account verification and project import.
  - `federation/`: the Fedify `Federation` object and its Valkey-backed KV store and message queue.
  - `api/`: helpers shared by `src/routes/api/` (callers, body limits, error mapping).
  - `config.ts`: every environment variable, validated once at startup.
- `src/hooks.server.ts`: `init` runs migrations and starts the federation queue; `handle` is Fedify's hook, CORS for `/api/`, then sessions.
- `editor/`: the editor's build output, not source; git ignores it. `scripts/build-editor.ts` produces it.
- `docs/`: `self-hosting.md`, `editor.md`, `architecture.md`, `roadmap.md`.
- `Dockerfile` and `compose.yaml`: the self-hosting setup (app, PostgreSQL, Valkey).

Imports use `#lib/...` (SvelteKit 3 replaced `$lib`), with file extensions, as in `#lib/server/config.js`.

## Building and testing

`CONTRIBUTING.md` has the setup and the command table; this is what matters beyond it.

Use Bun for everything: `bun install`, `bun run`, `bunx`, `bun test`. Do not use npm, pnpm, yarn or Node. The lock file is `bun.lock`; commit it whenever `package.json` changes.

- `bun run check` is the authoritative type check. It runs `svelte-check --tsgo`: TypeScript 7's native checker, with TypeScript 6 installed too because svelte-check's own Svelte-to-TypeScript transform still needs it. Run it before saying anything type checks.
- Server tests are `bun test` over `src/lib/server`, because that code uses Bun APIs. They sit next to the code as `*.test.ts` and run against a real PostgreSQL and Valkey (`TEST_DATABASE_URL` and `TEST_VALKEY_URL` override the defaults) with a throwaway `DATA_DIR`, all set up by `src/lib/server/test-setup.ts`. Tests that create rows clean them up.
- Component tests are Vitest: `*.svelte.test.ts` runs in a real Chromium through `@vitest/browser-playwright` and `vitest-browser-svelte`; `*.dom.test.ts` runs in happy-dom, for component logic that needs a DOM but not a browser. Pick the cheapest one that proves the point. `bun test` must never pick these up, which is why `test:server` is pointed at `src/lib/server`; keep it that way.
- Never call the real Scratch API from tests; record responses instead.
- Test data, fixtures, seeded demo accounts and screenshots use placeholder names such as `johndoe` and `janedoe`, never a real person's name.
- `docker compose up --build` is the full stack, the same way a self-hoster runs it. Use it to check the Dockerfile and compose changes, not just the dev server.

## Verifying in a Browser

If you have it installed, use the Playwright MCP for this. If not, use the Playwright CLI instead. You can use the CLI over the MCP if you need to use a browser other than the one that is configured.

Check UI changes in the running app, not just by reading the code. For anything touching the editor or player, load a real project and make sure it runs.

## Searching the Codebase

Use fast, modern tools instead of the slow defaults:

- [`rg`](https://github.com/BurntSushi/ripgrep) (ripgrep) for text search, not `grep`. It respects `.gitignore` for you. **NOTE**: Prefer to use [`ast-grep`](https://ast-grep.github.io) when applicable as it uses the structure of the code instead.
- [`fd`](https://github.com/sharkdp/fd) for finding files by name, not `find`.
- [`ast-grep`](https://ast-grep.github.io) for structural searches and rewrites, like finding every call to a function or every component that uses a certain prop. Call it as `ast-grep`. The `sg` alias is deprecated, so don't use it.
- `jq` for reading and querying JSON.

If your harness has dedicated search or file tools that already wrap these, those are fine too.

The Bun docs MCP server is configured in `.mcp.json`. Use it for Bun questions instead of relying on memory, since Bun changes quickly.

## Code Quality

Always lint and format:

- Format with `bun fmt`. It is Prettier-compatible, formats `.svelte` files natively and is configured in `bunfig.toml` under `[fmt]`. Do not add Prettier or `prettier-plugin-svelte`.
- Lint with `bun lint` once the Bun release in use has it (it is in Bun's docs but not in 1.4.4). Do not add ESLint or oxlint. Until then, `bun run check` is the gate: svelte-check reports unused code and accessibility problems in `.svelte` files as well as type errors.

Use modern code practices:

- Svelte runes (`$state`, `$derived`, `$effect`, `$props`) only. No legacy `$:` statements, `export let`, or stores where a rune does the job.
- Strict TypeScript, with `noUncheckedIndexedAccess`. No `any` without a comment saying why. Validate everything that comes from outside (requests, Scratch API responses, uploaded projects, federated activities) at the boundary with a zod schema, then trust the types inside.
- Use web standard APIs (`fetch`, `Request`, `Response`, `URL`, `crypto.subtle`, streams, `CompressionStream`) before anything runtime-specific.
- Use form actions and `load` functions where they fit, and plain `+server.ts` endpoints for the API that the editor and other clients call.

### Keep Bun behind a seam

Use native Bun APIs when they are worth it: `Bun.sql`, `Bun.redis`, `Bun.zstdCompress`, `Bun.CryptoHasher`, `Bun.password`, `Bun.file`, `Bun.S3Client`, `Bun.randomUUIDv7`, `bun:test`. Do not use Bun's built-ins for small formats that are easy to get elsewhere, like YAML, TOML, JSON5 or JSONL. A tiny portable package or a few lines of code does the job without tying us to Bun.

Every `Bun.*` and `bun:*` use goes in `src/lib/server/platform/`, behind a small interface written for our needs (not a wrapper that mirrors Bun's whole API). Routes, components and the rest of `src/lib/server/` import from `platform/`, never from Bun directly. Moving to Vercel or Workers should mean rewriting `platform/` and nothing else. `bun:test` in test files is the one exception.

### Database

- Use Drizzle for all queries. `platform/` creates the one `drizzle()` instance on the `bun-sql` driver, and everything else imports that instance. Moving off Bun means switching that file to another Postgres driver (postgres.js, Neon, or Hyperdrive on Workers).
- The schema in `src/lib/server/db/schema/` is the source of truth. Change the schema, run `drizzle-kit generate`, review the SQL it writes, and commit both together. Never edit a migration after it ships, and never hand-edit a migration's snapshot.
- `drizzle-kit push` is for throwaway local databases only. Never use it against a database anyone else uses.
- Infer row types from the schema (`$inferSelect`, `$inferInsert`) instead of writing them out by hand.
- If you need raw SQL, use Drizzle's `sql` template so values stay parameterized. Never build SQL by concatenating strings.

Do not keep state in process memory that has to survive a request (sessions, rate limits, caches, locks). It goes in Valkey or PostgreSQL, so the app can run as several instances or as serverless functions later.

### The editor

The editor is React, the website is not. Never add React, or any other dependency of the AstroBlocks packages, to this project's `package.json`, and never import editor source from website code. The editor is built in its own repository with its own toolchain (pnpm, rspack), and this project only consumes the static build output.

The site and the editor talk only through URLs the editor already understands (`project_url`, `project_title`, the `#0` hash) and the API the editor's save code expects (`POST /api/projects`, `PUT /api/projects/<id>`, `POST /api/assets/<md5ext>`). `docs/editor.md` has the details and what is still missing on the editor side. Everything that builds those URLs is in `src/lib/server/projects/urls.ts`.

TurboWarp-style custom extensions can run arbitrary JavaScript, and shared projects can bring them along. The player is an iframe whose `sandbox` must keep `allow-same-origin` (the editor's SVG renderer parses costumes in a helper frame and breaks without it), and the editor is opened top level, so neither is isolated by the browser. What isolates them is the separate origin: in production the editor is served from `EDITOR_URL` on its own hostname, where there is no session cookie and a project cannot act as the person viewing it. Editor tokens, not cookies, authenticate the editor to the API. Never make the editor origin a trusted origin for forms, and never let `/api/` accept cookies from cross-origin requests.

### Scratch accounts

The verification flow:

1. The signed-in user asks to link a Scratch username. The server makes a random code, stores it in Valkey with the username and a short TTL (around 10 minutes), and shows it.
2. The user posts the code as a comment in the place we tell them (a designated project, or their own profile).
3. The server fetches recent comments from the Scratch API and links the account only if a comment by that exact username (case-insensitive) contains the exact code. Then it deletes the code.

Rules:

- Codes are single use, expire, and are rate limited per user and per Scratch username.
- A Scratch account links to at most one local account. Relinking needs a fresh verification.
- All calls to Scratch go through `src/lib/server/scratch/`. It sends a User-Agent naming the site and instance URL, caches responses, and backs off on 429 and 5xx. Be a polite client, we depend on Scratch tolerating us.
- Import only projects that the linked Scratch account owns.

### Assets: md5 and sha256

Scratch names assets by md5 (`assetId`, `md5ext` in `project.json`). md5 has practical collisions, so we never trust it to identify content:

- Store every asset by the sha256 of its bytes. sha256 is the only key for dedupe and for storage.
- Leave `md5ext` and `assetId` unchanged in `project.json` so projects stay compatible with Scratch, TurboWarp and the editor.
- Each project version has a manifest mapping its `md5ext` values to sha256. Resolve a project's md5 references through that manifest, never through a global md5 lookup. Otherwise someone could upload a colliding file and have it show up in someone else's project.
- On upload or import, hash the actual bytes. Reject an asset whose md5 doesn't match the name it was uploaded under.
- Legacy-style asset URLs (`/internalapi/asset/<md5ext>/get/`) are fine, but they resolve within a project or with an explicit sha256, never globally.

### Projects and compression

- `project.json` is stored zstd-compressed, along with the sha256 of the uncompressed bytes. Serve the compressed bytes as is with `Content-Encoding: zstd` when the client's `Accept-Encoding` allows it, and decompress only for clients that don't.
- Limit sizes before and after decompression (configurable, with sensible defaults) to stop zstd and zip bombs.
- `.sb3` files are zip archives. Bun has no native zip API (`Bun.Archive` is tar only), so use a maintained zip library and stream where it can. Reject entries with absolute paths or `..`.
- Validate project JSON against the sb3 schema before storing it. Anything uploaded is untrusted.

### Version control

- isomorphic-git runs on a filesystem interface. Write that backend once in `src/lib/server/git/` on top of `platform/` storage (local disk now, object storage later), so nothing assumes a persistent local disk.
- Commit `project.json` uncompressed and deterministically serialized, so diffs show real changes. Git compresses objects itself. Commit the md5 to sha256 asset manifest alongside it, not the asset bytes.
- Git object IDs are SHA-1. Use them for history only, never to identify or verify assets.

### Federation

- Fedify plugs in as `fedifyHook` in `src/hooks.server.ts`. Keep the dispatchers and listeners in `src/lib/server/federation/`.
- Fedify's KV store and message queue use Valkey (or PostgreSQL). If the official Fedify adapters would pull in a second client library (ioredis or postgres.js), implement Fedify's `KvStore` and `MessageQueue` interfaces on our `platform/` clients instead.
- Treat every incoming activity as untrusted: verify signatures (Fedify does this, don't turn it off), validate, rate limit per remote instance, and keep a per-instance block list.

### Self-hosting

- All configuration comes from environment variables, read and validated in one place at startup, with every variable documented in `docs/` and listed in `.env.example`. Fail fast with a clear message when one is missing.
- `compose.yaml` must keep working with nothing but Docker installed. If you add a service or a variable, update `compose.yaml`, `.env.example` and the self-hosting docs in the same change.
- Drizzle's migrator applies pending migrations automatically on startup. Running it twice is harmless.

## Docs (IMPORTANT!!!)

Always update the docs if necessary when changing or adding code. If the docs already contain outdated information, expand your scope to cover that info too. That includes this file: when the plan above stops matching the code, fix it.

When a roadmap item is finished, check it off (`- [x]`) where it is. DO NOT move it into an earlier section like "Done: the MVP". The roadmap shows how each goal is progressing, so finished items stay with the section they belong to.

## Diagrams as Mermaid, not ASCII art

Never draw a flow, pipeline or architecture picture out of characters in a code block. Make a Mermaid diagram instead.

## Outdated packages

PLEASE, PLEASE do not use a package that is old or deprecated. EVEN IF IT IS "INDUSTRY STANDARD" THAT DOES NOT MEAN IT IS GOOD!!! USE THE BEST PACKAGE AND LATEST VERSION LIKE A NORMAL PERSON WOULD!

Check the current release with `bun info <package>` before adding or bumping a dependency. Before adding any dependency at all, check whether Bun or the web platform already does the job.

## Keep things human

Do no use em dashes or other special symbols not normally found in writing. Do not word things in a weird way. Keep it looking human. If you need to use, for example, an arrow icon, use an SVG instead.

Replacing an em dash with a hyphen is NOT a fix. A spaced hyphen doing an em dash's job ("the limit - 4 bytes", "fast - but wrong") is the same tic with a different character. Reword the sentence instead: use a comma, a colon, parentheses, or the actual word ("minus", "to", "through"). Plain hyphens in compound words and numeric ranges like 0-1 are fine.

## Use American spelling

It's fine to be British in the chat if the person is actually in a region where its spelled like that. But if not just use American spelling. The thing itself MUST use American spelling.
