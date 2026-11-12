# The editor

The editor is [AstroBlocksMod/monorepo](https://github.com/AstroBlocksMod/monorepo), a fork of
TurboWarp's scratch-gui. It is React; this site is not. The site only ever consumes the editor's
static build output, and nothing from the editor's dependencies is installed here.

## Building

```sh
bun run editor:build
```

This clones the pinned commit into a temporary directory, runs its pnpm build with `ROOT=/editor/`
and copies `packages/scratch-gui/build` to `./editor` (or `EDITOR_DIR`). The editor's own build
needs Node 24, pnpm, Python and Java (for scratch-blocks), about 6 GB of memory, and takes a while.
`EDITOR_SOURCE=../monorepo` builds an existing checkout instead; `EDITOR_REF` picks another
commit.

The site serves whatever is in `EDITOR_DIR` at `/editor/`. The pinned commit is in
`scripts/build-editor.ts`.

## How the site talks to it

Everything goes through URLs the editor already understands, so an unmodified build works:

- **Playing**: the project page embeds `embed.html?project_url=<sb3 url>&autoplay#0` in an iframe.
  The .sb3 carries the assets, so the editor needs no asset host of ours. The frame has a `sandbox`
  with `allow-scripts` and `allow-same-origin`, because the editor's SVG renderer parses costumes
  inside a helper frame of its own and cannot do that from an opaque origin.
- **See inside**: opens `editor.html?project_url=<sb3 url>&project_title=<title>#0` at the top
  level. The editor refuses to run inside a frame unless it is `embed.html`.
- **Private projects**: the owner's page mints a short-lived token and puts it on the URL, since
  the editor runs on another origin without the site's cookies.

Saving from the editor back to the site is not wired yet: the fork has `canSave` off and no way to
point it at another project host. Until that lands, people save an .sb3 from the editor and upload
it on the project page, which becomes a new version. The API already speaks the protocol the
editor's save code expects (`POST /api/projects`, `PUT /api/projects/<id>`,
`POST /api/assets/<md5ext>`, responses with `status: "ok"` and `content-name`), so the editor side
is a small change: read a project host, asset host and token from its URL, and turn saving on.

## Why a separate origin

Projects can carry custom extensions, which are arbitrary JavaScript. Both the player and the
full editor run that code with their own origin's powers, so in production the editor must live on
its own origin (`EDITOR_URL`), where there is no session cookie to use and no site API to call as
the viewer. The server warns at startup when the two origins are the same. The editor also asks
before loading an extension from a project, which is the second line of defense.
