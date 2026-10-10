# @andesine/extensions

Authoring tools for Andesine extensions. Extension frontends are Solid components
that run in a sandboxed worker. Andesine renders its own components from the
serialized view tree; extension code has no DOM access.

## Solid entry

Compile extension JSX for the universal renderer:

```js
// babel-preset-solid options
{ generate: "universal", moduleName: "@andesine/extensions/solid" }
```

Bundle for the `browser` export condition (Solid's `worker` condition selects its
non-reactive server build). Then register the views that the manifest names:

```tsx
import { createSignal } from "solid-js";
import { Button, Stack, Text, startExtension } from "@andesine/extensions/solid";

const Counter = () => {
  const [count, setCount] = createSignal(0);

  return (
    <Stack direction="row" gap="small">
      <Text>{count()}</Text>
      <Button onClick={() => setCount(count() + 1)}>Add</Button>
    </Stack>
  );
};

startExtension({ Counter });
```

Only the exported host components render. Props must be JSON values; functions
become callbacks that the host calls with plain values.

## Element views

An element view renders a document element (for example `<Accordion>`) and
receives `{ element, props }`. `ContentSlot` shows the element's editable
content; Andesine keeps that content when the slot is hidden. A view's CSS does
not apply inside its slot.

## Host actions

`copyText(text)`, `downloadFile(name, text, type?)`, and `openURL(url)` ask
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
