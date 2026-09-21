# Andesine Pages and Andesine UI implementation plan

Status: proposed implementation plan. No implementation step has started.

Prepared on 2026-09-21 from the agreed product decisions and the current repository.

## Progress checklist

Check a step when its work and validation are complete. Record any unavailable
checks in the review notes. Check its review item only after the user accepts the
result. Wait for an explicit instruction to continue before starting the next step.

- [ ] Step 1 — Freeze contracts, schema, and deployment choices.
  - [ ] User review accepted.
- [ ] Step 2 — Add the public package and template foundations.
  - [ ] User review accepted.
- [ ] Step 3 — Prove content composition across Astro and Solid.
  - [ ] User review accepted.
- [ ] Step 4 — Implement the files source and static routing.
  - [ ] User review accepted.
- [ ] Step 5 — Implement Andesine SSG and durable assets.
  - [ ] User review accepted.
- [ ] Step 6 — Implement Andesine SSR and mixed-source routes.
  - [ ] User review accepted.
- [ ] Step 7 — Implement headless navigation components.
  - [ ] User review accepted.
- [ ] Step 8 — Build the default Pages design and site layout.
  - [ ] User review accepted.
- [ ] Step 9 — Complete structural documentation components.
  - [ ] User review accepted.
- [ ] Step 10 — Complete tabs, code blocks, and language selection.
  - [ ] User review accepted.
- [ ] Step 11 — Implement the search palette and Pagefind source.
  - [ ] User review accepted.
- [ ] Step 12 — Connect published Andesine search through runtime endpoints.
  - [ ] User review accepted.
- [ ] Step 13 — Add Andesine AI answer mode.
  - [ ] User review accepted.
- [ ] Step 14 — Implement the OpenAPI content source.
  - [ ] User review accepted.
- [ ] Step 15 — Build reference UI and language examples.
  - [ ] User review accepted.
- [ ] Step 16 — Connect embedded operations and generated reference sections.
  - [ ] User review accepted.
- [ ] Step 17 — Finish site output and user documentation.
  - [ ] User review accepted.
- [ ] Step 18 — Migrate Andesine's own documentation.
  - [ ] User review accepted.
- [ ] Step 19 — Verify independent distribution and prepare release artifacts.
  - [ ] User review accepted.

## Review process

Implement one numbered step at a time, in the order below. Each step is a separate
review unit. Do not start the next step until the user has reviewed the current
result and explicitly asks to continue. Approval of this plan does not approve
automatic execution of all steps.

At each pause, provide:

- The completed scope and the files or artifacts to review.
- The checks run, their results, and any checks that could not run.
- Any departure from this plan or unresolved issue.
- The next step, without starting it.

Keep each step complete and usable within its stated scope. If a step needs an
upstream SDK, converter, or backend change, present that change as a separate
review unit before continuing the dependent work. Do not replace public APIs with
private imports to get past a missing capability. Existing pre-release behavior
may change; do not add compatibility layers for the old implementation.

Follow the current repository instructions: no new automated tests unless the
user requests them, no dev server, and no browser execution. Use type checks,
lint, formatting, builds, package inspection, and inspection of generated files.
Record interactive and visual checks for user review; do not claim that a build
proves keyboard behavior, hydration, focus handling, or visual quality.

## Agreed product scope

