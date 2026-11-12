# Self-hosting

An instance is three services: the site (Bun), PostgreSQL and Valkey. `compose.yaml` runs all of
them.

```sh
git clone https://github.com/AstroBlocksMod/abwww.git
cd abwww
cp .env.example .env
# Set ORIGIN to the public URL, pick a POSTGRES_PASSWORD, read through the rest.
docker compose up --build -d
```

The app listens on port 3000 (change it with `PORT` in `.env`). Put a reverse proxy with TLS in
front of it and set `ORIGIN` to that public URL; federation signs everything with it. Behind a
proxy, also set `ADDRESS_HEADER=X-Forwarded-For` so rate limits see client addresses.

Migrations run automatically on start. Data lives in three volumes: `data` (assets and the git
repositories of projects), `postgres` and `valkey`. Back up all three.

## The editor

The editor is a separate build. Build it once with `bun run editor:build` on a machine with Node,
pnpm, Python and Java, and put the output in `./editor`; compose mounts that directory into the
container. Details in [editor.md](editor.md).

In production, serve the editor from its own origin. Point a second hostname (for example
`editor.example.com`) at the same app and set `EDITOR_URL=https://editor.example.com/editor`. The
site's session cookie never reaches that origin, which is what keeps custom extensions in projects
from acting as the person who opened them.

## Configuration

Every variable is read once at start; a wrong value stops the server with a message.

| Variable                       | Default                  | Meaning                                                                   |
| ------------------------------ | ------------------------ | ------------------------------------------------------------------------- |
| `ORIGIN`                       | required in production   | Public URL, no trailing slash.                                            |
| `SITE_NAME`                    | `AstroBlocks`            | Shown in the header and in NodeInfo.                                      |
| `DATABASE_URL`                 | required in production   | PostgreSQL connection string.                                             |
| `VALKEY_URL`                   | `redis://localhost:6379` | Valkey connection string.                                                 |
| `DATA_DIR`                     | `./data`                 | Assets and git repositories.                                              |
| `EDITOR_DIR`                   | `./editor`               | The editor's static build, served at `/editor`.                           |
| `EDITOR_URL`                   | `${ORIGIN}/editor`       | Where browsers load the editor from. Use a separate origin in production. |
| `SCRATCH_VERIFY_PROJECT_ID`    | unset                    | Scratch project whose comments carry verification codes.                  |
| `SCRATCH_VERIFY_PROJECT_OWNER` | unset                    | That project's owner. Both unset turns account linking off.               |
| `SCRATCH_CONTACT`              | unset                    | Contact information sent to Scratch in the User-Agent.                    |
| `PROJECT_JSON_MAX_BYTES`       | 20 MiB                   | Largest project.json accepted.                                            |
| `ASSET_MAX_BYTES`              | 25 MiB                   | Largest single costume or sound.                                          |
| `SB3_MAX_BYTES`                | 200 MiB                  | Largest .sb3 upload.                                                      |
| `SESSION_TTL_DAYS`             | 30                       | How long a sign-in lasts without activity.                                |
| `REGISTRATION`                 | `open`                   | `open` or `closed`.                                                       |
| `FEDERATION`                   | `true`                   | ActivityPub on or off.                                                    |
| `MIGRATIONS_DIR`               | `drizzle`                | Where the SQL migrations are.                                             |
| `BODY_SIZE_LIMIT`              | `512K` (adapter)         | Raise it (`256M`) so uploads fit. Read by the Bun adapter.                |
| `PORT`, `HOST`                 | `3000`, all interfaces   | Listener. Read by the Bun adapter.                                        |

## Scratch account linking

Make a Scratch project on an account you control (any project, comments on), and set
`SCRATCH_VERIFY_PROJECT_ID` and `SCRATCH_VERIFY_PROJECT_OWNER`. Users get a code on the settings
page, post it as a comment there, and the site reads the comment to confirm who they are. Set
`SCRATCH_CONTACT` so the Scratch team can reach you if the instance misbehaves.

## Updating

```sh
git pull
docker compose up --build -d
```

Migrations never edit old files, so updating forward is always safe. Downgrading is not supported.
