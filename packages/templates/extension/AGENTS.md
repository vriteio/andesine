# AGENTS.md

Rules for coding agents that build or change this Andesine extension.

## Project

- `andesine.config.ts` is the manifest: permissions, backend, webhooks, configuration, and the views
  (element views, block actions, panels, pages). Each `view` is `View.<name>` of
  `viewRefs<Views>()`, a view that `src/views.tsx` registers with `defineViews`.
- The config imports only the views' type (`import type { Views } from "./src/views"`); never
  import view code into it. Add a view by importing it into `src/views.tsx` and adding it to
  `defineViews`.
- `src/frontend` holds the views. They run in a sandbox and render with the components of
  `@andesine/extensions/solid`; plain DOM elements and other UI libraries don't render.
- `src/backend` holds the backend: webhooks and frontend session checks.
- Run `npm run build` to check the manifest and the frontend after changes. `npm run dev` runs the
  extension on a local instance and reloads it on each change; restart it after changing
  `@andesine/extensions` or the CLI.
- Never write private keys or `.env` values into files that Git tracks.

## Code

- Style with utility classes; put conditional classes together with `clsx`, not template literals.
- Keep UI state, e.g. an open section or a selected tab, in Solid signals. Use element props only
  for what the document stores, and edit them through the element's `props` in the config. Keep a
  selected child by its `key`, not its index, so it stays selected when children move.
- Write an element's `props` and the `configuration` as an array of fields, e.g.
  `[{ name: "tone", type: "string", enum: ["info", "warning"], control: "toggle" }]`, or as a Zod
  object, e.g. `z.object({ tone: z.enum(["info", "warning"]).meta({ control: "toggle" }) })`. The
  forms show the fields in that order, and a new element gets the props' defaults.
- Give string props that hold an icon class `control: "icon"` (an icon picker of Lucide, Tabler,
  and Simple Icons), and props that hold a link `control: "link"` (entries, URLs, and paths; an
  entry is an `entry:<entryID>` link).
- Add children with `useEditor().append(block)`, e.g.
  `{ type: "element", attrs: { name: "Step", props: { title: "Step" } } }` or
  `{ type: "codeBlock" }`; call it from a user interaction.
- Render lists whose items are new objects on each change with `Index`, not `For`: `For` keys rows
  by object, so it replaces their elements. An edited row, e.g. `{ ...link, label }`, then loses
  the focus after every key, and in element views a drag stops when its source leaves the page.

## Panels and pages

Panels and pages use host components that look like the app's: `Item` rows like version rows,
`ItemGroup` and `Navigation` sections like the settings menu, and `Section`, `Setting`, and
`SaveBar` like a settings page. Say what to show; don't restyle them with classes.

### Panels

- Keep a panel short: the state at a glance and links to pages. Put full details, forms, and
  actions that change things on pages.
- Show the state as `Item` rows, not cards: a `label`, an `icon` whose `tone` shows a status where
  it helps, `date` first in the details line (relative, with the date in a tooltip), and short
  `details`, e.g. `date={run.at} details={["2c30d53", "4 skipped"]}`. `onClick` opens the page with
  the full details.
- Group rows in an `ItemGroup` with a small `label`, e.g. the collection's name, and link the
  pages with `Navigation`, e.g. a "Manage" section, with `selected={props.pageID}` and `openPage`.
  Don't add dividers or gap classes between them.
- Work on the collection the feature is about, e.g. `publishingCollectionID` for a sync or a site,
  and name it in the panel. Without its prerequisite, e.g. publishing, say why and how to fix it.
- Show running work as its own row (`tone="primary"`, `date` = its start) above the last results.

### Pages

- Build pages from `Section`s of `Setting` rows; put a table or a textarea right after its
  `Setting`. Show facts that can't change there as `Text size="base" weight="medium"`.
- Give pages fixed names for what they hold, e.g. "Mapping settings" and "Sync details", and use
  `when` for states, e.g. "Setup" while the storage key `mapping:{publishingCollectionID}` is
  missing and "Mapping settings" once it exists. After a change, open the other page with
  `openPage`.
- A setup page is a form too: show the collection as a fact, the source channel first, and end it
  with a `SaveBar` whose `saveLabel` is the action, e.g. "Create site".
