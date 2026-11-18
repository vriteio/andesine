import styles from "./styles.module.scss";
import { Panel, Stage } from ".";
import { type Component } from "solid-js";
import clsx from "clsx";

// The slash menu's elements group, with the callout selected and its description.
const SlashMenuGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 rounded-b-none px-3 py-2 text-sm text-gray-700">
      Add a tip for new readers
      <div class="text-gray-400">/</div>
    </Panel>
    <Panel late class="absolute left-8 top-16 flex w-40 flex-col p-1 text-xs text-gray-700">
      <span class="px-1.5 py-0.5 text-gray-400">Elements</span>
      {[
        ["i-lucide:info", "Callout"],
        ["i-lucide:square", "Card"],
        ["i-lucide:list-ordered", "Steps"],
        ["i-lucide:app-window", "Tabs"]
      ].map(([icon, label], index) => (
        <span
          class={clsx(
            "flex items-center gap-1.5 rounded-lg px-1.5 py-1",
            index === 0 && "bg-gray-100"
          )}
        >
          <span class={clsx(icon, "h-3.5 w-3.5 text-gray-500")} />
          {label}
        </span>
      ))}
    </Panel>
    <span
      class={clsx(
        styles.fadeIn,
        "absolute left-[11.5rem] top-[5.6rem] whitespace-nowrap rounded-md bg-gray-900 px-1.5 py-0.5 text-xs text-white"
      )}
    >
      A note or a tip
    </span>
  </Stage>
);
// A few of the blocks an entry can hold: a callout, a table, and code.
const RichBlocksGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-2 rounded-b-none p-3 text-xs">
      <div class="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-700">
        <span class="i-lucide:info h-3.5 w-3.5 shrink-0 text-tertiary" />
        Keys belong to one workspace.
      </div>
      <div class="grid grid-cols-2 overflow-hidden rounded-lg border border-gray-200 text-gray-700">
        <span class="border-b border-r border-gray-200 bg-gray-50 px-2 py-1 font-medium">Key</span>
        <span class="border-b border-gray-200 bg-gray-50 px-2 py-1 font-medium">Use</span>
        <span class="border-r border-gray-200 px-2 py-1 font-mono text-tertiary">adn_…</span>
        <span class="px-2 py-1">Servers and CI</span>
      </div>
      <div class={clsx(styles.fadeIn, "flex gap-3 font-mono")}>
        <span class="text-gray-400">1</span>
        <span class="text-gray-700">
          <span class="text-blue-600">curl</span> https://api.andesine.app
        </span>
      </div>
    </Panel>
  </Stage>
);
// A link to another entry, with the link menu the editor shows for it.
const LinkMenuGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 rounded-b-none px-3 py-2 text-sm leading-relaxed text-gray-700">
      Before you start, read the{" "}
      <span class="underline decoration-gray-400 underline-offset-2">publishing guide</span> and
      check your settings.
    </Panel>
    <Panel late class="absolute left-10 top-20 flex items-center gap-1 p-1 text-xs text-gray-700">
      <span class="i-lucide:file-text ml-1 h-3.5 w-3.5 text-gray-500" />
      <span class="pl-1 pr-2">Publishing guide</span>
      {["i-lucide:copy", "i-lucide:pencil"].map((icon) => (
        <span class="rounded-lg p-1 text-gray-500">
          <span class={clsx(icon, "block h-3.5 w-3.5")} />
        </span>
      ))}
    </Panel>
  </Stage>
);
// The editor keeps working without a connection and says where the changes are.
const OfflineGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-1 rounded-b-none px-3 py-2">
      <span class="text-sm font-semibold text-gray-700">Release notes</span>
      <p class="text-xs leading-relaxed text-gray-500">
        Search now finds matching pages as you type, and answers questions with links to their
        sources.
      </p>
      <span
        class={clsx(
          styles.fadeIn,
          "mt-auto flex items-center gap-1.5 self-end text-xs font-medium text-gray-500"
        )}
      >
        <span class="i-lucide:cloud-off h-3.5 w-3.5 text-amber-500" />
        Offline, saved on this device
      </span>
    </Panel>
  </Stage>
);

export { SlashMenuGraphic, RichBlocksGraphic, LinkMenuGraphic, OfflineGraphic };
