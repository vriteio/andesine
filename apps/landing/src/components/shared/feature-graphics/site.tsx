import styles from "./styles.module.scss";
import { Panel, Stage } from ".";
import { type Component, type ParentComponent } from "solid-js";
import clsx from "clsx";

interface CodeLineProps {
  number: number;
  indent?: boolean;
}

// Code lines as the app's code blocks show them: gray line numbers, then the code.
const CodeLine: ParentComponent<CodeLineProps> = (props) => (
  <div class="flex gap-3">
    <span class="w-3 shrink-0 text-right text-gray-400">{props.number}</span>
    <span class={clsx("whitespace-nowrap text-gray-700", props.indent && "pl-3")}>
      {props.children}
    </span>
  </div>
);
// The template's config file, in a code block with its file name and copy button.
const TemplateGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col rounded-b-none">
      <div class="flex items-center border-b border-gray-200 px-3 py-1.5 font-mono text-xs text-gray-500">
        andesine.config.ts
        <span class="i-lucide:copy ml-auto h-3.5 w-3.5 text-gray-400" />
      </div>
      <div class="flex flex-col gap-0.5 px-3 py-2 font-mono text-xs leading-relaxed">
        <CodeLine number={1}>
          <span class="text-red-600">export default</span>{" "}
          <span class="text-purple-600">defineConfig</span>({"{"}
        </CodeLine>
        <CodeLine number={2} indent>
          <span class="text-blue-600">name</span>: "Acme Docs",
        </CodeLine>
        <CodeLine number={3} indent>
          <span class="text-blue-600">logo</span>: {"{"} src: "./logo.svg" {"}"},
        </CodeLine>
        <CodeLine number={4} indent>
          <span class="text-blue-600">sections</span>: [guides, reference]
        </CodeLine>
        <CodeLine number={5}>{"});"}</CodeLine>
      </div>
    </Panel>
  </Stage>
);
// The search palette: matching pages with the query highlighted, then a question for AI.
const SiteSearchGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-1 rounded-b-none p-1.5 text-xs">
      <div class="flex items-center px-1.5 py-1 text-sm text-gray-700">
        domain
        <span class="i-lucide:list-filter-plus ml-auto h-4 w-4 text-gray-400" />
      </div>
      {[
        ["Custom domains", "Add a ", " to your site and point a CNAME…", true],
        ["Site settings", "Change the name, ", ", and template…", false]
      ].map(([title, before, after, selected]) => (
        <div class={clsx("flex gap-1.5 rounded-lg px-1.5 py-1", selected && "bg-gray-100")}>
          <span class="i-lucide:file-text mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span class="flex min-w-0 flex-col">
            <span class="font-medium text-gray-700">{title}</span>
            <span class="truncate text-gray-500">
              {before}
              <span class="text-tertiary">domain</span>
              {after}
            </span>
          </span>
        </div>
      ))}
      <div class={clsx(styles.fadeIn, "flex gap-1.5 px-1.5 py-1")}>
        <span class="i-lucide:sparkles mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span class="flex flex-col">
          <span class="font-medium text-gray-700">Tell me “domain”</span>
          <span class="text-gray-500">Ask a question…</span>
        </span>
      </div>
    </Panel>
  </Stage>
);
// The site header as a Pages site draws it, in the colors from the config.
const BrandGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col rounded-b-none text-xs">
      <div class="flex items-center gap-2 px-3 py-2">
        <span class="flex items-center gap-1 text-sm font-semibold text-gray-700">
          <span class="i-lucide:hexagon h-4 w-4 bg-gradient-to-tr" />
          Acme
        </span>
        <span class="flex flex-1 items-center gap-1 rounded-lg bg-gray-100 px-1.5 py-0.5 text-gray-400">
          <span class="i-lucide:search h-3 w-3" />
          Search
        </span>
        <span class="flex items-center gap-0.5 whitespace-nowrap rounded-lg bg-gradient-to-tr px-1.5 py-0.5 text-white">
          Open app
          <span class="i-lucide:arrow-up-right h-3 w-3" />
        </span>
      </div>
      <div class="flex gap-3 border-t border-gray-200 px-3 text-gray-500">
        <span class="relative flex items-center gap-1 py-1.5 text-tertiary">
          <span class="i-lucide:book-open h-3.5 w-3.5" />
          Guides
          <span class="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-tr" />
        </span>
        <span class="flex items-center gap-1 py-1.5">
          <span class="i-lucide:braces h-3.5 w-3.5" />
          API reference
        </span>
      </div>
      <div class="flex flex-1 gap-3 border-t border-gray-200 px-3 py-2">
        <div class="flex w-20 shrink-0 flex-col gap-1 text-gray-500">
          <span>Quickstart</span>
          <span class="rounded-md bg-gradient-to-r from-tertiary/10 to-transparent px-1 text-tertiary">
            Publishing
          </span>
          <span>Channels</span>
        </div>
        <span class="text-sm font-semibold text-gray-700">Publishing</span>
      </div>
    </Panel>
    <Panel
      late
      class="absolute bottom-4 right-4 flex items-center gap-2 px-2 py-1.5"
    >
      {["bg-primary", "bg-tertiary", "bg-secondary"].map((color) => (
        <span class={clsx(styles.pop, color, "h-3.5 w-3.5 rounded-full")} />
      ))}
    </Panel>
  </Stage>
);
// Domains as the Pages extension lists them: a status icon, the hostname, and its details.
const DomainGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-1 rounded-b-none p-1.5 text-xs">
      <div class="flex items-center gap-2 rounded-lg px-1.5 py-1">
        <span class="i-lucide:circle-check h-4 w-4 shrink-0 text-green-500" />
        <span class="flex flex-col">
          <span class="font-medium text-gray-700">docs.acme.com</span>
          <span class="text-gray-500">Active · Primary</span>
        </span>
        <span class="i-lucide:trash-2 ml-auto h-4 w-4 text-gray-400" />
      </div>
      <div class="flex items-center gap-2 rounded-lg px-1.5 py-1">
        <span class="i-lucide:clock h-4 w-4 shrink-0 text-tertiary" />
        <span class="flex flex-col">
          <span class="font-medium text-gray-700">help.acme.com</span>
          <span class="text-gray-500">Waiting for DNS</span>
        </span>
      </div>
      <div class="mx-1.5 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl bg-gray-50 px-2.5 py-1.5">
        <span class="text-gray-500">Type</span>
        <span class="text-gray-500">Value</span>
        <span class="text-gray-500">Status</span>
        <span class="font-mono text-gray-700">CNAME</span>
        <span class="font-mono text-gray-700">andesine.page</span>
        <span
          class={clsx(
            styles.pop,
            "flex items-center gap-0.5 rounded-md bg-green-500/10 px-1 text-green-600"
          )}
        >
          <span class="i-lucide:check h-3 w-3" />
          Found
        </span>
      </div>
    </Panel>
  </Stage>
);

export { TemplateGraphic, SiteSearchGraphic, BrandGraphic, DomainGraphic };