- End a form page with its `SaveBar`, and put nothing after it. Put actions that apply at once and
  long details, e.g. "Sync now", the last runs, and "Disable sync", on a sub-page with `parent`.
- Name a destructive action for its effect, e.g. "Disable sync", not for the stored data.

### Forms

- Show a field only when it applies, e.g. a branch after a repository, and order fields as the
  decisions are made.
- Use `Combobox` for long or searchable lists, `Select` for a few options, and `Input code` or
  `Textarea code` for paths and glob patterns. While a field's options load, show
  `<Skeleton class="h-7" />` in its place.
- Make an on/off setting a `Checkbox` as the `Setting`'s only child, not a `Toggle`; the whole
  row toggles it. Choose several options from a fixed list with a `MultiSelect`.
- Take links with a `LinkInput`, not an `Input`: a combobox of the workspace's entries that takes URLs
  (and paths with `paths`); a chosen entry is an `entry:<entryID>` link. Pass `collectionID` when
  only the entries of one collection make sense, e.g. a site's.
- Take icons with an `IconPicker`, not an `Input` of icon classes; pass the `sets` that make sense,
  e.g. `simple-icons` first for brand logos, and `clearable` for an optional icon.
- Put a list's add action in the `Setting` above it, as a `Button` with `icon="i-lucide:plus"`;
  `List` itself only removes and reorders. Keep each item one row: e.g. a `compact` `IconPicker`,
  then the fields, the widest one last.
- Show a spinner only on the button of the running action, and disable the others meanwhile.

### Data

- Share state between the panel and the pages in a module-level signal: all views of the extension
  run in one sandbox, so an action on a page shows in the panel at once.
- Load data again on `storage.onChange` when the backend writes it, e.g. when a job ends, instead
  of polling.
- While a page's main data loads, render nothing: Andesine shows its spinner. Then show all of the
  page at once, with a `Skeleton` only for parts that load later, e.g. `<Skeleton class="h-7" />`
  for a field whose options load.
- A panel draws its own skeleton while it loads; Andesine adds none. Use two rows in `Stack`s, as
  the Versions panel: a `<Skeleton class="h-5 w-5 rounded-md" />` icon and `h-5 w-36 rounded-md`
  and `h-3 w-24 rounded-[0.25rem]` lines per `h-11` row. Use small rounded corners, never circles.
- Leave a panel's skeleton only once all that its rows show has loaded, e.g. the collection's
  name and the channel names, so that nothing shows late or shifts the rows.
- Keep notifications short, e.g. "The sync has started"; Andesine adds the extension's name.
- Show a status as a `Badge` with an `icon` whose `tone` is the status, e.g.
  `<Badge icon="i-lucide:circle-check" tone="success">Live</Badge>`.
- List records with details, e.g. builds or syncs, as `Item` rows with an `ItemDetails` child:
  the row opens on a click to show badges, the error, and the log; give a failed latest one `open`.
- Show a failure as a `Callout` with `tone="danger"`: a short title, e.g. "The last build failed",
  one plain sentence, and a `Button` child as its action, e.g. "Details" to the page with the full
  details. Put long output, e.g. a log, on that page in a `Disclosure` with `CodeBlock log`.
- Say what a known state means instead of showing it as a failure, e.g. "Nothing is published
  yet", and disable the actions that can't work then, with a tooltip that says why.
- In the backend, run independent API requests a few at a time (about 6), and keep idempotency keys
  the same on a retry, e.g. by sorting the items before chunking them.

## Element views

An element view draws a custom element, e.g. `<Callout>`, in the editor. It should look like the
element's published output and behave like a built-in block.

### Content

- Show the element's editable content only with `ContentSlot`. Give it a short, imperative
  `placeholder`, e.g. "Describe the step".
- Put the padding around the content on the `ContentSlot` (`class="px-4 py-3"`), not on a wrapper,
  so that space counts as content for the drag handle and drops.
- Remove the content's outer margins with
  `contentClass="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"`.
- To lay content blocks out with the view's own UI, e.g. cards in a grid with an "Add card" cell,
  use `class="contents" contentClass="contents"` on the `ContentSlot`.

### Content rules

