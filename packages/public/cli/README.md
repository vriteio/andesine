# Andesine CLI

MIT-licensed command-line tools for Andesine. Requires Node.js 22.12 or later.

```sh
npm install --save-dev andesine @andesine/sdk
npx andesine init
```

Use `npm install --global andesine` for a system-wide executable. The CLI depends
on an exact SDK release. Keep `@andesine/sdk` as a direct project dependency when
application code imports the generated types or creates a client. Optional native
credential bindings are only loaded for OS-store authentication; API keys and
explicit file storage also work when those bindings are omitted.

This package is under development. Help, configuration, OAuth authentication,
project initialization, public API commands, and content type generation are implemented.

```sh
andesine --help
andesine --version
```

## Project configuration

Run `andesine init` for guided setup. It uses Clack prompts and progress indicators
to select a workspace, current or published content, collections, and a generated
types path. If credentials are missing, it offers browser login. API keys use their
own workspace; OAuth users select from their accessible workspaces.

```sh
andesine init
andesine init --config ./config/andesine.json
andesine init --no-interactive --workspace ws_example \
  --source published --channel published \
  --collection /Docs coll_example/Guides --output src/content.generated.ts
andesine init --no-interactive --source current --all-collections --yes
```

Non-interactive setup requires a saved login or `ANDESINE_API_KEY`. Supply
`--workspace` when the OAuth account has multiple workspaces and no configured
selection. Defaults are the `published` channel, all accessible collections, and
`src/andesine.generated.ts`; existing configuration values are retained unless
changed by flags. `--snapshot snp_…` selects a fixed snapshot instead of a channel.
Use `--include-entry-ids`, `--include-entry-paths`, and `--include-tree` to opt into
additional types, or their `--no-…` forms to remove existing selections.

The collection picker offers IDs for rename stability or paths for readability.
`--collection` accepts one or more IDs or decoded paths, including collection-ID
anchors. The API validates them against the selected source. `--all-collections`
clears an existing selection. Empty collection selections mean all accessible
collections, including collections added later.

Setup shows changes before saving. An existing configuration requires confirmation
or `--yes`; non-interactive updates require `--yes`. Unchanged configurations are
not rewritten. A file changed during setup is rejected. Only the selected JSON
configuration is written; tokens stay in user credential storage. After saving,
interactive setup offers first generation. Use `--generate` to request it directly
or `--no-generate` to skip it. Non-interactive setup generates only with `--generate`;
`--yes` alone does not enable generation. Initialization does not install packages.
If generation fails, the saved configuration and last successful types file remain.

Commands use the nearest `andesine.json`, searching from the working directory up
to the filesystem root. `--config <file>` or `ANDESINE_CONFIG` selects an explicit
file instead. Explicit files must exist except when `init` creates them. Help and version do not load any config.
Configuration is JSON only; the CLI does not load `.env` files or execute config.

```json
{
  "$schema": "./node_modules/andesine/dist/config.schema.json",
  "version": 1,
  "baseURL": "https://api.andesine.app",
  "workspaceID": "ws_example",
  "types": {
    "source": { "kind": "published", "channel": "published" },
    "collections": ["/Tutorials"],
    "output": "src/andesine.generated.ts",
    "includeEntryIDs": false,
    "includeEntryPaths": false,
    "includeTree": false
  }
}
```

The JSON Schema ships at `dist/config.schema.json` and is also exported as
`andesine/config.schema.json`. Unknown configuration fields are rejected.
Keep credentials out of this file.

Values use this precedence: flags, environment, project configuration, selected
user profile, then defaults. Supported global overrides:

| Flag          | Environment variable    | Project field |
| ------------- | ----------------------- | ------------- |
| `--config`    | `ANDESINE_CONFIG`       | —             |
| `--base-url`  | `ANDESINE_BASE_URL`     | `baseURL`     |
| `--workspace` | `ANDESINE_WORKSPACE_ID` | `workspaceID` |
| `--profile`   | `ANDESINE_PROFILE`      | `profile`     |

The default API root is `https://api.andesine.app`. Self-hosted roots can include
a deployment prefix. Credentials, query strings, and fragments in the URL are
rejected. Trailing slashes are removed.

