import { FeatureDescription, type FeatureContentProps } from "./feature-description";
import { Card } from "@andesine/components/primitives";
import { type Component } from "solid-js";

interface FeatureCardProps extends FeatureContentProps {
  graphic: Component;
  entryDelay?: number;
}

const FeatureCard: Component<FeatureCardProps> = (props) => (
  <article class="h-full" data-entry="up" data-entry-delay={props.entryDelay}>
    <Card shade class="flex h-full flex-col overflow-hidden bg-white! p-0">
      <div class="px-2 pt-4">
        <props.graphic />
      </div>
      <div class="px-6 pb-6 pt-3">
        <FeatureDescription title={props.title} text={props.text} />
      </div>
    </Card>
  </article>
);

export { FeatureCard, type FeatureCardProps };
