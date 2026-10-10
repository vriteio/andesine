import { defineBuild, defineExtension } from "@andesine/extensions";
import * as z from "zod";
// `andesine extensions keys generate` and `keys revoke` maintain this file.
import backendKeys from "./andesine.keys.json" with { type: "json" };

export default defineExtension({
  // Your registry name, e.g. `acme/publish`.
  name: "example/hello",
  version: "0.1.0",
  displayName: "Hello",
  description: "Samples of extension features: views, a panel, an action, settings, and a backend.",
  icon: "i-lucide:hand",
  apiVersion: 1,
  // The API permissions that members approve; the frontend gets them only where members have them.
  permissions: ["read:entries"],
  backend: {
    // The deployed src/backend (HTTPS only); `npm run dev` uses the local one (see package.json).
    url: "https://hello.example.com",
    keys: backendKeys.keys
  },
  webhooks: {
    lifecycle: { events: ["extension.installed", "extension.uninstalled"], path: "/webhooks" },
    entries: { events: ["entry.created"], path: "/webhooks" }
  },
  // Managers fill it in Settings → Extensions; secret fields reach only the backend.
  configuration: z.object({
    greeting: z.string().min(1).max(100).default("Hello").meta({ title: "Greeting" }),
    apiToken: z
      .string()
      .max(200)
      .optional()
      .meta({ title: "API token", description: "Only the backend reads it", secret: true })
  }),
  // Renders `<Note>` elements; `<NoteTitle>` inside a note uses its own view.
  elementViews: [
    {
      id: "note",
      name: "Note",
      // Shown in the editor's slash menu, under Elements.
      description: "A highlighted note with a title and a tone",
      icon: "i-lucide:sticky-note",
      element: "Note",
      entry: "NoteView",
      descendants: [{ element: "NoteTitle", entry: "NoteTitleView" }]
    }
  ],
  // Shown in the block menu of the listed block types; each view decides its own UI.
  blockActions: [
    {
      id: "shout",
      label: "Shout",
      icon: "i-lucide:megaphone",
      blocks: ["paragraph", "heading"],
      entry: "ShoutAction"
    },
    {
      id: "count-words",
      label: "Count words",
      icon: "i-lucide:hash",
      blocks: ["paragraph", "heading"],
      entry: "CountWordsAction"
    },
    {
      id: "wrap-in-note",
      label: "Wrap in Note",
      icon: "i-lucide:sticky-note",
      blocks: ["paragraph", "heading"],
      entry: "WrapInNoteAction"
    }
  ],
  panels: [
    {
      id: "hello",
      side: "right",
      name: "Hello",
      icon: "i-lucide:hand",
      context: "entry",
      entry: "HelloPanel"
    }
  ]
});

export const build = defineBuild({ frontend: "src/frontend/index.tsx" });