The default type source is the `published` channel. Use
`{ "kind": "published", "snapshotID": "snp_example" }` for a fixed snapshot, or
`{ "kind": "current" }` for current schemas. Channel and snapshot are exclusive.
Collection selectors are IDs or paths, resolved by the API in the generation
step. An omitted or empty collection list selects all accessible collections.
Entry IDs, entry paths, and tree types are off by default.

Output defaults to `src/andesine.generated.ts`. Relative output paths resolve
against the configuration directory, or the working directory if no config
exists. No files are generated during package installation or import.

## User profiles

User metadata lives in `andesine/profiles.json` under `XDG_CONFIG_HOME`, or under
the platform default: `~/Library/Application Support` on macOS, `%APPDATA%` on
Windows, and `~/.config` on Linux. Override directories must be absolute paths.

```json
{
  "version": 1,
  "defaultProfile": "local",
  "profiles": {
    "local": {
      "baseURL": "http://localhost:3000",
      "workspaceID": "ws_example"
    }
  }
}
```

Profiles can also contain `accountID` and an opaque `credentialRef`. Tokens live
in the selected credential store, never in this metadata file. A profile's workspace and credential reference
are used only when its normalized API root matches the resolved instance,
including its deployment prefix. Missing selected profiles are errors except during `auth login`, which can create
the named profile. The first login uses `default` if no profile is selected and
sets the first saved profile as the default. A profile cannot be replaced by a
login to a different instance; supply a new `--profile` name instead.

## Authentication

```sh
andesine auth login
andesine --profile work auth login
andesine --base-url https://api.example.com auth login --no-browser
andesine auth login --credential-store file --no-browser --no-interactive
andesine auth status
andesine auth logout
```

Login displays the instance, browser URL, and user code on stderr. The browser
shows the account and asks you to approve or deny access. `--no-browser` keeps the same
flow but leaves opening the URL to you. The CLI polls until approval, denial,
expiry, or cancellation. Ctrl+C stops polling. No callback server is started.

In a terminal, authentication commands use formatted panels, status icons, and
progress spinners. Login shows the browser URL and code while it waits for approval.
Progress stops on success, failure, or cancellation. CI, redirected stderr,
`TERM=dumb`, and `--no-interactive` use plain text without animation. Colors respect
`NO_COLOR`. JSON results on stdout remain unchanged.

The default store is the OS credential store: macOS Keychain, Windows Credential
Manager, or Linux Secret Service. Linux requires a running Secret Service; the CLI
does not silently use the nonpersistent kernel keyring. Native bindings are optional
and loaded only when needed. No install script downloads credentials or generates
project files.

If the OS store is unavailable, interactive login offers **unencrypted file
storage** with an explicit confirmation. `--credential-store file` selects that
option directly, including in non-interactive sessions. Credentials are stored in
`andesine/credentials` beside `profiles.json`. POSIX directories use `0700` and
files use `0600`. Windows directories use a protected ACL for the current user,
with inheritance for new files; PowerShell is required to establish that ACL.
File writes use a temporary file and atomic replacement. Do not put the user
configuration directory inside a shared or committed project.

`auth status` verifies the credential online and emits JSON with its source,
instance, account (or API-key ID), selected profile, and workspace ID. A missing,
expired, or rejected credential fails with a nonzero exit code. OAuth refresh
occurs when the access token has less than one minute left. Concurrent processes
serialize refreshes. An interrupted or uncertain exchange requires a new login;
the CLI never retries a refresh token that might already have been rotated. API
requests are not replayed to recover authentication.

`ANDESINE_API_KEY` takes precedence over saved OAuth credentials for API requests
and `auth status`. An empty or rejected key does not fall back to OAuth. Login and
logout still manage the selected saved profile and do not change the environment.
No credential is used for a different API root, including a different deployment
prefix. HTTP redirects are not followed for authenticated requests.

Login and status emit metadata only on stdout. Tokens are never printed. API
commands use the same SDK authentication helper.

Logout revokes the latest known refresh token and removes local credentials.
Its JSON result reports `localRemoved` and `revocation` separately. If remote
revocation cannot be confirmed, local removal still occurs and the command exits
with an error. Browser sessions are not signed out. Older access tokens may remain
valid for up to 15 minutes. Provider refresh-token reuse can invalidate other CLI
logins for the same user/client; complete per-device revocation is deferred.