Declare what the content takes, so the editor offers, accepts, and pastes only that:

- `accepts: { elements: ["Step"] }` for wrappers of child elements, or
  `accepts: { blocks: ["paragraph"] }` for text-only content.
- `rejects: { elements: ["Accordion"] }` for "anything but", e.g. no nested accordion.

Child elements listed in a view's `children` and drawn with `<Element tag>` belong in that view's
element; the editor keeps them there. Give a child that can nest in itself an `accepts`, e.g. a
`Folder` that accepts `Folder` and `File`.

### Interactions

Inside a view, the editor's drag handle, block menu, right click, and box selection are for the
whole element. Opt in where more makes sense:

- `<ContentSlot controls>`: the content's blocks get their own handle, menu, and selection.
- `<BlockArea block={key}>` around UI that stands for a block; each option is off by default:
  - `draggable`: the UI drags the block. Use the element's own `key` to drag the element, e.g. by
    its icon or title. Add `cursor-grab active:cursor-grabbing`, or only `active:cursor-grabbing`
    on clickable UI, e.g. a tab. Never make UI that contains editable text draggable. Make it
    `selectable` too: it stands for the block, for box selection and the arrow keys as well.
  - `menu`: a right click opens the block's menu.
  - `controls`: hovering shows the block's handle and menu.
  - `selectable`: a box selection selects the block by this UI, and the arrow keys stop on it,
    e.g. a file row; Enter then opens the block's menu. When the content opts in, a box over all
    of it selects only the content, so make the element's own UI, e.g. its icon or header,
    `selectable` for its own key. When areas nest, e.g. a folder's row in an area around the
    folder's rows, the innermost ones count.
  - `onActivate`: Enter or Space on the block, reached with the arrow keys, e.g. a tab button
    shows its tab. Give it to UI whose click does something, so the keyboard does the same.
  - `marksSelection`: the view draws the block's selection itself from `blockSelected`, e.g. for a
    card in a grid or a hidden tab. Without it, the editor shades the full width over a
    `selectable` block's box, in one band with its selected neighbors; use that for lists, e.g.
    file tree rows.
  - `droppable`: a dropped block takes this block's place, e.g. among cards or steps.
    `droppable="append"` with the wrapper's own `key` on an "Add …" button drops at the end;
    make it `selectable` too, so a box selection over it selects the whole wrapper.
- For a vertical list of rows, e.g. a file tree, keep the editor's drops between rows: don't make
  the rows `droppable`, but make a row that holds others, e.g. a folder, `droppable="append"`. Space
  the rows with padding inside their `BlockArea`, not with a gap between them.
- For items in a wrapper, e.g. steps, wrap each whole item in a `BlockArea` with
  `menu controls selectable`, and make its badge or title `draggable droppable`.
- For buttons that stand for hidden children, e.g. tabs, use
  `draggable droppable menu selectable marksSelection` on each button.

### State and feedback

- Views and templates receive `key`, `index`, `blockSelected`, `inBlockSelection`, `dropTarget`,
  and `dragged`, and `children` with `key`, `blockSelected`, `dropTarget`, and `dragged` per child
  block. Use `inBlockSelection` to mark selected UI, e.g. tint an icon: it's also true inside a
  selected element, e.g. a folder's rows.
- During a drag, mark the target (`dropTarget`), e.g. with a dashed outline in the shape of its UI,
  such as rounded on a rounded button, and fade the dragged block (`dragged`, e.g. `opacity-50`);
  the editor draws no drop indicator among droppable areas.
- Draw empty states inside the view, e.g. an "Add card" cell that spans the full width while the
  grid is empty.
- For an element that only changes what shows, e.g. content just for agents, mark it as the
  editor's fragments: a header with an icon, a label, and a line to the end, and a line below the
  content; make both `BlockArea`s with its key, `draggable menu selectable`.
- For an element without a frame, e.g. a figure, show its bounds only while it's hovered or the
  cursor is in it (a `children` item's `hasSelection`): a dashed frame on the edges of the editor's
  block shade, e.g. `before:absolute before:-inset-x-2 before:-inset-y-1 before:rounded-lg`.
- Group elements in the slash menu with `category`, e.g. `"Docs"`.
