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
      "Free is for up to 3 members, all admins, with 50,000 API calls and 5,000 AI credits per month. Pro costs $12 USD per seat per month and adds unlimited members, roles and groups, restricted collections, custom domains, and a larger shared allowance. Pricing applies to the cloud app."
  },
  {
    question: "What counts as a paid seat?",
    answer:
      "Every Pro workspace member counts, including the owner and read-only members. Invitations count after the person joins. Each workspace has a one-seat minimum. Agents never need a seat: their work counts as API calls and AI credits."
  },
  {
    question: "Is the allowance per workspace?",
    answer:
      "Yes. It resets each calendar month. On Pro, each seat adds 150,000 API calls and 15,000 AI credits to a pool shared across the workspace, about 1,500 AI answers per seat. Extra usage costs $1 USD per 50,000 API calls or 5,000 AI credits. Free stops at its limits until the reset or an upgrade."
  },
  {
    question: "Does Free include AI answers?",
    answer:
      "Yes, with links to source documents. AI uses credits: an answer costs 10 credits and a semantic search 1, so Free covers about 500 answers a month. For self-hosting, configure search and AI services."
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