## Public API commands

`andesine api <resource> <operation>` exposes the public API through the SDK.
Names use kebab-case: `content.getTree` becomes `api content get-tree`.
Each operation has `--help` with its fields, description, authentication, and
example input. `--schema` prints its bundled input JSON Schema. Both work offline
without loading project configuration or credentials.

After OAuth login, run `andesine init` to save a workspace for this project, or
select one for a command with `--workspace <id>`. Login alone does not select a
workspace. Use `andesine api workspaces list` to find the available IDs; that
command does not require a workspace. Workspace operations report a configuration
error before sending the API request if no workspace is selected.

```sh
andesine api --help
andesine api content get-tree --help
andesine api entries create --schema
andesine api content get-tree --channel published
andesine api content get --path /Docs/Introduction --channel published --full
andesine api content list-entries --channel published --paginate
andesine api search published --input @search.json --semantic false
andesine api search ask-published-stream --input @question.json --format text
andesine api assets upload --asset-id ast_example --file ./image.png
andesine api type-metadata get-published --collections '["/Tutorials"]'
```

Pass simple values as flags, or supply an API input object through `--input @file`
or `--input -` for stdin. JSON uses API field names, such as `collectionID`; flags
use `--collection-id`. Flags replace matching JSON fields. Boolean flags require
`true` or `false`; arrays and objects require JSON. Nullable fields accept `null`.
Use `--help` for required inputs. File fields accept a path or `-` for stdin;
stdin can supply either the JSON object or one file per command.

Normal responses are one JSON value per line. `--full` includes HTTP status,
headers, and data, for example to retrieve an ETag. Endpoints with conditional
reads accept `--if-none-match`; unchanged content emits a `notModified` result.
Empty responses emit no stdout unless `--full` is selected. Binary responses
require `--output <new-file>` or `--output -` for raw bytes; existing files are
never replaced.

`--paginate` emits one complete page per line, including pagination and snapshot
metadata. Published content retains the first page's snapshot. To resume published
pagination, provide both `--cursor` and `--snapshot-id` from the same result.
`--full` and conditional reads cannot be combined with `--paginate`.

AI streams emit NDJSON events by default. `--format text` emits answer text as it
arrives. A failed or incomplete stream keeps the output already emitted, reports
the error on stderr, and exits with a failure code.

Requests use a 30-second timeout; `--timeout <ms>` changes it and `--timeout 0`
disables it. Ctrl+C cancels the request. Retries are disabled, including for writes
and AI calls. Writes execute directly. Use the operation's documented expected
revision or snapshot fields when it supports change checks.

Commands use the configured API root and credentials. OAuth workspace selection
uses `--workspace`; API keys remain bound to their workspace. OAuth-only operations
require a saved login with `ANDESINE_API_KEY` unset. Anonymous asset reads do not
send credentials. Public API errors retain their code, details, hints, and request
ID on stderr when available.

In a terminal, commands use the shared Clack headings, request spinners, and status
messages on stderr. Redirected output and non-interactive use keep plain diagnostics
and machine-readable stdout. Command definitions are bundled with the package;
the CLI does not download executable definitions from the server.

`api type-metadata get-current` and `get-published` return collection/schema
metadata for type generation. Use `--include-entries true` or `--include-tree true`
for optional entry and ordered tree data. Published metadata retains its snapshot
and recorded schema revisions; collections with no recorded schema use a general
type without warnings. These API commands return metadata only; use
`andesine types generate` to write TypeScript files.

## Content type generator

```sh
andesine types generate
andesine types generate --check
andesine types generate --watch
andesine types generate --source current --collection /Tutorials
andesine types generate --snapshot snp_example --include-entry-paths
andesine init --generate
```

Generation reads public metadata for the configured source and writes the configured
TypeScript file. Flags override saved settings without changing `andesine.json`.
Use the same source, collection, output, and optional-type flags as `init`.
OAuth requires a selected workspace; an API key uses its workspace binding.
Output paths are relative to the configuration directory, or the working directory
without configuration. Supported extensions are `.ts`, `.mts`, and `.cts`, including
declaration files such as `.d.ts`.