| Area                   | Decision                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Pages distribution     | A complete Astro template that users copy and own. No required Pages integration package or managed update system.                     |
| UI distribution        | An independent headless Solid.js package. Every documentation component has a base here, including static structural components.       |
| License                | MIT for the template and UI library.                                                                                                   |
| Private code           | Use the private components, web app, and landing app as design references only. No direct or transitive private dependencies.          |
| Source ownership       | Sources own the full documentation data layer, including content, metadata, structure, ordering, navigation, URLs, assets, and search. |
| Astro collections      | Use Astro collections for both local and Andesine content.                                                                             |
| Default source         | Andesine, configured with an environment API key and main collection ID.                                                               |
| Andesine rendering     | SSG and SSR. Resolve the latest publication at build time or request time.                                                             |
| Files rendering        | SSG only, including when files are part of a site with SSR Andesine routes.                                                            |
| Publication policy     | No framework cache and no user-configurable fixed snapshot.                                                                            |
| Schema                 | Document standard properties, fragments, supported values, and extension points. Setup inside Andesine is manual for now.              |
| Schema setup extension | Deferred to a separate extension.                                                                                                      |
| Andesine search        | Search results plus an “Ask question…” result action that opens AI answer mode, as in the app.                                         |
| Files search           | Pagefind. No AI answers.                                                                                                               |
| API reference          | Headless reference components, OpenAPI support, embedded operations, and generated reference sections.                                 |
| Language examples      | Generated examples plus author examples. Author examples take precedence per operation and language.                                   |
| Primitive behavior     | Compose Ark UI where suitable; add documentation-specific behavior in Andesine UI.                                                     |
| Design                 | Light mode only, neutral colors, borders, subtle shadows, and a configurable orange gradient.                                          |
| Versions and locales   | One documentation version and one language per site. No selectors in this release.                                                     |
| First-party adoption   | Andesine's own docs use the same template conventions and public UI interfaces.                                                        |

Interactive API requests, TypeScript symbol extraction, authentication for private
documentation, automatic template upgrades, additional UI frameworks, and AI over
local files are outside this release.

## Current code and reusable public APIs

- `packages/public/sdk` and `packages/public/converters` are present. npm metadata
  reports version `0.1.0` for both packages. Verify the required APIs in the actual
  published archives before depending on them; workspace declarations alone do
  not establish package availability.
- SDK candidates to reuse: `createClient`, `content.getTree`, `content.listEntries`,
  `atSnapshot`, `toStructuredContent`, `toContentURL`, published search, published
  answer streaming, and the optional streaming helpers.
- Converter candidates to reuse: format-specific conversion, AST output, custom
  handlers, `getHeadingAnchors`, and `publishedContentOptions`/image URL resolution.
- The SDK already owns HTTP types, pagination, errors, and stream decoding. The
  converters already own content conversion and heading anchor rules. Do not
  create competing implementations in Pages.
- `apps/docs` currently uses Nimbus, serves under `/docs/`, and deploys through
  the existing Cloudflare edge arrangement. Its Markdown alternatives, `llms.txt`,
  metadata, content, and deployment files need an explicit migration review.
- `apps/docs/AGENT.md` contains Nimbus-specific instructions. Keep them while the
  Nimbus app remains in place; update them with the migration.
- Reference `feat/v0.5:packages/pages`, `feat/v0.5:packages/ui/solid`, and
  `feat/v0.5:apps/docs`. Reuse ideas, not obsolete Vrite dependencies or APIs.

## Proposed code organization

Paths and names below are implementation proposals to confirm in Step 1.

```text
packages/public/ui/                 # published @andesine/ui
  src/components/                  # all headless documentation bases
  src/lib/                         # shared component behavior
  README.md, CHANGELOG.md, LICENSE

packages/public/pages/              # copyable template; private npm manifest
  andesine.config.ts               # identity, brand, presentation, source setup
  astro.config.ts                  # Astro integrations and deployment adapter
  src/content.config.ts            # build-time collections
  src/live.config.ts               # live Andesine collection when SSR is enabled
  src/sources/                     # data contracts and source implementations
    andesine/
    files/
    openapi/
  src/components/                  # styled compositions of @andesine/ui
  src/renderers/                   # content and custom-element rendering
  src/layouts/
  src/pages/                       # routes and optional runtime endpoints
  src/styles/                      # local UnoCSS configuration and styles
  src/content/                     # local examples
  docs/                            # setup, schema, customization, deployment
  public/
  .env.example, README.md, LICENSE

apps/docs/                         # first-party consumer; migrate late
```

