# Changelog

## 0.8.0

- Element props take `control: "link"`: the element menu shows a combobox of the workspace's
  entries that also takes URLs and paths, and stores an entry as `entry:<entryID>`. The `icon`
  control is now an icon picker of Lucide, Tabler, and Simple Icons.
- **Breaking:** views are the default export of `src/views.tsx`, `defineViews({ … })`, and the
  manifest names them with `view: View.<name>` of `viewRefs<Views>()` in place of `entry` strings.
  `Views` is only a type for the config, and each contribution's `view` must accept its props, e.g.
  a collection panel's `collectionID`; the build refuses a config that imports view code as a value.
  `defineBuild`'s `frontend` defaults to `src/views.tsx`.
- Pages take `when`: `publishing` and `storage` (whether a key of the extension's storage exists,
  with `{collectionID}`, `{entryID}`, or `{publishingCollectionID}` in it) decide when the page is
  available in menus, links, and `openPage`. Collection and entry menus list an extension's pages
  under one item with its name and icon, with a submenu for several pages. `openPage` rejects a page
  that isn't available.
- A page takes `parent`, the ID of a page without one, e.g. a group of a settings page's settings.
  It isn't in menus; `openPage` opens it, and its title shows the parent, which links back with the
  same collection or entry. Up to 5 pages have no parent, and up to 20 have one.
- Right panels with the `collection` context also receive the open entry's `entryID`, if one is
  open, and right panels receive `pageID` while a page of their extension is open. Collection and
  entry panels and pages receive `publishingCollectionID`, the nearest collection with publishing
  on, the open one or one around it.
- `Textarea` has the outlined look of `Input`: a white field with an outline and a shadow.
- `Input` takes `suffix`, fixed text inside the field after the value, e.g. `.example.com` after a
  subdomain; inputs also shrink in a row with other content.
- A page shows Andesine's spinner until its view renders something.
- `MultiSelect` chooses several options, shown as tags with a button that adds one of the others, as
  the editor's multi-select properties: `values`, `options`, `placeholder`, and `onChange(values)`.
- **Breaking:** `List` has no add button, `addLabel`, or `onAdd`: the add action goes in the
  `Setting` above the list, as in the app's settings, e.g. a `Button` with `icon="i-lucide:plus"`.
  An empty list shows a card with `emptyLabel` and the new `emptyIcon`.
- `Button` takes `icon`, shown after the label, as the app's settings actions.
- `IconPicker` chooses an icon: a button with the icon and its name, and a dropdown that searches
  the icons of the `sets` (`lucide`, `tabler`, `simple-icons`; Lucide by default). A set loads only
  when it shows; `compact` shows only the icon in a square button. `onChange(value)` gets an icon
  class, e.g. `i-lucide:link`, or `""` from the remove button of a `clearable` picker.
- `LinkInput` takes a link: a `Combobox` of the workspace's entries, searched by title and
  collection, that also takes a typed URL (HTTP, HTTPS, or mailto), and paths with `paths`.
  `collectionID` lists only the entries in that collection, at any depth. A chosen entry is an
  `entry:<entryID>` link and shows the entry's title. Typed text is taken when the field is left, or
  dropped when it isn't a link: `onChange(value)` gets the link, or `""` when cleared.
- A `Setting` whose only child is a `Checkbox` is one row that toggles it on a click, with a gray
  gradient on hover, as the app's settings lists.
- `Input` and `Textarea` take `code`: monospace, smaller text, e.g. for paths or glob patterns.
- `Item` is a panel row like the app's version rows: an `icon` whose `tone` shows a status, a
  `label`, a line of `details` with lines between them and an optional `date` first (relative, with
  the date in a tooltip), `onClick`, and actions (its children) shown on hover.
- Icon CSS no longer sets `color`, so `tone` on `Icon` and `Item` colors the icon.
- `storage.onChange` calls a listener when a storage key is set or deleted, also by the backend,
  e.g. to load data again when a backend job ends. Page conditions follow storage writes the same
  way, so they no longer read the keys when a menu or a page opens.
- **Breaking:** `Badge` takes `icon` and `tone` in place of `color`: a white outlined chip, as the
  app's webhook deliveries, whose `tone` colors only its icon.
- `Callout` looks like the app's notices: a gray rounded box with a status icon for its `tone`, the
  `title` and text, and its `Button` and `IconButton` children as actions on the right. It wraps by
  its own width, e.g. in a narrow panel.
