import { FeatureCard, type FeatureCardProps } from "./feature-card";
import { Section } from "./section";
import { type Component, For } from "solid-js";
import clsx from "clsx";

interface CardsSectionProps {
  id: string;
  title: string;
  subtitle: string;
  cards: FeatureCardProps[];
  columns?: 2 | 3;
}

// A section of feature cards, three per row or, for four cards, two.
const CardsSection: Component<CardsSectionProps> = (props) => (
  <Section id={props.id} title={props.title} subtitle={props.subtitle}>
    <div class={clsx("grid gap-4", props.columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
      <For each={props.cards}>
        {(card, index) => (
          <FeatureCard {...card} entryDelay={(index() % (props.columns ?? 3)) * 125} />
        )}
      </For>
    </div>
  </Section>
);

export { CardsSection };