Keep source adapters in the copied template initially. Do not introduce a third
public runtime package just to share internals. Andesine UI has no SDK, converter,
Astro, router, CSS framework, or private package requirement. Consumer adapters
manage data access; UI receives plain data and callbacks.

The template must include all build settings and asset references needed outside
the monorepo. Use public version ranges in its distributable manifest. Local UI
development may use a workspace resolution or a packed archive, but copied
projects must not require `workspace:*` dependencies or parent configuration.

## Technical rules to resolve early

### Rendering and freshness

Astro build-time collections do not become live merely because a route uses SSR.
Use build-time loaders for SSG and a live collection loader for SSR Andesine data.
Share mapping and rendering logic between the two.

Resolve the latest publication once per build or request, then use its snapshot
ID only to keep the related reads consistent. This is an operation-scoped read,
not a fixed-snapshot product feature. Do not place selected snapshots in site
configuration, historical routes, or persistent cache state. A failed or expired
snapshot must not cause data from separate snapshots to be combined.

SSG routes remain static when combined with SSR routes. Plan disjoint route
prefixes for mixed sources, explicit source mounts, and collision checks. Do not
serve file pages dynamically through a generic SSR catch-all as a shortcut.

### Assets and links

Published snapshot image URLs can expire. Proposed default: copy the assets used
by SSG pages into the build output and rewrite references to durable local URLs.
Use converter image callbacks for this mapping. SSR can resolve the current asset
URLs as part of its current-content read. No background asset cache is required.

Andesine heading anchors must use the converters' rules. Preserve anchors before
splitting or omitting fragments. ToC, content headings, search results, and answer
citations must agree. Markdown/MDX string serialization alone does not retain the
converter AST heading IDs.

Use the SDK URL helper for canonical path mappings where applicable. If the source
supports custom documentation slugs, map IDs and canonical paths through the same
route resolver for content links, search, and citations. Do not apply a second,
unrelated slug function to search paths.

### Content rendering

Collections store serializable content and normalized metadata. A local component
registry belongs to the template renderer, not to serialized collection records.
Start with converter AST output and explicit component mappings. Prove the path
for nested custom elements in Step 3 before selecting the final representation.

Do not evaluate fetched Andesine content as executable MDX on each request. Local
MDX can use Astro's compilation pipeline. HTML strings containing custom element
markers do not automatically create interactive Solid components; use explicit
renderers and component boundaries.

Every styled documentation component must use its UI base for structure as well
as behavior. Keep components that share Solid context inside one Solid island.
Preserve useful initial HTML. Do not hydrate the entire article just to support
one interactive block.

### Search and AI deployment

Current published search and answer endpoints require authorization. A secret
Andesine key cannot be sent to a static site's browser.

Proposed default deployment: an Astro server adapter with documentation routes
prerendered for SSG and small runtime search/answer endpoints. SSR uses those same
endpoints. Files-only deployments remain fully static. A site hosted only as static
assets needs an external deployment of the same endpoint handlers to retain
Andesine search and AI. Document this requirement; do not claim that one secret
key makes a pure static host run server code.

The endpoint fixes the configured source, main collection, and published channel.
Browser input cannot select an arbitrary collection, upstream URL, credential,
or draft endpoint. Enforce source exclusions before search/answer retrieval where
the public API permits them. Post-filtering citations cannot remove excluded
content that the model already used. If source visibility cannot be represented
by the API's scope and filters, use a supported schema constraint or a separately
reviewed public API change.

Honor backend request limits and cancellation. Bound request/history size and
document the shared credential quota and deployment controls. Reuse the SDK stream
helpers instead of maintaining a second SSE protocol.

Andesine search remains latest-only even for an SSG site. A publication can
therefore precede its next deployment. Map results to known static routes, omit
unavailable links, and document that excerpts/answers can be newer than deployed
content. Do not promise historical search or exact SSG snapshot parity.

### OpenAPI defaults proposed for Step 1

- Generate OpenAPI source pages at build time initially, including on a site with
  SSR Andesine pages. Runtime spec refresh was not an agreed requirement.