- `CodeBlock` takes `log`: plain monospace output without the box, at most 60% of the window high.
- `ItemDetails`, a child of `Item`, makes the row open and close on a click, with the details under
  it, as the app's webhook events; `open` opens it at first.
- `ItemGroup` puts `Item` rows under a small header, as a `Navigation` section; what follows it is
  12px away.
- `Combobox` shows the chosen option's label in its field, and closes once an option is chosen.
- **Breaking:** `Skeleton` and `Spinner` take `class` in place of `height` and `size`, e.g.
  `class="h-7"` for a field-high skeleton, or `class="h-6 w-6"` for a bigger spinner.
- `SaveBar` is the footer of a page's form, as in the app's settings: a line, a discard icon button,
  and a full-width save button, always shown; `dirty` enables them, `message` is the save button's
  tooltip, and `saveLabel` defaults to "Save changes". Extension pages keep the right panel.
- `Navigation` shows links in sections, like the app's settings menu, e.g. a panel's links to the
  extension's pages; `selected` marks the open one, e.g. the panel's `pageID`.
- **Breaking:** an element view's `props`, and its children's, are an array of fields, each with its
  `name`, which replaces `propsSchema`; a new element gets their defaults, which replaces the old
  `props` values. `configuration` is an array of fields too, each marking `required: true`. The
  forms keep the array's order. Both also take one JSON Schema object or a Standard JSON Schema
  schema, e.g. a Zod object, which the build converts in the order of its properties.
  `defineExtension` no longer converts by itself, and `ExtensionManifestInput` is now
  `ExtensionDefinition`.
- A child element that only a root view's template draws, e.g. `Step`, belongs in that root: the
  editor keeps it directly inside the root, or in another of its `children` that accepts it, e.g. a
  `Folder` in a `Folder`, and warns about one that's elsewhere. Its menu's clean-up moves it into an
  allowed parent next to it, or wraps it in a new root.
- Element views and their `children` take `rejects` (`{ elements?, blocks? }`): blocks that their
  content doesn't accept, even if `accepts` lists them or there's no `accepts`, e.g. no nested
  `Accordion`. The editor, the clean-up, the public API, and the MCP guide follow it.
- `BlockArea` takes `droppable`: its block is a drop slot that a drop near it takes the place of,
  e.g. a card in a grid, and the editor's own drop positions are off in the element around it;
  `droppable="append"` drops at the end of the block's content, e.g. an "Add card" button. Views,
  templates, and `children` items receive `dropTarget` and `dragged` to mark the drag.
- Views and templates receive `blockSelected`, for a block selection of their element itself, e.g.
  to draw their own selection shade with a `BlockArea`'s `marksSelection`. A press on a view's own
  UI no longer places the text cursor, outside inputs.
- A `Box`'s `class` wins over its default corners, e.g. `rounded-md` on a drop mark.
- A `draggable` `BlockArea` outside its block's box, e.g. a tab button, is the drag image itself;
  others show their block.
- The arrow keys stop on blocks with their own `selectable` UI, e.g. file rows or tab buttons, and
  on views without text, as block selections; Enter opens the block's menu, Escape leaves it.
  `BlockArea` takes `onActivate`, which Enter and Space call instead, e.g. to show a tab.
- Views and templates receive `inBlockSelection`, for a block selection that holds their element,
  also with an element around it, e.g. to tint the icon of a file in a selected folder.
- For a `BlockArea` that's `selectable` without `marksSelection`, the editor's selection shade spans
  the height of the block's `selectable` areas, in one band with selected neighbors, e.g. a folder
  and its rows. A box selection selects a block by its innermost `selectable` areas, so nested
  blocks select alone, and a right click keeps a block selection that holds the block. A box over
  all of a view's opted-in children selects only them; a `selectable` area with the element's own
  key, e.g. an accordion's header, selects the element.
- Element views and their named `children` take an optional `category`: the slash menu shows each
  category as its own group, the same across extensions (trimmed, single-spaced, and
  case-insensitive), before the "Elements" group for elements without one.
- Root views receive `key`, their element's node ID, as templates do, e.g. for a `BlockArea` that
  drags the element itself.
- **Breaking:** inside a view, the editor's drag handle and block menu, a right click, and a box
  selection are for the top-level block only. `ContentSlot` takes `controls`, which opts its blocks
  in to all of them, e.g. a tab's paragraphs.
- `children` items have `handleTarget`: the editor's drag handle and block menu trigger, which are
  in the gutter for blocks in a view, are for that child, e.g. while it's hovered. The editor
  doesn't mark it; a view can, e.g. with an outline on the card.
