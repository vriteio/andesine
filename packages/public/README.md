# Public Andesine packages

`@andesine/sdk` and `@andesine/converters` are independent, MIT-licensed packages.
Each package has its own version and changelog. Their MIT licenses apply to the
files in these packages; the repository's other code keeps its existing license.

The [public API and SDK implementation plan](./IMPLEMENTATION.md) records the next
contract changes and their separate review steps. Proposed interfaces in that plan
are not yet available in the released packages.

## Build and inspect

Use Node.js 24 and the pnpm version in the root `packageManager` field for
development. The published packages support Node.js 22+ and compatible browser
and worker runtimes.

```sh
pnpm install --frozen-lockfile
pnpm --filter @andesine/sdk build
pnpm --filter @andesine/converters build
```

The Rolldown CLI reads each package's `rolldown.config.ts`, cleans its `dist`
directory, bundles its JavaScript, and writes source maps with embedded sources.
The `rolldown-plugin-dts` plugin uses TypeScript to generate declarations and
bundles them in the same build. Dependencies remain external. The SDK has one
ESM entry point; converters have a base entry point and five format entry points
with shared chunks. No CommonJS bundle is published.

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
```

`prepack` runs type checks, the build, and `publint --strict`. Archives contain
bundles, source maps, declarations, package metadata, README, changelog, and MIT
license. The SDK also includes its OpenAPI document. Build scripts, development
configuration, and private workspace packages are excluded.

For API changes, regenerate and commit the spec and client together:

```sh
pnpm --filter @andesine/backend openapi:export
pnpm --filter @andesine/sdk generate
```

API definitions live in `apps/backend/src/contracts`. Both the server and the
standalone exporter use those contracts. Generation needs no backend environment
variables or service connections. See the backend contracts README for the
definition and handler workflow.

The **Check public packages** workflow checks formatting, lint, generated API
files, type checks, builds, and package metadata. It saves both npm archives as
workflow artifacts. It does not publish packages.

## Configure npm publishing once

The **Publish public package** workflow uses
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) with GitHub
Actions OIDC. No npm write token is stored in the repository. It runs on a
GitHub-hosted runner with Node.js 24 and its bundled npm CLI (npm 11.5.1 or newer
is required).

1. Ensure the release account can publish public packages in the `@andesine`
   scope. If a package does not exist yet, make its first publication from a
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

For the first local publication only, authenticate with `npm login`, then publish
the checked archive from the repository root. For example:

```sh
npm publish dist/packages/andesine-sdk-0.1.0.tgz --access public
npm publish dist/packages/andesine-converters-0.1.0.tgz --access public
```

These commands publish publicly. Packing or building alone does not publish.

## Release a version

1. Update the affected package's `version` and `CHANGELOG.md`. Use an unused npm
   version. Changes do not require releasing both packages together.
2. For SDK API changes, regenerate the spec and client. Commit all release changes
   and let **Check public packages** pass.
3. Run **Publish public package** on that commit's branch or tag. Select `sdk` or
   `converters`, enter the exact committed version, and select the npm tag.
   Use `latest` for normal releases and `next` for versions such as `0.2.0-beta.1`.
4. The workflow checks the version, checks and packs the package, saves the
   archive, and publishes that same archive with provenance. It does not modify
   versions, create commits, or create Git tags.

The two releases are separate. If one succeeds and the other fails, retry only
the failed package. npm does not allow replacing an already published version.
