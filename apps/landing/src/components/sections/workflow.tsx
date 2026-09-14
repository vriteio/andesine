import { FeatureDescription, type FeatureContentProps } from "../shared/feature-description";
import { Card } from "@andesine/components/primitives";
import { type Component, For } from "solid-js";

interface WorkflowStep extends FeatureContentProps {
  screenshot: string;
  alt: string;
  width: number;
  height: number;
}

// Focused Chrome captures from the local Northstar workspace, cropped at 2× resolution.
const steps: WorkflowStep[] = [
  {
    title: "Write",
    text: "Write with your team in a rich-text editor.",
    screenshot: "workflow-write.png",
    alt: "Inline formatting toolbar above selected guide text",
    width: 800,
    height: 700
  },
  {
    title: "Structure",
    text: "Add fields and named sections. Reuse schemas across documents.",
    screenshot: "workflow-structure.png",
    alt: "Status property configuration with its API name and available options",
    width: 720,
    height: 760
  },
  {
    title: "Publish",
    text: "Deliver content through the API or sync files to GitHub.",
    screenshot: "workflow-publish.png",
    alt: "Publishing menu with Publish current and the Published channel",
    width: 680,
    height: 600
  }
];

const Workflow: Component = () => (
  <section aria-labelledby="workflow-title" class="mx-auto w-full max-w-5xl px-4 md:px-8">
    <h2 id="workflow-title" class="sr-only">
      From draft to published content
    </h2>
    <ol class="grid gap-8 md:grid-cols-3">
      <For each={steps}>
        {(step, index) => (
          <li class="min-w-0" data-entry="up" data-entry-delay={index() * 125}>
            <Card shade class="h-full overflow-hidden bg-white! p-0">
              <div class="pointer-events-none relative h-44 overflow-hidden rounded-xl [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)]">
                <img
                  src={`/_landing/screenshots/${step.screenshot}`}
                  alt={step.alt}
                  width={step.width}
                  height={step.height}
                  loading="lazy"
                  decoding="async"
                  class="absolute left-1/2 top-6 h-auto w-full max-w-xs rounded-xl -translate-x-1/2 -rotate-12"
                />
              </div>
              <div class="px-6 pb-6">
                <FeatureDescription
                  class="mt-2"
                  title={step.title}
                  text={step.text}
                  marker={
                    <span class="bg-gradient-to-tr bg-clip-text text-transparent text-sm font-semibold">
                      0{index() + 1}
                    </span>
                  }
                />
              </div>
            </Card>
          </li>
        )}
      </For>
    </ol>
  </section>
);

export { Workflow };
