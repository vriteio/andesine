# @andesine/extensions

Authoring tools for Andesine extensions. Extension frontends are Solid components
that run in a sandboxed worker. Andesine renders its own components from the
serialized view tree; extension code has no DOM access.

## Views

An extension's views are Solid components in `src/views.tsx`, the frontend entry:
its default export is `defineViews`, and its `Views` type names them for the
manifest.

```tsx
// src/views.tsx
import { createSignal } from "solid-js";
import { Button, Stack, Text, defineViews } from "@andesine/extensions/solid";

const Counter = () => {
  const [count, setCount] = createSignal(0);

  return (
    <Stack direction="row" gap="small">
      <Text>{count()}</Text>
      <Button onClick={() => setCount(count() + 1)}>Add</Button>
    </Stack>
  );
};
const views = defineViews({ Counter });

export type Views = typeof views;
export default views;
```

`andesine.config.ts` imports only that type, so it never runs view code, and
names each contribution's view with `viewRefs`:

```ts
import { defineExtension, viewRefs } from "@andesine/extensions";
import type { Views } from "./src/views";

const View = viewRefs<Views>();

export default defineExtension({
  // …
  panels: [
    { id: "counter", side: "left", name: "Counter", icon: "i-lucide:hash", view: View.Counter }
  ]
});
```

A view must accept the props of its contribution, e.g. a `collection` panel's
`{ collectionID, entryID?, publishingCollectionID?, pageID? }`, so a missing,
renamed, or unfitting view is a type error. The build refuses a config that
imports view code as a value, e.g. `import views from "./src/views"`. The CLI
compiles JSX for the universal renderer and bundles the views for the sandbox.

Only the exported host components render. Props must be JSON values; functions
become callbacks that the host calls with plain values.

## Element views

An element view renders a document element (for example `<Accordion>`) and
receives `{ element, props, index }`; `index` is the element's position among its
siblings with the same name, e.g. to number steps. `ContentSlot` shows the element's editable
content; Andesine keeps that content when the slot is hidden. A view's CSS also
styles its own content, down to nested element views, and `contentClass` puts
utility classes on the content itself, e.g.
`<ContentSlot contentClass="grid gap-4 @lg:grid-cols-2" />` for a grid of cards
(container queries need an `@container` ancestor in the view). `class` styles the slot; with
`contents` on both (`<ContentSlot class="contents" contentClass="contents" />`), the content's
blocks become items of the slot's parent, so the view's own UI can join them, e.g. an
"Add card" button as the last cell of the grid.

Inside a view, the editor's drag handle and block menu, in the gutter, a right click, and a box
selection are for the top-level block only. `<ContentSlot controls>` opts the content's blocks in
to all of them, e.g. a tab's paragraphs. When a view draws a block in its own UI, e.g. a tab in a
tab bar or the element itself as a callout's icon, `<BlockArea block={key}>` around that UI turns
on each behavior separately, all off by default:

- `menu`: a right click selects the block and opens its editor menu, with its props and Delete.
- `draggable`: dragging the UI moves the block. Drops on it go before or after the block, by side
  in a row of areas, e.g. tabs.
- `controls`: hovering the UI shows the block's drag handle and block menu, in the gutter.
- `selectable`: a box selection selects the block by the UI, and the arrow keys stop on it with a
  block selection, e.g. a file row, where Enter opens its menu; nested areas count by the innermost
  ones, e.g. a folder's row; an element whose content doesn't opt in counts by its whole box, e.g. a
  card. A box over all of an element's opted-in children selects only them;
  the element is selected by its own `selectable` UI, e.g. an accordion's header, or when the box
  goes across its edge. The editor's shade has the full width over the selected blocks' boxes.
- `onActivate`: Enter or Space on the block, reached with the arrow keys, e.g. a tab button
  shows its tab; without it, Enter opens the block's menu.
- `marksSelection`: the view marks the block's selection itself, with the child's `blockSelected`,
  so the editor draws no block selection shade, e.g. for a hidden tab. Without it, mark UI inside
  the editor's shade, e.g. an icon tint, with `inBlockSelection`.
- `droppable`: the block is a drop slot, e.g. a card in a grid. Areas whose blocks are in the same
  element form a group; over that element, the editor's own drop positions are off, and a drop
  near an area takes its block's place: after it when the dragged blocks come from earlier in the
  same element, else before it. With `droppable="append"`, a drop goes at the end of the block's
  content, e.g. a grid's "Add card" button with the grid's own `key`. The editor draws no drop
  indicator there: mark the target with `dropTarget`, and the dragged blocks with `dragged`.

