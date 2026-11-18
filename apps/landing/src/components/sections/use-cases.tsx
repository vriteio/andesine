import { CardsSection } from "../shared/cards-section";
import {
  AccessControlGraphic,
  AccessGraphic,
  CollaborationGraphic,
  ContentAPIGraphic,
  GitHubSyncGraphic,
  HistoryGraphic,
  HostedSiteGraphic,
  PublishingGraphic
} from "../shared/feature-graphics";
import { AnswerSourcesGraphic } from "../shared/feature-graphics/ai";
import {
  FragmentsGraphic,
  PropertyTypesGraphic,
  SchemaGraphic,
  SchemaTypesGraphic,
  SearchFilterGraphic
} from "../shared/feature-graphics/content-model";
import { WebhookGraphic } from "../shared/feature-graphics/developers";
import { RichBlocksGraphic, SlashMenuGraphic } from "../shared/feature-graphics/editor";
import { SiteSearchGraphic } from "../shared/feature-graphics/site";
import { type Component } from "solid-js";

const DocsWriting: Component = () => (
  <CardsSection
    id="docs-writing-title"
    title="Easy to write."
    subtitle="An editor everyone can use."
    cards={[
      {
        title: "Type, don't click.",
        text: "Markdown shortcuts and a slash menu for every block.",
        graphic: SlashMenuGraphic
      },
      {
        title: "Rich blocks.",
        text: "Tables, code, callouts, tabs, and more.",
        graphic: RichBlocksGraphic
      },
      {
        title: "Live editing.",
        text: "Write and review together, in real time.",
        graphic: CollaborationGraphic
      }
    ]}
  />
);
const DocsPublishing: Component = () => (
  <CardsSection
    id="docs-publishing-title"
    title="Published your way."
    subtitle="A site, your repo, or your app."
    cards={[
      {
        title: "Live in a click.",
        text: "Turn your docs into a site with search and AI answers.",
        graphic: HostedSiteGraphic
      },
      {
        title: "Sync with GitHub.",
        text: "Keep Markdown or MDX in your repo, in both directions.",
        graphic: GitHubSyncGraphic
      },
      {
        title: "Content API.",
        text: "Fetch your docs into any website or app.",
        graphic: ContentAPIGraphic
      }
    ]}
  />
);
const CmsStructure: Component = () => (
  <CardsSection
    id="cms-structure-title"
    title="Structured from the start."
    subtitle="Fields your apps can count on."
    cards={[
      {
        title: "Fields for anything.",
        text: "Text, numbers, dates, tags, and more.",
        graphic: PropertyTypesGraphic
      },
      {
        title: "One schema, every entry.",
        text: "Define fields once for a whole collection.",
        graphic: SchemaGraphic
      },
      {
        title: "More than one body.",
        text: "A summary, the main text, and any other part you need.",
        graphic: FragmentsGraphic
      }
    ]}
  />
);
const CmsDelivery: Component = () => (
  <CardsSection
    id="cms-delivery-title"
    title="Delivered anywhere."
    subtitle="Your content, in your stack."
    columns={2}
    cards={[
      {
        title: "Content API.",
        text: "Fetch entries and their fields into any site or app.",
        graphic: ContentAPIGraphic
      },
      {
        title: "Custom channels.",
        text: "Serve previews, releases, and apps their own versions.",
        graphic: PublishingGraphic
      },
      {
        title: "Ready for your code.",
        text: "Generate types from your schemas.",
        graphic: SchemaTypesGraphic
      },
      {
        title: "Webhooks.",
        text: "Rebuild your site when content goes live.",
        graphic: WebhookGraphic
      }
    ]}
  />
);
const KnowledgeSearch: Component = () => (
  <CardsSection
    id="knowledge-search-title"
    title="Find anything."
    subtitle="Answers, not hunting."
    cards={[
      {
        title: "Search as you type.",
        text: "Find any page in a few keystrokes.",
        graphic: SiteSearchGraphic
      },
      {
        title: "Answers with sources.",
        text: "Ask a question, and get an answer that links to its pages.",
        graphic: AnswerSourcesGraphic
      },
      {
        title: "Find by any field.",
        text: "Filter by status, team, or any other field.",
        graphic: SearchFilterGraphic
      }
    ]}
  />
);
const KnowledgeAccess: Component = () => (
  <CardsSection
    id="knowledge-access-title"
    title="You decide who sees what."
    subtitle="At any level, to any degree."
    cards={[
      {
        title: "Roles and groups.",
        text: "Give teams the access they need, and no more.",
        graphic: AccessGraphic
      },
      {
        title: "Restricted collections.",
        text: "Keep sensitive pages to the people who need them.",
        graphic: AccessControlGraphic
      },
      {
        title: "Every version saved.",
        text: "See who changed what, and restore any version.",
        graphic: HistoryGraphic
      }
    ]}
  />
);
const HubSync: Component = () => (
  <CardsSection
    id="hub-sync-title"
    title="Change it once."
    subtitle="Everything that reads it stays current."
    cards={[
      {
        title: "Answers with sources.",
        text: "Agents and people get the same answers, with links.",
        graphic: AnswerSourcesGraphic
      },
      {
        title: "Content API.",
        text: "Your apps read the same content as your agents.",
        graphic: ContentAPIGraphic
      },
      {
        title: "Webhooks.",
        text: "Tell every system when something changes.",
        graphic: WebhookGraphic
      }
    ]}
  />
);

export {
  DocsWriting,
  DocsPublishing,
  CmsStructure,
  CmsDelivery,
  KnowledgeSearch,
  KnowledgeAccess,
  HubSync
};
