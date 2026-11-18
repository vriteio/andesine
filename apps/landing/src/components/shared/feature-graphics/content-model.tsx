import styles from "./styles.module.scss";
import { Panel, Stage } from ".";
import { type Component } from "solid-js";
import clsx from "clsx";

// The explorer tree: nested collections with their entries, one of them open.
const ExplorerGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-0.5 rounded-b-none p-2 text-xs text-gray-700">
      {[
        ["i-lucide:folder-open", "Documentation", 0, false],
        ["i-lucide:folder-open", "Getting started", 1, false],
        ["i-lucide:file-text", "Quickstart", 2, false],
        ["i-lucide:file-text", "Core concepts", 2, true],
        ["i-lucide:folder", "Product updates", 1, false],
        ["i-lucide:folder", "Guides", 1, false]
      ].map(([icon, label, depth, active]) => (
        <span
          class={clsx(
            "flex items-center gap-1.5 rounded-lg py-0.5 pr-1.5",
            active && "bg-gradient-to-r from-tertiary/10 to-transparent text-tertiary"
          )}
          style={{ "padding-left": `${0.375 + Number(depth) * 0.875}rem` }}
        >
          <span class={clsx(icon, "h-3.5 w-3.5 shrink-0", active ? "" : "text-gray-400")} />
          {label}
        </span>
      ))}
    </Panel>
  </Stage>
);
// The property menu, with its types and the select type picked.
const PropertyTypesGraphic: Component = () => (
  <Stage>
    <Panel class="absolute left-4 top-4 flex w-40 flex-col gap-1 p-2 text-xs">
      <span class="text-gray-400">Property name</span>
      <span class="rounded-lg bg-gray-100 px-2 py-1 text-gray-700">Status</span>
    </Panel>
    <Panel
      late
      class="absolute bottom-0 right-4 top-10 flex w-36 flex-col rounded-b-none p-1 text-xs text-gray-700"
    >
      {[
        ["i-lucide:type", "Text"],
        ["i-lucide:hash", "Number"],
        ["i-lucide:circle-chevron-down", "Select"],
        ["i-lucide:list-checks", "Multi-select"],
        ["i-lucide:calendar", "Date"],
        ["i-lucide:square-check", "Checkbox"]
      ].map(([icon, label]) => (
        <span
          class={clsx(
            "flex items-center gap-1.5 rounded-lg px-1.5 py-1",
            label === "Select" && "bg-gray-100"
          )}
        >
          <span class={clsx(icon, "h-3.5 w-3.5 text-gray-400")} />
          {label}
          {label === "Select" && (
            <span class={clsx(styles.pop, "i-lucide:check ml-auto h-3.5 w-3.5 text-tertiary")} />
          )}
        </span>
      ))}
    </Panel>
  </Stage>
);
// An entry split into named content areas, as the editor labels them.
const FragmentsGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-1.5 rounded-b-none px-3 py-2 text-xs">
      {[
        ["Summary", "Faster search, with answers that link to their sources."],
        ["Content", "Search now finds matching pages as you type."]
      ].map(([label, text]) => (
        <>
          <span class="flex items-center gap-1.5 text-gray-500">
            <span class="i-lucide:letter-text h-3.5 w-3.5 text-gray-300" />
            {label}
            <span class="h-px flex-1 bg-gray-200" />
          </span>
          <p class="leading-relaxed text-gray-700">{text}</p>
        </>
      ))}
    </Panel>
  </Stage>
);
// A collection's schema, with its properties and the action that applies it.
const SchemaGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-2 rounded-b-none px-3 py-2 text-xs">
      <div class="flex items-center gap-1.5 whitespace-nowrap text-gray-500">
        Changelog
        <span class="text-gray-300">/</span>
        <span class="text-gray-700">Schema</span>
        <span
          class={clsx(
            styles.pop,
            "ml-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1.5 py-0.5 text-gray-700 shadow-sm"
          )}
        >
          <span class="i-tabler:pyramid h-3.5 w-3.5 text-gray-400" />
          Save & apply
        </span>
      </div>
      {[
        ["i-lucide:text", "Category", "Product"],
        ["i-lucide:circle-chevron-down", "Status", "Draft"],
        ["i-lucide:calendar", "Released", "Nov 12"]
      ].map(([icon, name, value]) => (
        <div class="flex items-center">
          <span class="flex w-24 shrink-0 items-center gap-1.5 text-gray-500">
            <span class={clsx(icon, "h-3.5 w-3.5 text-gray-300")} />
            {name}
          </span>
          <span class="text-gray-700">{value}</span>
        </div>
      ))}
    </Panel>
  </Stage>
);
// The search palette with a property filter applied to the results.
const SearchFilterGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-1 rounded-b-none p-1.5 text-xs">
      <div class="flex items-center gap-1.5 px-1.5 py-1 text-sm text-gray-700">
        release
        <span class="i-lucide:list-filter-plus ml-auto h-4 w-4 text-gray-400" />
      </div>
      <span
        class={clsx(
          styles.pop,
          "mx-1.5 flex items-center gap-1 self-start rounded-lg bg-white px-1.5 py-0.5 text-gray-700 shadow-sm outline outline-1 outline-gray-200"
        )}
      >
        <span class="i-lucide:circle-chevron-down h-3.5 w-3.5 text-gray-400" />
        Status is Ready
      </span>
      {["Faster search", "New API keys"].map((title, index) => (
        <div class={clsx("flex gap-1.5 rounded-lg px-1.5 py-1", index === 0 && "bg-gray-100")}>
          <span class="i-lucide:file-text mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span class="flex flex-col">
            <span class="font-medium text-gray-700">{title}</span>
            <span class="text-gray-500">Product updates · Ready</span>
          </span>
        </div>
      ))}
    </Panel>
  </Stage>
);
// Types generated from a schema, in a code block.
const SchemaTypesGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col rounded-b-none">
      <div class="flex items-center border-b border-gray-200 px-3 py-1.5 font-mono text-xs text-gray-500">
        andesine.d.ts
        <span class="i-lucide:copy ml-auto h-3.5 w-3.5 text-gray-400" />
      </div>
      <div class="flex flex-col gap-0.5 px-3 py-2 font-mono text-xs leading-relaxed text-gray-700">
        {[
          <>
            <span class="text-red-600">interface</span>{" "}
            <span class="text-purple-600">ProductUpdate</span> {"{"}
          </>,
          <span class="pl-3">
            <span class="text-blue-600">category</span>: string;
          </span>,
          <span class="pl-3">
            <span class="text-blue-600">status</span>: "Draft" | "Ready";
          </span>,
          <span class="pl-3">
            <span class="text-blue-600">released</span>: Date;
          </span>,
          <>{"}"}</>
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

export {
  ExplorerGraphic,
  PropertyTypesGraphic,
  FragmentsGraphic,
  SchemaGraphic,
  SearchFilterGraphic,
  SchemaTypesGraphic
};
