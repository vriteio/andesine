import { FeatureCard, type FeatureCardProps } from "../shared/feature-card";
import { CollaborationGraphic, AccessGraphic, AgentGraphic } from "../shared/feature-graphics";
import { Section } from "../shared/section";
import { type Component, For } from "solid-js";

const teamFeatures: FeatureCardProps[] = [
  {
    title: "Write together.",
    text: "Edit the same document in real time.",
    graphic: CollaborationGraphic
  },
  {
    title: "Your team. Your rules.",
    text: "Invite people. Set roles, groups, and collection access.",
    graphic: AccessGraphic
  },
  {
    // Planned for launch: verify MCP and agent integration before publishing.
    title: "Connect your agents.",
    text: "Connect AI tools to your workspace through MCP.",
    graphic: AgentGraphic
  }
];

const TeamSection: Component = () => (
  <Section
    sectionId="team"
    id="team-title"
    title="Connect & collaborate."
    subtitle="Write together. Control access."
    class="relative isolate"
  >
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <For each={teamFeatures}>
        {(feature, index) => <FeatureCard {...feature} entryDelay={index() * 125} />}
      </For>
    </div>
  </Section>
);

export { TeamSection };