- Support OpenAPI 3.0 and 3.1 within an explicit feature matrix. Reject unsupported
  spec versions and report unsupported constructs. Do not silently reinterpret
  JSON Schema semantics.
- Accept configured local JSON/YAML and configured remote specs. Resolve local
  references and declared external references with a mature parser. Never fetch
  an arbitrary reference supplied by a browser request.
- Start generated request examples with cURL, JavaScript Fetch, and Python
  requests. Allow extra author-defined languages, including SDK-specific examples.
- Select examples in this order: site author override, documented spec-provided
  code example, generated example. Match by spec, operation, and language. Define
  media-type/example selection too, so one override does not replace other cases.

These are bounded implementation proposals, not additional confirmed product
decisions. Review them with the first step.

## Implementation steps

### Step 1 — Freeze contracts, schema, and deployment choices

Work:

- Confirm the proposed paths, UI package name, runtime baseline, and compatible
  Astro/Solid/Ark UI versions. Inspect the published SDK/converter artifacts.
- Write the source contract: identity, capabilities, page data, ordered navigation,
  route resolution, headings, assets, search, and optional answer events.
- Define source composition and route ownership, including main/root index pages,
  missing pages, duplicate routes, collection landing pages, and base paths.
- Inspect what ordering the published tree actually exposes. Do not infer
  interleaved collection/entry ordering from an ID-sorted listing. State a clear
  supported ordering or isolate an API change if required.
- Specify configuration boundaries: branding and shell links in general settings;
  content selection, mapping, mounts, and navigation data inside source settings.
- Draft the standard schema, setup instructions, and extension examples.
- Resolve the proposed runtime search transport, SSG asset policy, SSR loader,
  OpenAPI rendering policy, spec support, and generated language set.

Proposed standard schema to refine here:

| Field              | Kind                    | Proposed meaning                                                       |
| ------------------ | ----------------------- | ---------------------------------------------------------------------- |
| Native title/name  | Built-in                | Default page title; do not require a duplicate title property.         |
| `description`      | Text property           | Page summary and metadata.                                             |
| `slug`             | Text property, optional | Explicit route override; source path provides the default.             |
| `navigationLabel`  | Text property, optional | Sidebar label; defaults to page title.                                 |
| `navigationHidden` | Checkbox property       | Remove from navigation only.                                           |
| `searchHidden`     | Checkbox property       | Exclude from search and AI retrieval under the agreed filtering rules. |
| `toc`              | Checkbox property       | Show or hide the page ToC.                                             |
| `layout`           | Select property         | Documentation, wide content, or API layout.                            |
| `body`             | Fragment                | Main page content.                                                     |
| `summary`          | Optional fragment       | Introductory content, separate from the plain-text description.        |
| `aside`            | Optional fragment       | Supporting content with defined mobile placement.                      |

Specify actual schema labels and derived keys, allowed property types, empty-value
behavior, fragment order, heading inclusion, and search inclusion. Preserve
extensions in a dedicated metadata area. Validate required fields without
discarding valid custom fields. Publication state controls publication; avoid a
competing draft property for Andesine.

Validation: contract examples cover Andesine SSG, Andesine SSR, files-only, and a
mixed site. Every required operation maps to a public API or a named prerequisite.

Review result: architecture record, schema tables, example configuration, source
interfaces, and the specific proposals above. **Pause for review.**

### Step 2 — Add the public package and template foundations

Work: create the MIT UI package and copyable template directories; add exports,
build/type scripts, documentation stubs, and an environment example. Set up Astro,
Solid, MDX, and local style tooling. Use the public SDK and converters as normal
dependencies. Reuse release conventions from the public packages where suitable.
Choose Solid-aware output and export conditions that support both server rendering
and client hydration; do not bundle a second Solid runtime.

Validation: package type/build checks; inspect a packed UI archive; build a minimal
copied template outside the workspace without private imports or parent configs.