- `children` items have a code block's `title`, e.g. for its tab label in a code group.
- View CSS styles the element's own content too, down to nested element views (`@scope` to
  `[data-element-view]`, not to the content slot), and `@container` rules are allowed. `ContentSlot`
  takes `contentClass`, utility classes on the content itself, and `class`, on the slot; `contents`
  on both makes the content's blocks items of the slot's parent, e.g. a grid with the view's own
  buttons.
- `BlockArea` marks a view's UI that stands for a block, e.g. a tab in a tab bar or a callout's
  icon, with separate options, off by default: `menu` (a right click opens the block's editor menu),
  `draggable` (the UI drags the block), `controls` (the drag handle and block menu while hovered),
  `selectable` (a box selection selects the block by the UI), and `marksSelection` (the view marks
  the block's selection with `blockSelected`, so the editor draws no shade).
- `children` items have `blockSelected`, for a block selection of the child itself (not of the
  element around it), e.g. to mark a hidden tab; `hasSelection` is now only for the text cursor or a
  text selection.
- Element views and their `children` take `accepts` (`{ elements?, blocks? }`): the blocks that the
  element's content accepts. The editor limits edits to them, marks elements with content that
  doesn't fit with a warning in the gutter, and cleans it up (wraps it into an accepted child, or
  moves it out).
- `<Block>` also returns `plain`: the editor draws those blocks without their own frame and
  background, e.g. code blocks in a code group. `class` props take up to 2,000 characters.
- Classes accept container variants (`@lg:…`) and arbitrary variants (`[&>*:first-child]:mt-0`).
- **Breaking:** element views list the child elements they draw in `children` (no `entry`), in place
  of `descendants` with their own views. `<Element tag>` templates inside a root view's
  `ContentSlot` draw them, with the root's state; root views receive `children` (their direct child
  blocks) and templates `{ element, props, index, key, children }`. `<Block type>` hides standard
  child blocks, e.g. code blocks.
- `append` also works on an empty self-closing element, e.g. `<CardGrid />` from MDX: the element
  gets content with the new child.
- Element views receive `index`: the element's position among its siblings with the same name.
- Element views and their descendants take `props`: Andesine edits the props in the element's menu
  (block menu and right-click), and the element's tag edits the same props. Right-clicking an
  element view selects the element. `Icon` takes `class`.
- `ContentSlot` takes `placeholder`, shown while the element's content is empty.
- `useEditor().append(block)` adds a block, as editor JSON, at the end of an element view's content,
  e.g. a card in a card grid or a code block in a code group, and moves the cursor into its text; an
  element without `content` gets an empty paragraph, unless `attrs.selfClosing`, and a block without
  text keeps the cursor where it was. The element's content rules apply. `Button` and `IconButton`
  take `class`. Props schemas have no `required`; clearing a prop restores its `default`.
- `openURL` also opens `http:` URLs of the member's machine (`localhost`, `*.localhost`,
  `127.0.0.1`, and `[::1]`), e.g. local development servers; they need confirmation.
- Add pages: views in the main content area, declared in `pages` (`workspace`, `collection`, or
  `entry` context) and opened from the sidebar, the collection and entry menus, or
  `openPage(id, context?)`; `highlightContext` marks the page's collection or entry as open in the
  explorer. Pages follow the layout of Andesine settings; add the `Section` and `SaveBar`
  components.
- Add `ImageInput`: choose or drop an image (PNG, JPEG, WebP, GIF, SVG, or ICO, up to 2 MB, set with
  `accept` and `maxSize`), with a preview of `value` (a declared HTTPS URL or an image data URL).
  The host checks the format and size; `onChange` gets `{ name, type, size, data }` with base64
  `data`, and `onRemove` clears it.
- `backend.fetch` waits up to 10 seconds for the extension context, so views that start before the
  host sends it (e.g. a panel restored on page load) no longer fail with "The extension has no
  backend".
- `ColorInput` opens a color picker (saturation and brightness area, hue slider, and hex input) and
  takes `presets`: up to 12 hex colors shown as swatches.
