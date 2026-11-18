import { FeatureCard, type FeatureCardProps } from "../shared/feature-card";
import { CollaborationGraphic, HistoryGraphic } from "../shared/feature-graphics";
import {
  LinkMenuGraphic,
  OfflineGraphic,
  RichBlocksGraphic,
  SlashMenuGraphic
} from "../shared/feature-graphics/editor";
import { Section } from "../shared/section";
import { type Component, For } from "solid-js";

interface EditorCardsProps {
  id: string;
  title: string;
  subtitle: string;
  cards: FeatureCardProps[];
}

const writingCards: FeatureCardProps[] = [
  {
    title: "Type, don't click.",
    text: "Markdown shortcuts and a slash menu for every block.",
    graphic: SlashMenuGraphic
  },
  {
    title: "Rich blocks.",
    text: "Tables, code, images, callouts, tabs, and more.",
    graphic: RichBlocksGraphic
  },
  {
    title: "Connected docs.",
    text: "Link to other entries as you type.",
    graphic: LinkMenuGraphic
  }
];
const teamCards: FeatureCardProps[] = [
  {
    title: "Live editing.",
    text: "See every change as it happens.",
    graphic: CollaborationGraphic
  },
  {
    title: "Work offline.",
    text: "Keep writing without a connection. Changes sync when you're back.",
    graphic: OfflineGraphic
  },
  {
    title: "Every version saved.",
    text: "Compare, restore, or publish any earlier version.",
    graphic: HistoryGraphic
  }
];

const EditorCards: Component<EditorCardsProps> = (props) => (
  <Section id={props.id} title={props.title} subtitle={props.subtitle}>
    <div class="grid gap-4 md:grid-cols-3">
      <For each={props.cards}>
        {(card, index) => <FeatureCard {...card} entryDelay={index() * 125} />}
      </For>
    </div>
  </Section>
);
const EditorWriting: Component = () => (
  <EditorCards
    id="editor-writing-title"
    title="Write without friction."
    subtitle="Everything you expect from a modern editor."
    cards={writingCards}
  />
);
const EditorTeam: Component = () => (
  <EditorCards
    id="editor-team-title"
    title="Better together."
    subtitle="Your team and your agents, in one document."
    cards={teamCards}
  />
);

export { EditorWriting, EditorTeam };