Review result: directory structure, manifests, license scope, package exports, and
standalone build evidence. The existing docs app is untouched. **Pause for review.**

### Step 3 — Prove content composition across Astro and Solid

Work: implement one structural base, a minimal tabs base, and their styled/authoring
wrappers. Render a local MDX example and a representative Andesine document through
the public converters. Include nested markup, code, repeated headings, a custom
element, and a named fragment. Prove the same rendering approach for build-time
and request-time input. Establish the renderer registry and selective hydration.

Validation: type/build both examples; inspect initial HTML, heading IDs, generated
client entry points, and imports. Include a plain Solid usage example. Record
hydration and keyboard behavior as user checks, not verified build results.

Review result: component API examples, renderer design, output HTML, and the
remaining runtime review checklist. This step must pass before expanding the
component set. **Pause for review.**

### Step 4 — Implement the files source and static routing

Work: use Astro collections for Markdown/MDX; validate metadata; derive structure
from folders and source metadata; produce pages, navigation, headings, breadcrumbs,
and previous/next data. Add source-owned labels, ordering, links, and exclusions.
Support custom route mounts, root/index pages, assets, and registered components.
Do not require Andesine credentials in files-only mode.

Validation: build examples at `/` and `/docs/`; inspect links, route collisions,
hidden pages, nested groups, and generated static HTML. Invalid metadata and
ambiguous routes must give useful diagnostics.

Review result: files source API, example authoring files, and generated route list.
**Pause for review.**

### Step 5 — Implement Andesine SSG and durable assets

Work: add the SDK-backed build loader. Resolve the main collection and latest
publication; keep tree, paginated content, and related reads on the same temporary
snapshot. Use structured-content helpers for mappings and converters for rendering,
text, and anchors. Keep API key and SDK transport details out of browser bundles.
Copy required snapshot assets to build output and map links through the source.
Report missing publication, schema mismatch, missing asset, and snapshot expiry.

Validation: build a representative published dataset when credentials are available;
otherwise use clearly labeled example responses for build inspection and leave
live delivery verification pending. Inspect pagination paths, full-document anchor
rules, emitted assets, and absence of keys or expiring asset URLs in static output.

Review result: default two-value setup, mapping behavior, asset output, and build
diagnostics. Do not create or publish live Andesine content as part of this step.
**Pause for review.**

### Step 6 — Implement Andesine SSR and mixed-source routes

Work: add the live collection loader, request-local publication context, and SSR
routes. Fetch latest per request; share transforms with SSG without storing a
cross-request content cache. Render missing content as 404 and upstream failure
as an appropriate unavailable response. Do not replace outages with stale data.
Keep local-file routes prerendered in mixed deployments. Define disjoint route
mounts and fail unsupported route overlaps clearly.

Validation: type-check and build static, SSR, and mixed configurations. Inspect the
route manifests and server/client dependency split. Review the request context to
ensure that global mutable state cannot mix snapshots across concurrent requests.
Record live request checks separately if they cannot be run under current rules.

Review result: loader API, route manifests, error behavior, and deployment adapter
requirements. **Pause for review.**

### Step 7 — Implement headless navigation components

Work: complete tree navigation, mobile navigation control, ToC, breadcrumbs, and
previous/next bases. Separate link activation from group expansion. Use semantic
navigation/disclosure behavior for the docs sidebar; do not apply application tree
roles without implementing their full keyboard model. Handle active ancestors,
current links, focus restoration, hash navigation, and reduced motion.

Validation: types/builds and rendered markup inspection for deep groups, group
landing links, long labels, empty groups, and headings. Document manual focus,
keyboard, scroll, and mobile checks for the user.

Review result: standalone Solid examples and component contracts. **Pause for review.**

### Step 8 — Build the default Pages design and site layout

Work: implement a local light theme, semantic CSS variables, configurable gradient
stops, neutral colors, borders, shadows, fonts, and spacing. Compose UI bases into
the header, sidebar, mobile menu, article, ToC, and footer. Add regular and wide/API
layouts. Include logo/name behavior, favicon, external links, and visible focus.
Keep UnoCSS/style configuration self-contained. Include font licenses and optional
font replacement. Do not copy private styles or asset paths as dependencies.

