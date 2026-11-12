# abwww

The website for [AstroBlocks](https://github.com/AstroBlocksMod): a place to share Scratch-style
projects with the features TurboWarp users expect, version control for every project, Scratch
account linking for importing your work, and ActivityPub federation. Free software under the
AGPL-3.0.

## Running it

You need [Bun](https://bun.com) 1.4 or newer, PostgreSQL and Valkey. The quickest way to get the
last two is `docker compose up db valkey`.

```sh
cp .env.example .env
bun install
bun run dev
```

The dev server runs migrations on start. To serve the editor from this instance, build it with
`bun run editor:build` (see [docs/editor.md](docs/editor.md)).

For a complete instance in containers, see [docs/self-hosting.md](docs/self-hosting.md).

## Working on it

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands and conventions, and
[docs/architecture.md](docs/architecture.md) for how it is put together.