Declare which blocks an element's content accepts in `accepts`, on a view or on one of its
`children`: `{ elements?: ["Tab"], blocks?: ["codeBlock"] }`, for its direct child blocks; without
it, any. `rejects`, with the same shape, lists blocks that don't fit even then, e.g.
`rejects: { elements: ["Accordion"] }` for any content but a nested accordion. The editor follows the rules: it offers only accepted blocks in the slash menu and
"Turn into", refuses edits that would add others, and shows a warning in the gutter next to an element with
content that doesn't fit. Its clean-up wraps such blocks into a new accepted child that can hold them
(e.g. paragraphs into a `Tab`, with the child's `props`), or moves them after the element. The
backend doesn't enforce the rules; MCP clients read them from `andesine://guide/elements`.

Give a view, or one of its named `children`, a `category`, e.g. `"Docs"`, to show its elements
in their own group in the slash menu; children default to their root's category. Categories are
the same across extensions: trimmed, single-spaced, and case-insensitive, shown with an upper
case first letter. Elements without one are in the "Elements" group.

Declare an element's props in `props`: an array of fields, shown in that order,
each a flat JSON Schema subset with its `name` (string fields with an `input`,
`textarea`, `icon` (Lucide, Tabler, and Simple Icons), or `link` (entries, URLs, and paths)
control, string enums with a `select` or `toggle` control,
numbers, and booleans, each with a `title`, `description`, and `default`), e.g.
`[{ name: "title", type: "string", default: "Details" }]`. A new element gets
the props' defaults; props are optional, and clearing one restores its default.
Andesine edits the props natively: the element's menu (its block menu and
right-click menu) shows a props form, and the element's tag edits the same
props. The view only renders them; `children` take `props` too.

`props` and the settings in `configuration` take the same three forms; the build
turns the last two into the array, keeping the order of their properties:

- the array of fields;
- one JSON Schema object, `{ type: "object", properties: { … } }`, whose
  `required` marks required settings;
- a schema library's schema with Standard JSON Schema, e.g. a Zod object, with
  `.meta({ title, control, … })` for the other keywords.

A view of a wrapper element, e.g. a
card grid, adds children with `useEditor().append(block)`, which also moves the
cursor into the new child's text. The block is editor JSON, e.g.
`{ type: "element", attrs: { name: "Card", props: { title: "Card" } } }` or
`{ type: "codeBlock" }`; an element without `content` gets an empty paragraph,
unless `attrs.selfClosing`.

### Wrapper elements

A root view can draw its child elements too, e.g. Tabs with their tab bar. List
them in the view's `children` (`{ element, name?, description?, icon?, content?,
props? }`) and put an `<Element tag>` template directly inside the
view's `ContentSlot`; each child is still its own element with its own
`ContentSlot`, and the template can use the root view's state:

```tsx
<ContentSlot>
  <Element tag="Tab">
    {(tab) => (
      <Box class={tab.index === selected() ? "" : "hidden"}>
        <ContentSlot />
      </Box>
    )}
  </Element>
