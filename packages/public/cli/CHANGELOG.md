# Changelog

## Unreleased

- The extension template's backend uses port 8787, so it doesn't clash with the Andesine web
  app's dev server on port 3000.
- Validate the new element view fields `content`, `props`, and the descendants' `name`,
  `description`, and `icon`; `extensions build` generates the descendants' icons.

## 0.7.0

- Add `andesine mcp`: an MCP server over stdio for AI agents, with `--read-only`. Its
  `upload_image` tool uploads local images for entries. It also has resources (entries,
  published content, collection schemas, a workspace overview, and an MDX guide, with path
  completion) and prompts (`draft-entry`, `update-docs`, `review-entry`, `answer`,
  `release-notes`, and `reorganize`).
- `andesine init` sets up type generation, the MCP server, or both. `--mcp` adds the
  MCP server to `.mcp.json` and to the Cursor, Gemini CLI, and Codex files of the
  project; `--types` and `--no-types` select type generation. An interactive init asks
  what to set up.
- `andesine mcp` stops with an error when no workspace is selected.
- Add `mcpName` (`app.andesine/andesine`) for the official MCP Registry.
- Add the `entries move`, `entries bulk-update`, `entries bulk-move`, `collections move`, and
  `publishing update-channel` commands. `versions create` takes an optional
  `document`. `entries update` takes `document`, `expectedHash`, and `version`, and prints the
  new hash. `entries create` takes an optional `document`. Content reads take `--content-format mdx`
  (or `blocks` for entries), and content writes take `--mdx`. `entries update` takes
  `--operations`, and `entries create` takes `--fields`. The `assets attach` command is removed;
  content writes attach the images they reference. `entries create` takes `--path`; target collections also take
  `--collection-path`, `--collection-slug-path`, and the `--parent-*` and `--new-parent-*`
  forms; and renames
  and moves take `--expected-name`, `--expected-collection-id`, and `--expected-parent-id`.

## 0.6.0

- Validate extension manifests with the 0.6.0 rules: `settingsSections` is no longer
  accepted, and element views accept a `description` and an `icon`, whose CSS
  `extensions build` generates with the other manifest icons.
- Update the `extensions init` template: block action samples without UI (“Shout”), with a
  `Menu` (“Count words”), and with a `Dialog` (“Wrap in Note”); a “More” menu and an “About”
  dialog in the panel sample; a description and an icon for the Note view; and a local setup
  guide in its README. The bookmarks panel and the About settings section samples, and the
  declared request URL, are removed.
- Simplify the buttons of the `pages init` template: one `variant` (`primary`, `secondary`, or
  `ghost`) replaces `variant` and `color`, and buttons default to the small size.

## 0.5.0

- Accept the `extensions` role permission (manage workspace extensions) in role commands.
- Add `andesine extensions init [directory]`, which creates an extension with a backend
  from the template of the same release and generates its first backend key.
- Add `andesine extensions build`: manifest validation with the registry rules, the
  frontend bundle with the generated `startExtension` call, view and icon CSS, and
  `dist/extension.json` with the artifact digests and sizes.
- Add `andesine extensions keys generate`, `check`, and `revoke`. Private keys stay in
  `.andesine/keys` and are never uploaded.
- Leave extension-only API operations (which need extension JWTs) out of the generated
  command bindings.
- Add `andesine extensions dev`, which runs an extension on a local instance for the
  signed-in member: it uploads each build with a development key, reloads it on changes,
  writes the key and the instance URL to the backend's `.env`, and stops it on exit
  (`--remove` uninstalls it; `--backend <url>` points it at a local backend). It refuses hosts
  that are not local.
- Add `andesine extensions test-event <webhook> <type>` for sample events to the
  development extension's webhooks.
- Add `andesine extensions registry check` and `registry build` for extension registry CI:
  validation with the instance rules, new versions without overwriting published ones, and
  the registry index.

## 0.4.0

- Add `andesine pages init [directory]`, which creates an Andesine Pages site from
  the template of the same release in a new or empty directory (default `docs`).
- Depend on `@andesine/sdk` 0.4.0. Align the version with the other Andesine
  packages.

## 0.3.0

- Add generated webhook commands for management (including bulk enable/disable and
  delete), delivery history, signed tests, and single or bulk replay.

## 0.2.0

- Add slug-path API flags, collection selection, and generated type bindings.

## 0.1.0

- Add `types generate`, read-only `--check`, foreground `--watch`, atomic output
  replacement, and optional first generation through `init --generate`.
- Add the pure content type generator with workspace maps, collection/revision
  types, property and fragment constraints, and optional entry/tree declarations.
- Expose current and published type metadata through generated API commands.
- Add generated public API commands with SDK transport, JSON/file input, binary
  output, snapshot-aware pagination, SSE output, and shared CLI progress visuals.
- Add guided and non-interactive project initialization with public API validation,
  configuration previews, and safe updates to existing files.
- Add the CLI foundation, project configuration, and package build.
- Add device login, online authentication status, logout, OS credential storage,
  explicit private-file storage, and coordinated OAuth refresh.
- Add formatted authentication panels and progress spinners, with plain output
  for non-interactive use and unchanged JSON results on stdout.
