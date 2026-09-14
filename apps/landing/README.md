# Andesine landing page

Static Astro site with Solid.js components, UnoCSS, and SCSS. Shared `Button` and `Card`
components, logo, dotted background, animated gradient, and font styles come from
`@andesine/components`. These are also used by the web app's auth pages. The UnoCSS configuration
extends the web app's colors, icon collection, and component class transformers.

- Dev server: `pnpm --filter @andesine/landing dev`
- Build: `pnpm --filter @andesine/landing build`
- Type check: `pnpm --filter @andesine/landing check`
- Output: `apps/landing/dist`

The dev command loads the root `.env` and listens on all network interfaces on port 4321.
Like the web app, HTTPS uses `HTTPS_KEY_PATH` and `HTTPS_CERT_PATH`, resolved from the
repository root. Set both to use HTTPS, or leave both unset to use HTTP. The existing local
certificate supports [https://macbook-pro.local:4321](https://macbook-pro.local:4321).
Devices that open this address must trust the certificate's local CA. Restart an existing
dev process with the command above to load these settings and remove any old `--host` override.

All navigation destinations are defined in `src/links.ts`, including page anchors, the cloud
app, GitHub, and documentation. Cloud sign-in and sign-up use same-origin application routes.
Documentation uses the local `/docs/` route served by the edge Worker. The known GitHub and Vrite destinations remain real URLs. Primary actions
always lead to the cloud app; GitHub is secondary. Links and labels do not depend on environment
variables. The header and footer include documentation, with dedicated publishing and API guides
linked from the publishing section. HTTPS development settings remain in the root `.env`.

The page reuses compositions from [Vrite](https://vrite.io/) and its
[original source](https://github.com/vriteio/andesine/tree/main/apps/landing-page): a floating
header, split hero, overlapping editor screenshots, and three-column team grid.
Editor and search use large fading screenshots with overlapping detail images.
The detail images alternate right and left, with copy on the opposite side.
The editor uses the collection schema and explorer captures. A dedicated structure section
pairs a faded properties and fragments screenshot with open text and small icons for
properties, fragments, shared schemas, and custom elements. It stacks on smaller screens.
The main sections follow the product workflow: editor, structure,
publishing/API, search, then team features. Pricing follows, then an FAQ, a standard-width CTA with the shared section heading and two compact action buttons, and footer.
The cloud action uses the billing upgrade button’s gradient and noise; GitHub is outlined. The blog section is omitted.

The hero heading introduces the open-source workspace and rotates through four use cases
with a 3D flip. A small tagline below reads “The adaptive content workspace.” The rotation
pauses outside the viewport, in hidden tabs, and through its pause control. Reduced motion
shows the first use case without rotation. A compact Write → Structure → Publish row after
the hero screenshot connects the features to one guide workflow.
The shaded step cards have focused Chrome captures of the formatting toolbar, property settings,
and publishing menu above connected labels. The images use a slight angle and fade before the text.
The FAQ uses native details and summary elements, with animated expansion in supporting browsers and
a fade fallback. It works without JavaScript and respects reduced motion.

Dotted backgrounds sit behind the hero and editor screenshot groups only.
They extend beyond the screenshots, then fade at their outer edges while staying inset from the viewport.
Entry animations follow Vrite's short fades and slides, staggered cards, and slower hero
screenshot tilt. A shared observer reveals each element once. Content stays visible without
JavaScript or with reduced motion, and keyboard focus bypasses any pending animation.

The fonts, favicon, and gradient noise texture are copies of the existing web app assets.
Feature cards use inline SVG diagrams with CSS animations. The publishing section shows
content API access, custom channels, versioning, content transformers, and one-way publishing from Andesine to GitHub
as a wide horizontal strip of shaded cards. API delivery leads the introduction and documentation links. Native scrolling, scroll snapping, edge fades,
and previous/next controls support touch, trackpad, and keyboard use. Reduced motion disables smooth
scrolling. A real repository capture can be added after the feature
exists; the section currently uses explanatory diagrams only. Verify custom-element syntax, transformer outputs,
and automatic sync behavior before publication; the copy does not promise two-way sync,
pull requests, or website deployment. Version history has a dedicated publishing card.
The separate team grid covers collaboration, access, and the planned MCP integration.
Verify the planned MCP feature before publishing.
These are explanatory graphics, not product screenshots. Motion stops when reduced motion
is enabled. The hero uses a Three.js mesh with animated folds, the shared theme colors,
and the existing noise texture at full strength. Its canvas sits below the hero buttons
with the middle third fully opaque. The mesh is 5.4 units wide;
the outer thirds fade to transparent. The drawing area and reserved page space are 14rem high.
The ribbon rises 6° from left to right. Its canvas extends beyond both page edges to keep
the tilted ends outside the viewport, and its wrapper allows the rotated corners to overflow.
Grain uses the auth card's six-rem tile size
in screen space with mipmaps disabled, so twisting does not smooth the noise away.
The twist is limited to about 41.4°, retaining 75% of the untwisted width at the tightest fold
instead of 50%, making the narrowest folds 1.5 times as wide as before.
The mesh pauses outside the viewport or in hidden tabs and shows a still frame for reduced
motion. The ribbon stays hidden until its noise texture has loaded and its first complete
frame has rendered, then reveals from left to right with a soft fade. Reduced motion skips the fade. If the renderer or texture
cannot load, the decoration stays hidden without changing the reserved layout space.
The seven original screenshot slots use real Chrome captures from the local Northstar sample workspace,
stored in `public/_landing/screenshots`. Main views were captured at 2× resolution. Detail images
are crops of the real fields, AI answer, and explorer views. Capture comments at their use sites
describe the target dimensions and content. The sample workspace contains a publishing guide,
supporting review and structure guides, and an active Product updates schema.

Pricing follows the billing settings: Free and Pro at $12 USD per seat per month, with
1K Free API calls, 500K Pro API calls, and $1 per additional 50K Pro calls. Allowances are
per workspace and calendar month in UTC. The backend defaults, billing UI, and `.env.example`
now agree on the 500K Pro allowance. Keep the landing copy aligned with deployed settings.

The page renders to static HTML. The header menu, hero heading, and hero ribbon hydrate on load.
Publishing controls and the pricing gradient hydrate when visible. The CTA is static and needs
no client hydration. Native scrolling, page content, screenshots, and links remain available
without client JavaScript.

`components/landing-page.tsx` defines the page order and receives interactive Astro islands through slots.
`components/shared/` contains reusable layouts, buttons, screenshots, graphics, and site navigation.
`components/sections/` contains the page sections. The hero heading, ribbon, and Three.js scene
stay together in `components/sections/hero/`.
The hero, editor, search, team, and footer each have their own component. `section.tsx` owns
section headings, width, spacing, and heading associations. `screenshot.tsx` owns screenshot
cards and overlapping panels; `screenshot-section.tsx` combines them with the section layout.
`feature-description.tsx` shares the text and optional marker line used by workflow cards,
feature cards, and structure details. `action-button.tsx` shares both CTA button layouts.
The pricing feature list stays local to `pricing.tsx` because only the two plans use it.

Only the eight rendered feature diagrams remain in `feature-graphics.tsx`. Original captured
screenshots are retained in `public/_landing/screenshots` as source references, including captures
that are not currently displayed.