Writes are atomic. Identical output is not rewritten. An unrelated file requires
explicit `--force`; links and non-regular files are rejected. A file changed during
generation is preserved. Metadata, access, and generation failures leave the last
successful output intact.

Commit the generated file and run `andesine types generate --check` in CI, with
`ANDESINE_API_KEY` available as a secret. Check mode makes no types-file writes and
returns exit code `3` for missing or stale output. Request and generation failures
return `1`; invalid options/configuration return `2`. A channel or current source is
checked against live metadata. Pin `--snapshot` for a fixed source while that
snapshot is retained. Authentication failures are never reported as stale output.

Watch runs in the foreground, polling every 10 seconds. `--interval <seconds>`
accepts 1–300 seconds. It holds the resolved configuration fixed; restart after
config changes. Polls do not overlap. Metadata fingerprints avoid repeated type
generation, and identical files stay untouched. Local deletion or changes to a
marked generated file are corrected on the next successful poll. `--force` only
authorizes unrelated-file replacement until the first successful generation.

Transient metadata read failures, rate limits, and schema migrations retry with
backoff, respecting `Retry-After`. Other failures stop the command. Watch refreshes
OAuth credentials between polls and preserves the last output during failures.
Press Ctrl+C to stop (exit `130`). There is no daemon or install-time generation.
`--check` cannot be combined with `--watch` or `--force`.

Commands print JSON results on stdout and use Clack progress/status on stderr.
Watch prints its initial result, changed output, and recovery; unchanged polls stay
quiet. The pure generator remains separate in `src/types/generate.ts`, with no
network, credential, or filesystem access.

Generated files export `Workspace` for `createClient<Workspace>()`, plus types
such as `TutorialsCollection`, `TutorialsCollectionContent`, and
`TutorialsCollectionStructuredContent`. Each recorded revision has a named schema
and content type. Names use stable suffixes when collection names conflict after
conversion to TypeScript identifiers. Field keys keep the API's derived spelling.

All declared schema fields are required. Numbers use `number | null`, selects
include `""`, and multi-selects use arrays of allowed values. Fragment types narrow
allowed block kinds. Custom element names and properties remain general because
schemas do not define them. Defaults are not treated as value constraints.
Empty and schema-free collections use general content types without warnings.

Entry ID bindings, entry path bindings, and ordered tree types are separate
opt-ins. Tree exports include their entry identities. Published trees narrow
`content.getTree()`; current trees describe the metadata's child-ID lists only.
The SDK generic changes types only: callers must configure the matching workspace
and source. Channel generation omits changing snapshot IDs and expiry; explicit
snapshot generation records the configured snapshot. Output contains no executable
values, content bodies, or timestamps.

## Command conventions

- Command data uses stdout. JSON responses use one JSON value per line; streamed
  events use NDJSON. Text output preserves the supplied text.
- Diagnostics and Clack prompts use stderr. Prompts require a terminal for stdin
  and stderr, are disabled in CI, and can be disabled with `--no-interactive`.
- Exit codes: `0` success, `1` runtime failure, `2` usage/configuration error,
  `3` stale generated types, `130` cancellation.
- API retries are disabled.

## Development

```sh
pnpm --filter ./packages/public/cli typecheck
pnpm --filter ./packages/public/cli generate:api
pnpm --filter ./packages/public/cli build
node packages/public/cli/dist/cli.js --help
```

`src/program.ts` owns command registration. Actions create a shared context
through `src/context.ts`; help does not create that context. Custom commands own
their logic. The `api` group uses metadata generated at build time from the
SDK OpenAPI artifact. It executes through the SDK, with no backend modules
or remotely downloaded executable command definitions at runtime.

The Rolldown build emits the executable and creates the JSON Schema from the same
Zod definition used to validate configuration. It also regenerates API metadata
and typed SDK bindings. Commit those generated sources with spec changes.
`prepack` builds the package, checks types, and runs Publint. The public-package
workflows check and publish the CLI archive after its exact SDK release is available.
See the [release guide](https://github.com/vriteio/andesine/blob/andesine/packages/public/README.md) and [release review](https://github.com/vriteio/andesine/blob/andesine/packages/public/CLI-RELEASE-REVIEW.md)
for rollout order and checks that still need browser or platform access.
