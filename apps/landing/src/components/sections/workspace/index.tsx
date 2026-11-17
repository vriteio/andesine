import styles from "./styles.module.scss";
import { FeatureDescription } from "../../shared/feature-description";
import { Panel } from "../../shared/feature-graphics";
import { Section } from "../../shared/section";
import { type Component, For } from "solid-js";
import clsx from "clsx";

interface WorkspaceLabel {
  part: string;
  icon: string;
  title: string;
  text: string;
}

const labels: WorkspaceLabel[] = [
  {
    part: "properties",
    icon: "i-tabler:pyramid",
    title: "Properties & schemas.",
    text: "Give every entry fields your apps can trust."
  },
  {
    part: "elements",
    icon: "i-lucide:component",
    title: "Custom elements.",
    text: "Callouts, tabs, and your own components, edited in place."
  },
  {
    part: "extensions",
    icon: "i-tabler:puzzle",
    title: "Extensions.",
    text: "Add panels, element views, and tools for your team."
  }
];

// One document as the app shows it: schema properties, a custom element, and an extension panel.
const WorkspaceGraphic: Component = () => (
  <div
    aria-hidden="true"
    class="grid gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm md:grid-cols-[1fr_15rem] md:p-5"
    data-entry="up"
  >
    <Panel class="min-w-0 px-5 pb-5 pt-4 md:px-8">
      <div class="flex items-center gap-1.5 text-xs text-gray-400">
        Docs
        <span class="i-lucide:chevron-right h-3 w-3" />
        Guides
        <span class="ml-1 flex items-center gap-1 rounded-md border border-gray-200 px-1 text-gray-500">
          <span class="i-tabler:pyramid h-3 w-3" />
          Guide
        </span>
      </div>
      <div class="mt-2 text-2xl font-semibold text-gray-700">Publish your first site</div>
      <div data-part="properties" class={clsx(styles.part, "mt-3 flex flex-col gap-1.5")}>
        {[
          ["i-lucide:circle-chevron-down", "Status", "Ready"],
          ["i-lucide:calendar", "Last reviewed", "Nov 12, 2026"]
        ].map(([icon, name, value]) => (
          <div class="flex items-center">
            <span class="flex w-36 shrink-0 items-center gap-1.5 font-medium text-gray-500">
              <span class={clsx(icon, "h-4.5 w-4.5 text-gray-300")} />
              {name}
            </span>
            <span class="text-gray-700">{value}</span>
          </div>
        ))}
        <div class="flex items-center">
          <span class="flex w-36 shrink-0 items-center gap-1.5 font-medium text-gray-500">
            <span class="i-lucide:list-collapse h-4.5 w-4.5 text-gray-300" />
            Audience
          </span>
          <span class="flex gap-1">
            {["Writers", "Developers"].map((tag) => (
              <span class="rounded-lg bg-white px-1.5 py-0.5 text-xs font-medium text-gray-500 outline outline-1 outline-gray-200 shadow-sm">
                {tag}
              </span>
            ))}
          </span>
        </div>
      </div>
      <p class="mt-4 leading-relaxed text-gray-500">
        Create a site from any collection. It updates each time you publish.
      </p>
      <div data-part="elements" class={clsx(styles.part, "mt-3 flex flex-col gap-2")}>
        <div class="flex gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-gray-600">
          <span class="i-lucide:lightbulb h-4.5 w-4.5 shrink-0 text-tertiary" />
          Preview the site before you share its link.
        </div>
        <div class="overflow-hidden rounded-lg border border-gray-200">
          <div class="flex gap-3 border-b border-gray-200 px-2.5 pt-1.5 text-xs text-gray-500">
            <span class="relative pb-1.5 font-medium text-gray-700">
              npm
              <span class="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-tr" />
            </span>
            <span class="pb-1.5">pnpm</span>
          </div>
          <div class="px-2.5 py-2 font-mono text-xs text-gray-700">
            npx andesine pages init docs
          </div>
        </div>
      </div>
    </Panel>
    <Panel late class="flex flex-col gap-3 p-3">
      <div data-part="extensions" class={clsx(styles.part, "flex flex-col gap-3")}>
        <div class="flex items-center gap-1.5 font-medium text-gray-700">
          <span class="i-lucide:globe h-4.5 w-4.5 text-gray-400" />
          Site
          <span class="ml-auto flex items-center gap-1 text-xs font-normal text-gray-400">
            <span class="h-1.5 w-1.5 rounded-full bg-green-500" />
            Live
          </span>
        </div>
        <div class="flex flex-col gap-1 text-xs">
          <span class="text-gray-400">Domain</span>
          <span class="rounded-lg border border-gray-200 px-2 py-1 text-gray-700">
            docs.acme.page
          </span>
        </div>
        <div class="flex flex-col gap-1 text-xs">
          <span class="text-gray-400">Last build</span>
          <span class="text-gray-700">2 minutes ago</span>
        </div>
        <span class="rounded-lg bg-gradient-to-tr px-2 py-1 text-center text-xs font-medium text-white shadow-md shadow-tertiary/25">
          Publish site
        </span>
      </div>
      <div class="mt-auto flex flex-col gap-1 border-t border-gray-200 pt-2 text-xs text-gray-500">
        <span class="text-gray-400">Extensions</span>
        {["Andesine Pages", "GitHub Sync"].map((name) => (
          <span class="flex items-center gap-1.5">
            <span class="i-tabler:puzzle h-3.5 w-3.5 text-gray-400" />
            {name}
          </span>
        ))}
      </div>
    </Panel>
  </div>
);

const Workspace: Component = () => (
  <Section
    sectionId="workspace"
    id="workspace-title"
    title="Write like a doc. Structure like a database."
    subtitle="Properties, schemas, and custom elements in one editor."
    class={styles.workspace}
  >
    <WorkspaceGraphic />
    <div class="grid gap-6 md:grid-cols-3">
      <For each={labels}>
        {(label, index) => (
          <div data-label={label.part} data-entry="up" data-entry-delay={index() * 125}>
            <FeatureDescription
              title={label.title}
              text={label.text}
              marker={<span class={clsx(label.icon, "h-4 w-4 shrink-0 text-tertiary")} />}
            />
          </div>
        )}
      </For>
    </div>
  </Section>
);

export { Workspace };