</ContentSlot>
```

A child element that only a template draws, without a root view of its own, belongs in that
root: the editor keeps it directly inside the root, or inside another of its `children` whose
`accepts` lists it, e.g. a `Folder` in a `Folder`. It refuses drops, pastes, and moves that would
put it elsewhere, and marks one that's elsewhere in the gutter, e.g. a `Step` outside `Steps`.

Templates and root views receive
`{ element, props, index, key, blockSelected, inBlockSelection, dropTarget, dragged, children }`:
`key` is the element's node ID, e.g. for its own `BlockArea`, `blockSelected` whether a block
selection selects the element itself, e.g. to draw its own shade with `marksSelection`,
`inBlockSelection` whether a block selection holds it, also with an element around it, e.g. to
tint the icon of a file in a selected folder, and `children` its direct child blocks
(`{ key, type, element?, props?, language?, title?, hasSelection, blockSelected, handleTarget,
dropTarget, dragged }`),
e.g. for a tab bar; `hasSelection` marks the block with the cursor, and `handleTarget` the
block that the editor's drag handle is for, e.g. to outline a hovered card. Standard blocks, which the editor draws, take a presentation:
`<Block type="codeBlock">{(block) => ({ hidden })}</Block>` inside the
`ContentSlot`.

## Pages

A page is a view in the main content area, for settings or tools too large for a
panel. Declare it in `pages` (`{ id, name, icon, context, view }`, up to 5);
`context` is `workspace`, `collection`, or `entry`. Workspace pages are in the
sidebar, collection and entry pages in their menus, and `openPage(id, context?)`
opens one from a view, e.g. `openPage("site", { collectionID })`. A collection
page receives `{ collectionID }` and an entry page `{ entryID }`; with
`highlightContext: true`, the explorer marks that collection or entry as open
while the page shows. Split a large page into sub-pages with `parent`, the ID of
a page without one, and the same `context` (up to 20), e.g. a site's domains:
sub-pages aren't in menus, so link them from the parent with `openPage`, e.g. a
`Setting` row with a chevron button. Their title shows the parent, which links
back, and they mark what the parent marks.

Collection and entry menus list an extension's pages under one item with the
extension's name and icon: it opens the page that's available, or a submenu
when several are. A page's `when` sets when it's available, in menus, links,
and `openPage`, so one task can have pages with fixed names, e.g. "Setup"
until a collection is mapped and "Mapping" after. Andesine checks it without
running the extension: `publishing` (whether the collection or one around it has
publishing on) and `storage` (whether a key of the extension's storage exists),
whose key can use `{collectionID}`, `{entryID}`, or `{publishingCollectionID}`
after fixed text:

```ts
when: { storage: { key: "mapping:{publishingCollectionID}", exists: true } }
```

Andesine reads the keys when the extension starts and follows each storage write,
also the backend's, so menus and pages update by themselves; `openPage` reads the
keys again if the page isn't available yet, e.g. right after the backend saved a
mapping. Views get the same writes with `storage.onChange((change) => …)`, which
gives the `key` and whether it `exists`, and returns its removal for `onCleanup`:
load the data again on a change, e.g. when the backend ends a sync, instead of
polling.

A right panel's `context` works the same way: a `collection` panel receives
`{ collectionID, entryID? }`, with the open entry's ID if one is open, and an
`entry` panel `{ collectionID, entryID }`. Both, and collection and entry pages,
also receive `publishingCollectionID`: the nearest collection with publishing on,
the open one or one around it, e.g. the root of a docs site for an entry in a nested
collection; it's missing outside such collections. Read a collection's name with
`collections.get` of `@andesine/sdk` (`read:collections`). Right panels stay next to the
extension's pages and also receive `pageID` while one of them is open. Keep a
panel short, e.g. the state at a glance, and link the pages with `Navigation`
(`sections` of `{ id, label, icon }` items, `selected`, and `onSelect`), which
looks like the app's settings menu: `selected={pageID}` marks the open page. Show
the state as `Item` rows, like the app's version rows, not in a `Card`: an `icon`
whose `tone` is the status (`success`, `warning`, `danger`), a `label`, and a line
of `details` after an optional `date`, e.g. `date={run.at} details={["4 skipped"]}`;
`onClick` makes a row clickable, and its children are actions shown on hover. Group
rows in an `ItemGroup` with a `label`, the small header that `Navigation` sections
have; what follows a group, e.g. `Navigation`, is 12px away. Pages look like Andesine's settings: the host shows the page name as the title
in the settings width. Build them from `Section`s (a labelled group) of `Setting`
rows (label and description on the left, the control on the right); put a table
or a larger input right after its `Setting`. `SaveBar`, last on the page, is
the form's footer as in the app's settings: a line, a discard icon button, and
the save button, which `dirty` enables. Show `Skeleton`s in the shape of the content while it
loads.

## Host actions

`copyText(text)`, `downloadFile(name, text, type?)`, `openURL(url)`, and
`openPage(id, context?)` ask
Andesine to act for the extension. Call them from an interaction, for example a
button's `onClick`; otherwise they reject with `ExtensionRequestError` and the
code `user_interaction_required`. `openURL` asks the member to confirm URLs
outside the manifest's declared URLs. `notify(text, type?)` shows a short
notification with the extension's name and needs no interaction.

## Block actions and edits

A block action view receives `{ blocks }`: the selected blocks as editor JSON.
`useEditor()` returns `replace(content)`, `insertAfter(content)`, and `close()`
for block action views, and `setElementProps(props)` for element views (call it
from an interaction). Content must be blocks that are allowed where the
selection is; edits fail when the selected blocks changed meanwhile. Elements
are `{ type: "element", attrs: { name, props }, content }`; Andesine derives
their tag.

The view decides its UI at its root. A view that renders nothing runs without
UI: the block menu shows a spinner until the view calls `close()`, and Andesine
stops it after 30 seconds. One root `<Dialog title>` opens a modal, and one root
`<Menu>` opens a menu where the block menu was; anything else at the root stops
the action with an error. Escape, an outside click, or the close button close
them like `close()`; after a menu choice, the action runs on until it closes.
Choosing the action counts as an interaction, so host actions work right away.

## Dialogs and menus

`Dialog` and `Menu` work in any view. A dialog is shown while it is rendered and
calls `onClose` when dismissed; outside block actions, render it right after an
interaction, e.g. from `onClick`, otherwise it is not shown. A `Menu` is a
dropdown menu: `MenuTrigger` holds its trigger (with `contextMenu`, the area
that opens it on a right click), and its items are `MenuItem` (nested items
make a submenu; `loading` shows a spinner), `MenuGroup`, `MenuSeparator`, and
custom `MenuContent` with any content. `opened` and `onOpenChange` control it.

## API, permissions, and backend

```ts
import { createClient } from "@andesine/sdk";
import { EXTENSION_API_URL, apiFetch, backend, hasPermission } from "@andesine/extensions/solid";

const client = createClient({ baseURL: EXTENSION_API_URL, fetch: apiFetch });
const entries = hasPermission("read:entries") ? await client.entries.list({}) : [];
const response = await backend.fetch("/publish", { method: "POST" });
```

API requests use the member's session and are limited to the member's
permissions that the extension was granted (`usePermissions()`); other
operations answer with HTTP 403. `backend.fetch` calls paths of the manifest's
backend URL with a short-lived session token in `Authorization: Bearer`, which
the backend verifies with Andesine.

## Examples

`npx andesine extensions init` creates a project with samples of the main features: element
views, a block action, a panel that calls its backend, settings, and webhooks. Published
extensions in the public registry show complete projects.
