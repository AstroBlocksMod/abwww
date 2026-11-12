# Architecture

SvelteKit 3 on Bun, PostgreSQL through Drizzle, Valkey for everything short-lived, local disk for
assets and git repositories. One process does everything, including the federation queue.

```mermaid
flowchart LR
    Browser -->|HTML, forms| Site[SvelteKit on Bun]
    Editor[Editor and player<br>separate origin] -->|GET sb3, bearer token| API[/api/ routes]
    API --> Site
    Site --> PG[(PostgreSQL)]
    Site --> VK[(Valkey)]
    Site --> Disk[(DATA_DIR<br>assets, git)]
    Site <-->|ActivityPub| Fediverse
    Site -->|verification comments, imports| Scratch
```

## Where things are

- `src/lib/server/platform/`: the only code that calls `Bun.*`. Database handle, Valkey client,
  zstd, hashing, passwords, blob store, filesystem for git, ids.
- `src/lib/server/db/`: Drizzle schema and the migration runner. `drizzle/` holds the migrations.
- `src/lib/server/auth/`: users, sessions (Valkey), editor tokens (Valkey).
- `src/lib/server/assets/`: content-addressed storage and the staging area for editor uploads.
- `src/lib/server/projects/`: sb3 packing, project.json validation, the project service (create,
  save, restore, visibility), URLs for the editor.
- `src/lib/server/git/`: one bare repository per project, written with isomorphic-git plumbing.
- `src/lib/server/scratch/`: the Scratch API client, account verification, imports.
- `src/lib/server/federation/`: Fedify setup, the Valkey-backed KV store and queue.
- `src/routes/api/`: what the editor calls. `src/routes/` otherwise: pages and form actions.
- `src/routes/editor/`: serves the editor's static build from `EDITOR_DIR`.

## A save, step by step

1. The JSON is validated against the sb3 shape and every `md5ext` it names is collected.
2. Each name is resolved to a sha256: from bytes sent with the save (checked against the md5 in
   the name), from the previous version's manifest, or from the user's staged uploads. Anything
   unresolved fails the save. Nothing is looked up by md5 across projects.
3. The JSON is re-serialized, compressed with zstd and stored on the project row with its sha256
   and size, alongside the new manifest.
4. The pretty-printed JSON and the manifest are committed to the project's git repository, and
   the commit id is stored on the row. Saves to one project are serialized with a Valkey lock.

Serving the current JSON sends the stored zstd bytes as is when the client accepts zstd. The .sb3
endpoint rebuilds the archive from the manifest.

## Trust boundaries

- Project files are untrusted: sizes are checked from the zip's central directory before anything
  is inflated, names must be `project.json` or `<md5>.<ext>`, and the JSON must validate.
- The player and the editor live on another origin in production (`EDITOR_URL`) and
  authenticate with per-project tokens, never cookies. The player's iframe sandbox stops it from
  navigating the page, but it needs `allow-same-origin` for the editor's SVG renderer, so the
  separate origin is what matters.
- Everything from Scratch's API and from the fediverse is parsed with a schema or by Fedify.
- md5 only ever identifies an asset inside one project. sha256 is the storage key.

## What moves with the hosting

Vercel: `platform/` changes drivers (Postgres and Valkey clients, blob store to object storage),
the git filesystem gets an object-storage backend, and the queue needs a worker. Workers: the
same, plus zstd through WebAssembly and `Bun.password` through a Web Crypto implementation. The
rest of the code does not know the difference.
