import styles from "./styles.module.scss";
import { Panel, Stage } from ".";
import { type Component } from "solid-js";
import clsx from "clsx";

// The Andesine Pages panel as the app shows it, next to the open entry.
const ExtensionPanelGraphic: Component = () => (
  <Stage>
    <Panel class="absolute bottom-0 left-4 top-4 w-[42%] rounded-b-none px-3 py-2 text-xs">
      <span class="text-sm font-semibold text-gray-700">Quickstart</span>
      <p class="mt-1 leading-relaxed text-gray-500">
        Create a workspace and write your first entry.
      </p>
    </Panel>
    <div class="absolute bottom-0 right-3 top-4 flex w-[48%] flex-col gap-1.5 text-xs">
      <span class="flex gap-1.5 text-gray-400">
        <span class="i-lucide:history h-4 w-4" />
        <span class="i-mdi:github h-4 w-4" />
        <span class="rounded-md bg-tertiary/10 p-0.5 text-tertiary">
          <span class="i-lucide:globe block h-3 w-3" />
        </span>
      </span>
      <span class="text-sm font-semibold text-gray-700">Andesine Pages</span>
      {[
        ["i-lucide:circle-check text-green-500", "Latest build", "7 days ago · Live"],
        ["i-lucide:file-text text-gray-400", "This entry's page", "/quickstart/"]
      ].map(([icon, label, details], index) => (
        <span class="flex gap-1.5">
          <span class={clsx(icon, index === 0 && styles.pop, "mt-0.5 h-3.5 w-3.5 shrink-0")} />
          <span class="flex flex-col">
            <span class="text-gray-700">{label}</span>
            <span class="text-gray-400">{details}</span>
          </span>
        </span>
      ))}
      <span class="text-gray-400">Site</span>
      {[["i-lucide:layout-grid", "Overview"]].map(([icon, label]) => (
        <span class="flex items-center gap-1.5 text-gray-700">
          <span class={clsx(icon, "h-3.5 w-3.5 text-gray-400")} />
          {label}
        </span>
      ))}
    </div>
  </Stage>
);
// Element views from Andesine Pages: a callout and cards, drawn in the editor as the site shows them.
const ElementViewGraphic: Component = () => (
  <Stage>
    <div class="absolute inset-x-4 top-4 flex flex-col gap-2 text-xs">
      <Panel class="flex gap-2 px-3 py-2">
        <span class="i-lucide:lightbulb mt-0.5 h-3.5 w-3.5 shrink-0 text-tertiary" />
        <span class="flex flex-col gap-0.5">
          <span class="font-medium text-gray-900">This guide is yours</span>
          <span class="leading-relaxed text-gray-700">Edit it, move it, or delete it.</span>
        </span>
      </Panel>
      <div class="grid grid-cols-2 gap-2">
        {["Write and organize", "Properties and schemas"].map((title) => (
          <Panel late class="flex flex-col gap-1 px-3 py-2">
            <span class="truncate font-medium text-gray-900">{title}</span>
            <span class="text-gray-400">Card text</span>
          </Panel>
        ))}
      </div>
    </div>
  </Stage>
);
// The block menu, styled as the app's dropdown, with an action an extension added.
const ExtensionActionsGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 rounded-b-none px-3 py-2 text-sm text-gray-700">
      Search now finds pages as you type.
    </Panel>
    <Panel late class="absolute left-8 top-12 flex w-48 flex-col p-1 text-xs">
      {[
        ["i-lucide:copy", "Copy", "⌘C"],
        ["i-lucide:repeat-2", "Turn into", "›"]
      ].map(([icon, label, hint]) => (
        <span class="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-gray-700">
          <span class={clsx(icon, "h-3.5 w-3.5 text-gray-500")} />
          <span class="flex-1">{label}</span>
          <span class="font-mono opacity-50">{hint}</span>
        </span>
      ))}
      <span class="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-red-500">
        <span class="i-lucide:trash h-3.5 w-3.5" />
        Delete
      </span>
      <span class="mx-1.5 my-0.5 h-px bg-gray-200" />
      <span class="px-1.5 pb-0.5 text-gray-400">Translate</span>
      <span
        class={clsx(
          styles.fadeIn,
          "flex items-center gap-1.5 rounded-md bg-gray-100 px-1.5 py-1 text-gray-700"
        )}
      >
        <span class="i-lucide:languages h-3.5 w-3.5 text-gray-500" />
        Translate block
      </span>
    </Panel>
  </Stage>
);
// An extension's definition: its name, permissions, and the panel it adds.
const ExtensionCodeGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col rounded-b-none">
      <div class="flex items-center border-b border-gray-200 px-3 py-1.5 font-mono text-xs text-gray-500">
        extension.ts
        <span class="i-lucide:copy ml-auto h-3.5 w-3.5 text-gray-400" />
      </div>
      <div class="flex flex-col gap-0.5 px-3 py-2 font-mono text-xs leading-relaxed text-gray-700">
        {[
          <>
            <span class="text-red-600">export default</span>{" "}
            <span class="text-purple-600">defineExtension</span>({"{"}
          </>,
          <span class="pl-3">
            <span class="text-blue-600">name</span>: "acme/translate",
          </span>,
          <span class="pl-3">
            <span class="text-blue-600">permissions</span>: ["read:entries"],
          </span>,
          <span class="pl-3">
            <span class="text-blue-600">panels</span>: [translatePanel]
          </span>,
          <>{"});"}</>
        ].map((line, index) => (
          <div class="flex gap-3">
            <span class="w-3 shrink-0 text-right text-gray-400">{index + 1}</span>
            <span class="whitespace-nowrap">{line}</span>
          </div>
        ))}
      </div>
    </Panel>
  </Stage>
);

export { ExtensionPanelGraphic, ElementViewGraphic, ExtensionActionsGraphic, ExtensionCodeGraphic };