Validation: build with default orange and an alternate brand configuration; inspect
CSS, font/assets, responsive rules, semantic landmarks, and hydration entry points.
Provide a component showcase for user visual review without running a browser.

Review result: theme tokens, layout source, configuration examples, and generated
showcase artifact. **Pause for review.**

### Step 9 — Complete structural documentation components

Work: add callout, card, card-grid, steps, file-tree, and disclosure bases in UI,
then their Pages styles and authoring wrappers. Finish ordinary content styling
for tables, images, captions, lists, and inline code. Add matching Andesine element
mappings and local MDX examples. Register static components through real UI bases,
not duplicate Astro markup with the same names.

Validation: type/build a nested content showcase for both source formats. Inspect
markup and ensure that static components do not add hydration by default. Confirm
that unsupported element names and invalid props give useful diagnostics.

Review result: component inventory, schema element reference, extension example,
and generated content. **Pause for review.**

### Step 10 — Complete tabs, code blocks, and language selection

Work: finish tabs, code blocks, code groups, copy controls, and shared language
selection. Keep highlighting in the build/server renderer and interactive state
in UI. Support filenames, accessible labels, and selected-language persistence.
Define selection fallback when a group lacks the chosen language. Preserve content
and usable fallback markup before JavaScript runs. Keep synchronized preferences
scoped so unrelated tabs do not change together.

Validation: builds for local and Andesine authoring; inspect highlighted output,
unique IDs, stable server defaults, and client bundle imports. Provide manual
checks for copying, keyboard tabs, and cross-island preference updates.

Review result: authoring examples, state API, language behavior, and code rendering.
**Pause for review.**

### Step 11 — Implement the search palette and Pagefind source

Work: build headless search trigger, dialog, input, result list, status, and result
action components. Style them in Pages. Add Pagefind indexing owned by the files
source, including final URLs, headings, exclusions, metadata, and base paths.
Limit indexing to the intended source content. Use the same provider contract for
search results and cancellation. Add development index generation/rebuild support
without requiring a full production build after each content edit.

Validation: inspect generated indexes and sample query output where callable
without a browser. Check files-only builds without credentials. Review development
integration code without starting a dev server. Ensure no AI action is advertised
by the files provider.

Review result: search provider interface, index records, palette examples, and
development behavior. **Pause for review.**

### Step 12 — Connect published Andesine search through runtime endpoints

Work: implement the server-held-key transport agreed in Step 1. Scope every request
to the configured published collection. Reuse SDK search and URL helpers; apply
source routing/exclusion rules. Add cancellation, stale-response suppression,
error mapping, and source capability reporting. Combine mixed-source results with
source labels and deterministic grouping; do not compare unrelated raw relevance
scores as if they used the same scale.

Provide the default same-site adapter setup and the static-host/external-endpoint
recipe. Do not add a new public unauthenticated backend API without a separate
review step. Index locally generated OpenAPI pages through the local search
provider when that source is enabled later.

Validation: build SSG-with-endpoints and SSR modes; inspect server-only credentials,
fixed source scope, request bounds, out-of-scope rejection, and static route maps.
Review latest-search versus static-page drift behavior explicitly.

Review result: endpoint contract, deployment examples, mixed results, and failure
states. **Pause for review.**

### Step 13 — Add Andesine AI answer mode

Work: add the “Ask question…” result action and switch to the answer view using the
current query. Reproduce the app's interaction without importing private code.
Connect SDK published answer streaming and streaming response helpers through the
same scoped transport. Include citations, cancellation, incomplete/error states,
and follow-up questions within backend history limits. Do not auto-retry answer
POSTs or reconnect streams. Render answer content through a defined safe Markdown
path. Do not execute model output as MDX.