- New permission `publishable-keys`: the backend can create, update, and delete publishable keys for
  published content (see the SDK's extension API). It needs a backend, and members who approve it
  must be able to manage API keys. Managed keys stop while the extension is disabled or revoked;
  losing `publishable-keys` or `read:publishing`, or uninstalling, deletes them, and losing
  `ai-answers` removes it from them.
- Element views take `content` (insert the element with content, so its view can show a
  `ContentSlot`; defaults to true with descendants) and `props` (props of an element inserted from
  the slash menu, e.g. a required title).
- Element view descendants take `name`, `description`, and `icon`; with a `name`, the slash menu
  offers the descendant inside its root element's content (e.g. `Tab` inside `Tabs`). They also take
  `content` (defaults to true) and `props`.

## 0.7.0

- No changes; versioned with the other public Andesine packages.

## 0.6.0

- `Button` and `IconButton` take one `variant`: `primary`, `secondary`, `ghost`, `link`, or `danger`
  (`color` is removed). Buttons default to `secondary` and icon buttons to `ghost`. `Input` renders
  with the outlined look of Andesine's own fields.
- Remove `settingsSections` from the manifest: the host-rendered configuration form covers settings,
  and custom extension UI belongs in panels.
- Add `description` and `icon` to element views; Andesine shows them in the editor's slash menu and
  in the extension's settings.
- Block action views decide their UI: a view that renders nothing runs without UI (the block menu
  shows a spinner until it closes), and one root `Dialog` or `Menu` opens a modal or a menu where
  the block menu was.
- Add `Dialog` and `Menu` for any view. `Menu` is a dropdown menu with `MenuTrigger` (or a
  right-click area with `contextMenu`), `MenuItem` (with submenus and a `loading` spinner),
  `MenuGroup`, `MenuSeparator`, and custom `MenuContent` items. Outside block actions, a dialog
  needs a recent interaction.
- Add `notify(text, type?)`, a host action that shows a short notification.
- Block action edits accept elements as `{ type: "element", attrs: { name, props } }`; Andesine
  derives their tag.
- Fix block action and element view edits built from view props: `editor.replace`,
  `editor.insertAfter`, and `editor.setElementProps` now send plain JSON instead of store proxies,
  which could not be sent and stopped the extension.

## 0.5.0

- First release, versioned with `@andesine/sdk` and the `andesine` CLI.
- Add the root entry for `andesine.config.ts`: `defineExtension` (the manifest; a Zod
  `configuration` becomes its JSON Schema subset) and `defineBuild` (the frontend module and custom
  icon sets for `andesine extensions build`).
- Add `@andesine/extensions/solid`: the worker runtime for extension frontends (`startExtension`), a
  `solid-js/universal` renderer that sends serialized view patches to Andesine, and the host
  components: layout (`Stack`, `Grid`, `Box`, `Divider`, `ScrollArea`), text (`Text`, `Heading`,
  `Code`, `Link`, `Badge`, `Icon`), controls (`Button`, `IconButton`, `Input`, `Textarea`, `Select`,
  `Combobox`, `Checkbox`, `Toggle`, `ToggleGroup`, `ColorInput`, `Tooltip`), settings (`Setting`,
  `List`), and data display (`Card`, `Tree`, `Tabs`, `Tab`, `Disclosure`, `Callout`, `Steps`,
  `Step`, `Figure`, `CodeBlock`, `TimeAgo`, `Spinner`, `Skeleton`).
- Layout and text components (`Stack`, `Grid`, `Box`, `Text`, `Heading`) accept `class` with utility
  classes of the Andesine UnoCSS preset. Icons are icon classes (`i-lucide:rocket`; `?bg` for
  colored icons) from the default Lucide and Tabler sets, installed Iconify sets, or custom sets.
- Add `ContentSlot` for element views: it shows the element's editable content, which Andesine owns.
  Element views receive `{ element, props }` with the element name and its props.
- Add host actions: `copyText`, `downloadFile`, and `openURL`. They run shortly after a user
  interaction in the extension's view and reject with `ExtensionRequestError` (`code`) otherwise.
- Add `useEditor()` for views: block action views can `replace` the selected blocks, `insertAfter`
  them, and `close`; element views can `setElementProps`. Andesine validates each edit and applies
  it as the member's edit.
- Add `usePermissions()` and `hasPermission()` for the member's effective permissions, `apiFetch`
  and `EXTENSION_API_URL` to use the Andesine SDK from the frontend (requests go through Andesine
  with the member's session), and `backend.fetch` for the extension's own backend with a session
  token.
- Add `useConfiguration()` for the configuration's non-secret values, with defaults for unset
  fields. It updates when a manager saves the configuration.
- Add `storage` for the extension's JSON key-value storage, which its backend shares: `get`, `set`,
  `delete`, and `list` (in key order, with an optional prefix).
- `backend.fetch` also sends the `Andesine-Extension` and `Andesine-Instance` headers, which
  `verifySession` from `@andesine/sdk/extensions` needs. The backend's CORS configuration must allow
  them with `Authorization`.
