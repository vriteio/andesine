# Public Andesine packages

`@andesine/sdk`, `@andesine/converters`, and the `andesine` CLI are MIT-licensed packages.
Each package has its own version and changelog. Their MIT licenses apply to the
files in these packages; the repository's other code keeps its existing license.

The [CLI implementation plan](./CLI-IMPLEMENTATION.md) records the reviewed steps.
The packages have independent versions. The CLI depends on an exact SDK version;
publish that SDK version before releasing the CLI. Converters are independent.

## Build and inspect

Use Node.js 24 and the pnpm version in the root `packageManager` field for
development. The SDK and converters support Node.js 22+ and compatible browser
and worker runtimes. The CLI requires Node.js 22.12+ and runs only in Node.js.

```sh
pnpm install --frozen-lockfile
pnpm --filter @andesine/sdk build
pnpm --filter @andesine/converters build
pnpm --filter ./packages/public/cli build
```

The Rolldown CLI reads each package's `rolldown.config.ts`, cleans its `dist`
directory, bundles its JavaScript, and writes source maps with embedded sources.
The libraries use `rolldown-plugin-dts` to generate and bundle declarations.
Dependencies remain external. The SDK has base and streaming entries; converters
have base, format, and anchor entries. The CLI emits an executable with a shebang,
its bundled API metadata, and a configuration JSON Schema. It has no programmatic
runtime export. No CommonJS bundle is published.

Source imports use extensionless paths with TypeScript's `Bundler` module
resolution. Rolldown adds the required extensions to references in the published
JavaScript and declarations so consumers can use Node ESM and `NodeNext`.

Use tool configuration files and CLIs for standard tasks. Reserve TypeScript
scripts run with `tsx` for custom tasks such as OpenAPI export and SDK generation.

To build and inspect the exact npm archives without publishing:

```sh
mkdir -p dist/packages
pnpm --filter @andesine/sdk pack --pack-destination dist/packages
pnpm --filter @andesine/converters pack --pack-destination dist/packages
pnpm --filter ./packages/public/cli pack --pack-destination dist/packages
```

`prepack` runs type checks, the build, and `publint --strict`. Archives contain
bundles, source maps, declarations, package metadata, README, changelog, and MIT
license. The SDK also includes its OpenAPI document. Build scripts, development
configuration, and private workspace packages are excluded. The CLI archive has
no TypeScript loader or monorepo runtime dependency. pnpm rewrites its SDK
`workspace:*` dependency to the SDK's exact version at pack time.

For API changes, regenerate and commit the spec and client together:

```sh
pnpm --filter @andesine/backend openapi:export
pnpm --filter @andesine/sdk generate
pnpm --filter ./packages/public/cli generate:api
```

API definitions live in `apps/backend/src/contracts`. Both the server and the
standalone exporter use those contracts. Generation needs no backend environment
variables or service connections. See the backend contracts README for the
definition and handler workflow.

The **Check public packages** workflow checks formatting, lint, generated API
files, type checks, builds, and package metadata. It builds the SDK before the CLI
and verifies the CLI's generated bindings. It saves all three npm archives as
workflow artifacts. It does not publish packages.

## Configure npm publishing once

The **Publish public package** workflow uses
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) with GitHub
Actions OIDC. No npm write token is stored in the repository. It runs on a
GitHub-hosted runner with Node.js 24 and its bundled npm CLI (npm 11.5.1 or newer
is required).

1. Ensure the release account can publish in the `@andesine` scope and to the
   unscoped `andesine` package. If a package does not exist yet, make its first publication from a
   checked local archive with that account, then configure its trusted publisher.
2. Create the `npm` environment in `vriteio/andesine` on GitHub. Restrict its allowed
   release branches as needed.
3. For **each** package, add a GitHub Actions trusted publisher in its npm settings:
   - Organization: `vriteio`
   - Repository: `andesine`
   - Workflow filename: `publish-public-package.yml`
   - Environment: `npm`
   - Allow direct publication with `npm publish`.
4. Ensure this workflow is on the repository's default branch so that GitHub
   exposes the manual workflow action. The repository must be public for npm
   provenance generation.

For a local publication, authenticate with `npm login`, then publish
the checked archive from the repository root. For example:

```sh
npm publish dist/packages/andesine-sdk-0.2.0.tgz --access public
npm publish dist/packages/andesine-0.1.0.tgz --access public
```

These commands publish publicly and are examples for an unpublished version only.
Packing or building alone does not publish.

Registry checks on 2026-09-21 found `andesine@0.0.1-alpha.0` and
`@andesine/sdk@0.1.0`, both listing `areknawo` as maintainer. The planned versions
`andesine@0.1.0` and `@andesine/sdk@0.2.0` were unused. This does not verify the
current account's publish credentials or the GitHub trusted-publisher settings.
The local authenticated npm identity check returned 401; verify release
authorization and trusted-publisher settings before publication.

## Release a version

1. Update the affected package's `version` and `CHANGELOG.md`. Use an unused npm
   version. Update the SDK first when the CLI requires new SDK features. Its
   workspace dependency is pinned to that version in the CLI archive.
2. For SDK API changes, regenerate the spec and client. Commit all release changes
   and let **Check public packages** pass.
3. Run **Publish public package** on that commit's branch or tag. Select `sdk`,
   `converters`, or `cli`, enter the exact committed version, and select the npm tag.
   Use `latest` for normal releases and `next` for versions such as `0.2.0-beta.1`.
4. The workflow checks the version, checks and packs the package, saves the
   archive, and publishes that same archive with provenance. It does not modify
   versions, create commits, or create Git tags. CLI publication first checks that
   its exact SDK version exists on npm. CLI archives use `andesine-VERSION.tgz`;
   library archives use `andesine-sdk-VERSION.tgz` and `andesine-converters-VERSION.tgz`.

The releases are separate. If one succeeds and another fails, retry only
the failed package. npm does not allow replacing an already published version.

## CLI rollout order

1. Apply backend migration `0029_cli-oauth-provider.sql`, then deploy the backend
   with OAuth provisioning, current-permission checks, and type metadata routes.
2. Deploy the web device-approval page and verify device approval/denial, refresh,
   and the configured instance URLs. Keep self-hosted API and web URLs consistent.
3. Publish `@andesine/sdk@0.2.0` with OAuth and workspace type-map support.
4. Publish `andesine@0.1.0`, then verify installation against the published SDK.

Deployment and publication are separate actions; they were not performed during
implementation. See the [CLI release review](./CLI-RELEASE-REVIEW.md) for package
verification and remaining platform/browser checks.
