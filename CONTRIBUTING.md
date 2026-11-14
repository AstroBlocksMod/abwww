# Contributing

Thanks for helping out. This page is the short version for people; the longer rulebook that
coding agents follow is [AGENTS.md](AGENTS.md), and you do not need to read it.

## Setup

You need [Bun](https://bun.com) 1.4 or newer and Docker (for PostgreSQL and Valkey).

```sh
cp .env.example .env
docker compose up -d db valkey
bun install
bun run dev
```

The dev server is on http://localhost:5173 and runs migrations on start. The editor is a separate
build; `bun run editor:build` fetches and builds it (see [docs/editor.md](docs/editor.md)). Without
it the site works, but projects cannot be played.

## Commands

| Command               | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `bun run dev`         | Dev server with hot reload.                                          |
| `bun run check`       | Type checks everything, Svelte files included. CI runs this.         |
| `bun run lint`        | Lints with oxlint, Svelte files included. CI runs this.              |
| `bun fmt`             | Formats. `bun fmt --check` is what CI runs.                          |
| `bun run test:server` | Server tests (`bun test`) against the compose PostgreSQL and Valkey. |
| `bun run test:unit`   | Component tests with Vitest, in Chromium and in happy-dom.           |
| `bun run test`        | Both of the above.                                                   |
| `bun run db:generate` | Writes a migration after you change `src/lib/server/db/schema/`.     |
| `bun run build`       | Production build. `bun run preview` runs it.                         |

## Conventions

- Bun for everything: `bun install`, `bun run`, `bunx`. No npm, pnpm or Node.
- Svelte with runes, strict TypeScript, `#lib/...` imports with file extensions.
- Anything that calls a `Bun.*` API lives in `src/lib/server/platform/`. Everything else imports
  from there, so the app can move to another host later by rewriting that one folder.
- Schema changes come with their generated migration in the same commit. Never edit a migration
  that has shipped.
- Update the docs in `docs/` with the code, and tick off roadmap items where they are.
- American spelling, no em dashes, no filler. Write like a person.
- Commit messages say what changed and why. Keep pull requests focused; a stack of small ones
  beats one huge one.

## Reporting problems

Open an issue with what you did, what you expected and what happened. For anything that could be
a security problem, contact the maintainers privately first.