Keep files and generated OpenAPI content outside the Andesine answer context unless
that content is actually published in the configured Andesine collection. Surface
service/permission/quota failures accurately; do not silently remove the agreed
AI feature from the default Andesine setup.

Validation: check event and source types against the published SDK; inspect built
server/client output and example source URLs. Use recorded event examples to
inspect states when live calls are unavailable. Do not make billable live answer
requests just to approve a build; leave live service checks explicit for review.

Review result: search-to-answer interaction, citation mapping, stream cancellation,
and deployment requirements. **Pause for review.**

### Step 14 — Implement the OpenAPI content source

Work: load configured specs, validate the supported versions, resolve references,
and normalize operations, parameters, request bodies, responses, security schemes,
schemas, and examples. Handle recursive references without infinite expansion.
Define stable operation identity and page URLs when `operationId` is absent.
Group navigation by source-owned rules and report duplicate IDs/routes.

Keep parsing and generation outside UI. Register normalized operations/reference
pages through Astro collections. Include multiple specifications, media types,
deprecated operations, composition schemas, and explicit unsupported-feature
diagnostics in the support documentation.

Validation: build small example specs and the checked-in public Andesine OpenAPI
document. Inspect operation counts, navigation, reference resolution, and generated
data. Example specs are authoring fixtures, not a new automated test suite.

Review result: normalized API model, loader configuration, support matrix, and
route/navigation output. **Pause for review.**

### Step 15 — Build reference UI and language examples

Work: add headless bases and Pages styles for operations, methods/paths, parameters,
request bodies, responses, schema fields, auth descriptions, and examples. Use the
shared tabs/code controls. Generate the agreed language examples and apply author
overrides per operation, language, and example/media-type selection. Include an
extension point for extra language generators and custom SDK examples.

Generate useful placeholders without embedding credentials. Show recursive schema
references as references rather than expanding indefinitely. Do not implement a
“send request” feature or TypeScript API extraction.

Validation: inspect generated snippets, quoting/escaping, selected examples,
required/optional labels, recursive schema output, and shared language state.
Build a representative API component showcase.

Review result: reference component contracts, generated examples, override rules,
and styled output. **Pause for review.**

### Step 16 — Connect embedded operations and generated reference sections

Work: add the MDX wrapper and Andesine element mapping for selecting a configured
spec and operation. Add generated reference routes/navigation alongside other
sources. Reuse the same normalized operation data and UI in both forms. Define
unique anchor prefixes for repeated operation embeds. Integrate local reference
pages with Pagefind and mixed results without adding them to Andesine AI context.

Validation: build a site with a guide containing an operation embed and a generated
reference section. Inspect routes, base paths, headings, search records, language
overrides, and collisions with hand-authored pages.

Review result: both authoring workflows and one complete mixed documentation build.
**Pause for review.**

### Step 17 — Finish site output and user documentation

Work: complete site/page metadata, canonical URLs, sitemap, robots policy, root
behavior, 404 output, source-owned redirects where supported, and actionable
configuration diagnostics. For redirects, document host-specific deployment
requirements; do not promise server redirects from plain static HTML.

Finish quick starts for default Andesine, files-only, mixed sources, SSG, and SSR.
Document manual schema setup, properties/fragments, element extensions, UI usage
outside Astro, theming, OpenAPI, generated languages, search, AI, endpoint hosting,
and asset behavior. Explain manual template upgrades and the selected runtime
requirements. Include Markdown alternatives and `llms.txt` output needed for the
existing first-party docs migration, without adding an automatic schema extension.

Validation: run targeted type/lint/format/build checks and inspect generated metadata,
internal links, alternate outputs, environment examples, and setup instructions.
Ensure examples use public APIs and do not disclose credentials.

Review result: complete template documentation and a release-readiness checklist
with pending checks clearly marked. **Pause for review.**

### Step 18 — Migrate Andesine's own documentation

