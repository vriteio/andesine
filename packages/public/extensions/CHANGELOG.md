# Changelog

## 0.6.0

- `Button` and `IconButton` take one `variant`: `primary`, `secondary`, `ghost`, `link`, or
  `danger` (`color` is removed). Buttons default to `secondary` and icon buttons to `ghost`.
  `Input` renders with the outlined look of Andesine's own fields.
- Remove `settingsSections` from the manifest: the host-rendered configuration form
  covers settings, and custom extension UI belongs in panels.
- Add `description` and `icon` to element views; Andesine shows them in the editor's
  slash menu and in the extension's settings.
- Block action views decide their UI: a view that renders nothing runs without UI
  (the block menu shows a spinner until it closes), and one root `Dialog` or
  `Menu` opens a modal or a menu where the block menu was.
- Add `Dialog` and `Menu` for any view. `Menu` is a dropdown menu with
  `MenuTrigger` (or a right-click area with `contextMenu`), `MenuItem` (with
  submenus and a `loading` spinner), `MenuGroup`, `MenuSeparator`, and custom
  `MenuContent` items. Outside block actions, a dialog needs a recent interaction.
- Add `notify(text, type?)`, a host action that shows a short notification.
- Block action edits accept elements as `{ type: "element", attrs: { name, props } }`;
  Andesine derives their tag.
- Fix block action and element view edits built from view props: `editor.replace`,
  `editor.insertAfter`, and `editor.setElementProps` now send plain JSON instead of
  store proxies, which could not be sent and stopped the extension.

## 0.5.0

- First release, versioned with `@andesine/sdk` and the `andesine` CLI.
- Add the root entry for `andesine.config.ts`: `defineExtension` (the manifest; a Zod
  `configuration` becomes its JSON Schema subset) and `defineBuild` (the frontend module
  and custom icon sets for `andesine extensions build`).
- Add `@andesine/extensions/solid`: the worker runtime for extension frontends
  (`startExtension`), a `solid-js/universal` renderer that sends serialized view
  patches to Andesine, and the host components: layout (`Stack`, `Grid`, `Box`,
  `Divider`, `ScrollArea`), text (`Text`, `Heading`, `Code`, `Link`, `Badge`,
  `Icon`), controls (`Button`, `IconButton`, `Input`, `Textarea`, `Select`,
  `Combobox`, `Checkbox`, `Toggle`, `ToggleGroup`, `ColorInput`, `Tooltip`),
  settings (`Setting`, `List`), and data display (`Card`, `Tree`, `Tabs`, `Tab`,
  `Disclosure`, `Callout`, `Steps`, `Step`, `Figure`, `CodeBlock`, `TimeAgo`,
  `Spinner`, `Skeleton`).
- Layout and text components (`Stack`, `Grid`, `Box`, `Text`, `Heading`) accept
  `class` with utility classes of the Andesine UnoCSS preset. Icons are icon
  classes (`i-lucide:rocket`; `?bg` for colored icons) from the default Lucide
  and Tabler sets, installed Iconify sets, or custom sets.
- Add `ContentSlot` for element views: it shows the element's editable content,
  which Andesine owns. Element views receive `{ element, props }` with the
  element name and its props.
- Add host actions: `copyText`, `downloadFile`, and `openURL`. They run shortly
  after a user interaction in the extension's view and reject with
  `ExtensionRequestError` (`code`) otherwise.
- Add `useEditor()` for views: block action views can `replace` the selected
  blocks, `insertAfter` them, and `close`; element views can `setElementProps`.
  Andesine validates each edit and applies it as the member's edit.
- Add `usePermissions()` and `hasPermission()` for the member's effective
  permissions, `apiFetch` and `EXTENSION_API_URL` to use the Andesine SDK from
  the frontend (requests go through Andesine with the member's session), and
  `backend.fetch` for the extension's own backend with a session token.
- Add `useConfiguration()` for the configuration's non-secret values, with
  defaults for unset fields. It updates when a manager saves the configuration.
- Add `storage` for the extension's JSON key-value storage, which its backend
  shares: `get`, `set`, `delete`, and `list` (in key order, with an optional
  prefix).
- `backend.fetch` also sends the `Andesine-Extension` and `Andesine-Instance`
  headers, which `verifySession` from `@andesine/sdk/extensions` needs. The
  backend's CORS configuration must allow them with `Authorization`.
