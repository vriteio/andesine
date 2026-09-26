# Changelog

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