Work: replace Nimbus in `apps/docs` with a consumer copy of the template. Preserve
existing content and plan explicit redirects for changed URLs. Retain `/docs/`
deployment behavior, Markdown alternatives, `llms.txt`, required metadata, and the
edge binding unless reviewed changes require otherwise. Replace Nimbus-specific
instructions and scripts with the new authoring workflow.

Start from existing local docs without losing content. Configure a real Andesine
collection through the documented manual setup when the user supplies it. Include
generated API reference from the public spec. Do not auto-create a collection or
publish content; the schema setup extension is deferred. If real Andesine content
is not available, mark first-party Andesine-source adoption pending rather than
claiming that a files-only migration proves it.

Existing Nimbus behavior may need to change. Record deliberate changes for review,
without retaining Nimbus as a compatibility layer. Do not deploy during this step.

Validation: docs type/build checks, route and alternate-output comparison, asset
and private-dependency inspection, and Cloudflare output configuration review.

Review result: first-party migration diff, route changes, source setup status, and
deployment artifacts. **Pause for review.**

### Step 19 — Verify independent distribution and prepare release artifacts

Work: build and pack Andesine UI; copy the template outside the workspace; resolve
dependencies from public versions and the packed UI artifact. Extend existing
public-package check/release workflows for UI. Provide a documented template-copy
method and a versioned template artifact; do not add a required CLI or a new
integration product. Record package and template versions/changelogs separately.

Validate the release matrix:

| Configuration    | Required output                                                               |
| ---------------- | ----------------------------------------------------------------------------- |
| Files only       | Static pages and Pagefind; no key or server required.                         |
| Andesine SSG     | Static pages, durable copied assets, runtime search/AI transport.             |
| Andesine SSR     | Live collection pages plus the same runtime search/AI transport.              |
| Mixed            | Prerendered files/OpenAPI pages with source-owned routes and combined search. |
| Standalone Solid | UI components work without Astro, SDK, converters, or template CSS.           |

Inspect package exports, declarations, Solid resolution, licenses, fonts, build
assets, server bundles, and browser dependency graphs. Confirm that no private
workspace alias, secret, unpublished source import, or parent build configuration
is required. Finish README install commands with actual release versions.

No npm publication, production deployment, or content publication is included in
artifact preparation. Those actions require an explicit user instruction. Keep
manual browser/accessibility review and unavailable live-service checks listed as
pending; do not label them passed from static inspection alone.

Review result: packed UI archive, copied template, validation matrix, change notes,
and any remaining release conditions. **Pause for final review.**

## Completion criteria

- An external user can copy Pages and build it independently of this repository.
- Default Andesine setup uses an API key and main collection ID, with documented
  schema setup and runtime deployment requirements.
- Local files remain SSG-only; Andesine supports SSG and SSR through Astro collections.
- Sources own the data layer. UI owns unstyled component structure/behavior. Pages
  owns design and rendering composition.
- Both search paths work; Andesine exposes the agreed AI action and files do not.
- OpenAPI embeds and generated references share UI and language/example behavior.
- SSG assets do not rely on retention of a historical Andesine snapshot.
- No private package dependency, framework cache, fixed-snapshot configuration,
  dark mode, version selector, or locale selector is introduced.
- Both deliverables have explicit MIT licensing and complete setup documentation.
- Andesine's own docs use the public interfaces, with any pending CMS setup clearly
  stated.
- Each implementation step has been reviewed before the next step starts.

## Reference material

- [SDK documentation](./sdk/README.md) and [converter documentation](./converters/README.md).
- [Public package release conventions](./README.md).
- [Current docs application](../../apps/docs/README.md).
- [Astro content collections](https://docs.astro.build/en/guides/content-collections/):
  build-time and live collection APIs.
- [Astro content loader API](https://docs.astro.build/en/reference/content-loader-reference/):
  custom loader data, metadata, and live loader contracts.
- [Astro framework components](https://docs.astro.build/en/guides/framework-components/):
  hydration, static children, and framework composition limits.
- [Pagefind Node API](https://pagefind.app/docs/node-api/): custom records and
  development indexing.
