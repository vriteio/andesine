import { FeatureDescription } from "../shared/feature-description";
import { Screenshot, ScreenshotDots } from "../shared/screenshot";
import { Section } from "../shared/section";
import { type Component } from "solid-js";

const ContentStructure: Component = () => (
  <Section
    id="structure-title"
    title="Make it structurally yours."
    subtitle="Shape content for your product."
  >
    <div class="grid items-start gap-8 md:grid-cols-5 md:gap-12">
      <div class="w-full h-full relative md:col-span-3">
        <ScreenshotDots class="z-0" />
        {/* Capture reference: light-theme document properties and named content fragments. */}
        <Screenshot
          src="/_landing/screenshots/fragments-and-fields.png"
          label="Category, status, reading time, and a Summary fragment"
          width={840}
          height={560}
          fade
          class="h-full w-full md:relative md:col-span-3 md:min-h-0 md:self-stretch"
          imageClass="md:absolute md:inset-0 md:h-full md:w-full md:object-cover md:object-left-top"
        />
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
        {/* Planned for launch: verify custom-element syntax and support before publication. */}
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
