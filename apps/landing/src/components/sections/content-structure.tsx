import { FeatureDescription } from "../shared/feature-description";
import { Panel } from "../shared/feature-graphics";
import motion from "../shared/feature-graphics/styles.module.scss";
import { ScreenshotDots } from "../shared/screenshot";
import { Section } from "../shared/section";
import { type Component, type ParentComponent } from "solid-js";
import clsx from "clsx";

interface FragmentProps {
  name: string;
}

const properties = [
  ["i-lucide:text", "Category", "Documentation"],
  ["i-lucide:circle-chevron-down", "Status", "Ready"],
  ["i-lucide:calendar", "Release date", "Nov 9, 2026"],
  ["i-lucide:hash", "Reading time", "4"]
];
const statusOptions = ["Draft", "In review", "Ready"];

const Fragment: ParentComponent<FragmentProps> = (props) => (
  <div class="mt-4">
    <div class="flex items-center gap-2 text-gray-400">
      <span class="i-lucide:letter-text h-4 w-4" />
      {props.name}
      <span class="h-px flex-1 bg-gray-200" />
    </div>
    <div class="mt-2 leading-relaxed text-gray-700">{props.children}</div>
  </div>
);
// An entry with schema fields, and the settings of one of its properties.
const StructureGraphic: Component = () => (
  <div aria-hidden="true" class="relative z-1 pb-16 text-sm md:pb-20 md:pr-12" data-entry="up">
    <Panel class="p-5 md:p-6">
      <div class="flex items-center gap-1.5 text-gray-400">
        Docs
        <span class="i-lucide:chevron-right h-3.5 w-3.5" />
        Changelog
      </div>
      <div class="mt-2 text-xl font-semibold text-gray-700">Version 2.0</div>
      <div class="mt-4 flex items-center gap-2 text-gray-400">
        Properties
        <span class="h-px flex-1 bg-gray-200" />
      </div>
      <div class="mt-2 flex flex-col gap-2">
        {properties.map(([icon, name, value]) => (
          <div class="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center">
            <span class="flex items-center gap-2 text-gray-500">
              <span class={clsx(icon, "h-4 w-4 shrink-0 text-gray-400")} />
              {name}
            </span>
            <span
              class={clsx(
                name === "Status" && "relative w-max rounded-md px-1 -mx-1",
                "text-gray-700"
              )}
            >
              {value}
              {name === "Status" && (
                <span
                  class={clsx(motion.pop, "absolute -inset-px rounded-md border border-tertiary")}
                />
              )}
            </span>
          </div>
        ))}
      </div>
      <Fragment name="Summary">
        Faster search, AI answers with sources, and a new publishing panel.
      </Fragment>
      <Fragment name="Content">
        <span class="font-semibold">What's new</span>
        <span class="block text-gray-500">
          Search now finds content by meaning, not only by words.
        </span>
      </Fragment>
    </Panel>
    <Panel late class="absolute bottom-0 right-0 w-60 p-3 md:w-64">
      <div class="flex items-center gap-2 font-medium text-gray-700">
        <span class="i-lucide:circle-chevron-down h-4 w-4 text-gray-400" />
        Status
        <span class="ml-auto rounded-md border border-gray-200 px-1.5 text-xs text-gray-500">
          Select
        </span>
      </div>
      <div class="mt-2 text-xs text-gray-400">Options</div>
      <div class="mt-1 flex flex-wrap gap-1">
        {statusOptions.map((option) => (
          <span
            class={clsx(
              "rounded-md px-1.5 py-0.5 text-xs",
              option === "Ready"
                ? clsx(motion.pop, "bg-gradient-to-tr text-white")
                : "bg-gray-100 text-gray-600"
            )}
          >
            {option}
          </span>
        ))}
      </div>
      <div class="mt-2 flex items-center justify-between text-xs text-gray-500">
        Required
        <span class="flex h-4 w-7 items-center justify-end rounded-full bg-gradient-to-tr p-0.5">
          <span class="h-3 w-3 rounded-full bg-white" />
        </span>
      </div>
    </Panel>
  </div>
);

const ContentStructure: Component = () => (
  <Section
    id="structure-title"
    title="Make it structurally yours."
    subtitle="Shape content for your product."
  >
    <div class="grid items-start gap-8 md:grid-cols-5 md:gap-12">
      <div class="relative w-full md:col-span-3">
        <ScreenshotDots class="z-0" />
        <StructureGraphic />
      </div>
      <div class="flex flex-col gap-8 md:col-span-2">
        <div data-entry="up">
          <FeatureDescription
            title="Properties & fragments."
            text="Add status, category, and date properties. Split rich text into named fragments, such as a summary or body. Read each part through the API."
            marker={<span class="i-lucide:list-tree h-4 w-4 shrink-0 text-tertiary" />}
          />
        </div>
        <div data-entry="up" data-entry-delay="125">
          <FeatureDescription
            title="Shared schemas."
            text="Define properties and fragments once. Apply a schema to a collection to keep its documents consistent."
            marker={<span class="i-lucide:network h-4 w-4 shrink-0 text-tertiary" />}
          />
        </div>
        <div data-entry="up" data-entry-delay="250">
          <FeatureDescription
            title="Custom elements."
            text="Add custom elements and attributes with JSX/XML-like syntax, ready for your content transformers."
            marker={<span class="i-lucide:code-xml h-4 w-4 shrink-0 text-tertiary" />}
          />
        </div>
      </div>
    </div>
  </Section>
);

export { ContentStructure };
