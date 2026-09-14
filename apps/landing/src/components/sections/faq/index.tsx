import styles from "./styles.module.scss";
import { Section } from "../../shared/section";
import { Card } from "@andesine/components/primitives";
import { type Component, For } from "solid-js";
import clsx from "clsx";

interface FAQItem {
  question: string;
  answer: string;
}

// Cloud allowances match the backend billing defaults and billing settings.
const items: FAQItem[] = [
  {
    question: "Can I self-host Andesine?",
    answer:
      "Yes. Get the source on GitHub and run it on your infrastructure. The default setup includes Pro features. You manage hosting, storage, and connected services."
  },
  {
    question: "How do Free and Pro differ?",
    answer:
      "Free includes rich text editing, collections, schemas, and 1,000 API calls per month for individual use. Pro adds collaboration, access controls, priority support, and 500,000 monthly API calls for $12 USD per seat per month. Pricing applies to the cloud app."
  },
  {
    question: "What counts as a paid seat?",
    answer:
      "Every Pro workspace member counts, including the owner and read-only members. Invitations count after the person joins. Each workspace has a one-seat minimum."
  },
  {
    question: "Is the API allowance per workspace?",
    answer:
      "Yes, shared across all seats. It resets each calendar month in UTC: 1,000 calls on Free and 500,000 on Pro. Extra Pro calls cost $1 USD per 50,000. Free metered requests stop at the limit until reset or upgrade."
  },
  {
    question: "Does Free include AI answers?",
    answer:
      "Yes, with links to source documents. Each successful AI question counts toward your workspace’s monthly API allowance. For self-hosting, configure search and AI services."
  }
];

const FAQ: Component = () => (
  <Section
    sectionId="faq"
    id="faq-title"
    title="A few more answers."
    subtitle="Before you start writing."
  >
    <Card shade class="bg-white! p-0" data-entry="up">
      <For each={items}>
        {(item) => (
          <details
            name="landing-faq"
            class={clsx(styles.item, "border-b border-gray-200 last:border-b-0")}
          >
            <summary class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-6 py-5 text-base font-medium md:px-8">
              <span>{item.question}</span>
              <span
                aria-hidden="true"
                class={clsx(styles.indicator, "i-lucide:plus h-5 w-5 shrink-0")}
              />
            </summary>
            <div
              class={clsx(
                styles.answer,
                "px-6 pb-6 text-base leading-relaxed text-gray-500 md:px-8"
              )}
            >
              <p class="max-w-3xl">{item.answer}</p>
            </div>
          </details>
        )}
      </For>
    </Card>
  </Section>
);

export { FAQ };
