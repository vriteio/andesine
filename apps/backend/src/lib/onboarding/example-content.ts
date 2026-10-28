import { type SchemaDefinition } from "@andesine/contracts/schema";

interface ExampleEntry {
  mdx: string;
  published?: boolean;
}

const EXAMPLE_COLLECTION_NAME = "Getting started";
const createExampleSchema = (): SchemaDefinition => ({
  formatVersion: 1,
  fields: [
    {
      id: crypto.randomUUID(),
      kind: "property",
      label: "Topic",
      type: "select",
      defaultValue: "Basics",
      options: ["Basics", "Content", "Publishing", "Integrations"]
    },
    {
      id: crypto.randomUUID(),
      kind: "property",
      label: "Reading time",
      type: "number",
      defaultValue: "",
      options: []
    },
    {
      id: crypto.randomUUID(),
      kind: "property",
      label: "Featured",
      type: "checkbox",
      defaultValue: false,
      options: []
    },
    {
      id: crypto.randomUUID(),
      kind: "fragment",
      label: "Summary",
      allowedBlocks: [],
      defaultContent: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "A short summary for cards and search results." }]
        }
      ]
    }
  ]
});
// Entries link to guide entries created before them; the seed creates the list in reverse.
const createExampleEntries = (apiURL: string): ExampleEntry[] => [
  {
    published: true,
    mdx: `# Welcome to Andesine

<Property name="Topic" value="Basics" />

<Property name="Reading time" value={2} />

<Property name="Featured" value={true} />

<Fragment name="Summary">
What Andesine is, and how this guide helps you get started.
</Fragment>

Andesine is a **knowledge base** and a **headless CMS** in one place. Your team writes and organizes content here, and your sites, apps, and AI agents read it through the API, MCP, or Andesine Pages.

<Callout type="tip" title="This guide is yours">
Each entry of this collection also shows a feature of the editor. Edit it, move it, or delete it when you no longer need it.
</Callout>

## Your first steps

- [ ] Change some text in this entry. Changes save automatically.
- [ ] Publish an entry to the **Published** channel.
- [ ] Connect an AI agent, an app, or a Pages site.
- [ ] Invite a teammate.

The entries below show how to do each step.

## In this guide

<CardGrid>
<Card title="Write and organize" description="The editor, formatting, collections, and search." />
<Card title="Properties and schemas" description="Structured fields for the entries of a collection." />
<Card title="Publish your content" description="Drafts, versions, and channels." />
<Card title="Connect apps and agents" description="MCP, the API and SDK, Pages, and the CLI." />
</CardGrid>

| Entry | What you learn |
| --- | --- |
| [Write and organize](entry:/Getting%20started/Write%20and%20organize) | The editor, formatting, collections, and search |
| [Properties and schemas](entry:/Getting%20started/Properties%20and%20schemas) | Structured fields for the entries of a collection |
| [Publish your content](entry:/Getting%20started/Publish%20your%20content) | Drafts, versions, and channels |
| [Connect apps and agents](entry:/Getting%20started/Connect%20apps%20and%20agents) | MCP, the API and SDK, Pages, and the CLI |

---

This entry is already published, so the API, MCP, and Pages can read it now.
`
  },
  {
    mdx: `# Write and organize

<Property name="Topic" value="Content" />

<Property name="Reading time" value={4} />

<Fragment name="Summary">
Format text, add images and code, and organize entries in collections.
</Fragment>

Each entry is one document. Your team can edit the same entry at the same time, and you see the cursors of other people as they type.

## Formatting

The editor supports Markdown shortcuts as you type:

| Type | To get |
| --- | --- |
| \`#\`, \`##\`, or \`###\` and a space | A heading |
| \`-\` and a space | A bullet list |
| \`1.\` and a space | A numbered list |
| \`[ ]\` and a space | A task list |
| \`>\` and a space | A quote |
| Three backticks | A code block |
| \`---\` | A divider |

Text can be **bold**, *italic*, ~~struck through~~, \`inline code\`, or a [link](https://andesine.app).

## Images

Drop an image file or an image URL on the placeholder below to upload it. Images in a figure have a caption.

<Figure caption="Your first image: drop a file here">
![An image of your choice]()
</Figure>

## Code blocks

Code blocks have syntax highlighting, and they can have a title:

\`\`\`ts title="hello.ts"
const greet = (name: string) => \`Hello, \${name}!\`;

console.log(greet("Andesine"));
\`\`\`

## Organize

| Content type | Collection | Read by |
| --- | --- | --- |
| Product docs | Docs | Your docs site |
| Release notes | Changelog | Your app and newsletter |
| Team handbook | Handbook | Your team and AI agents |

1. Use the explorer in the side panel to create entries and collections.
2. Drag items in the explorer to move them, or to change their order.
3. Use search to find content in all collections.

<Callout type="note">
Collections can contain other collections, so you can make a tree for each product, team, or site.
</Callout>
`
  },
  {
    mdx: `# Properties and schemas

<Property name="Topic" value="Content" />

<Property name="Reading time" value={3} />

<Fragment name="Summary">
Add structured fields that sites and apps can show, sort, and filter.
</Fragment>

A schema adds structured fields to all entries of a collection. This collection has one: look at the **Topic**, **Reading time**, **Featured**, and **Summary** fields above this text.

Sites and apps read these fields through the API, together with the content, so you can show a topic, sort by reading time, or show a summary on cards.

## Field types

| Field | Type | Example value |
| --- | --- | --- |
| Status | Select | Draft, Review, Done |
| Author | Text | Alex |
| Published on | Date | 2026-11-02 |
| Tags | Multi-select | Setup, API |
| Summary | Fragment | A short rich-text block that a site shows on cards |

Properties can also be numbers, checkboxes, and URLs. Fragments are parts of the content with a name, which a site can show in other places.

## Change the schema

<Steps>
<Step title="Open the schema">
Open the menu of the **Getting started** collection in the explorer, and select **Edit schema**.
</Step>
<Step title="Edit the fields">
Add, rename, or remove properties and fragments.
</Step>
<Step title="Apply the schema">
Andesine migrates the existing entries to the new version.
</Step>
</Steps>

<Callout type="warning" title="Removed fields lose their values">
When you remove a field, the entries lose the values of that field. Andesine asks you to confirm first.
</Callout>
`
  },
  {
    mdx: `# Publish your content

<Property name="Topic" value="Publishing" />

<Property name="Reading time" value={3} />

<Fragment name="Summary">
Publish versions of entries to channels that sites, apps, and agents read.
</Fragment>

You edit a draft. Your sites, apps, and agents read published content only, so they don't see changes that aren't ready.

| | Draft | Published |
| --- | --- | --- |
| Who sees it | Your team, in the editor | Sites, apps, and agents |
| When it changes | As you type | When you publish |
| History | Versions are saved automatically | Each publish is a snapshot of the channel |

## Publish an entry

<Steps>
<Step title="Open the entry">
Open an entry that is ready, for example this one.
</Step>
<Step title="Open the publishing menu">
Open the publishing menu in the editor toolbar.
</Step>
<Step title="Select a channel">
Select the **Published** channel. Your next edits stay in the draft until you publish again.
</Step>
</Steps>

## Versions

Andesine saves versions of each entry. You can compare a version with the draft, restore it, or publish an older version.

## Channels

Each workspace has the **Published** channel. Add more channels for other stages or sites, for example:

- **Staging**: a preview site for reviews.
- **Docs**: the public documentation site.

<Callout type="note">
Publishing is turned on for each collection in its menu. It's already on for this collection.
</Callout>
`
  },
  {
    mdx: `# Connect apps and agents

<Property name="Topic" value="Integrations" />

<Property name="Reading time" value={5} />

<Property name="Featured" value={true} />

<Fragment name="Summary">
Read your content with AI agents, the API and SDK, a Pages site, or the CLI.
</Fragment>

Published content is available in many ways. Pick the one that fits what you build.

<Tabs>
<Tab label="AI agents (MCP)">
Add the Andesine MCP server as a custom connector in Claude, ChatGPT, Cursor, or another client, with this URL:

\`\`\`text title="MCP server URL"
${apiURL}/mcp
\`\`\`

Sign in, and select this workspace. Agents can then answer questions with your content, and, with write access, keep it up to date.
</Tab>
<Tab label="API and SDK">
Create an API key in **Settings → API**, and read published content:

\`\`\`bash title="Install"
npm install @andesine/sdk
\`\`\`

\`\`\`ts title="read-content.ts"
import { createClient } from "@andesine/sdk";

const client = createClient({
  baseURL: "${apiURL}",
  apiKey: process.env.ANDESINE_API_KEY
});
const tree = await client.content.getTree({ channel: "published" });
\`\`\`
</Tab>
<Tab label="Pages">
Install the Pages extension to host a documentation site for a collection, with search and AI answers. The site updates each time you publish.
</Tab>
<Tab label="CLI">
Read and write content from a terminal, a script, or CI:

\`\`\`bash title="Terminal"
npx andesine auth login
\`\`\`
</Tab>
</Tabs>

<Accordion title="Which option should I use?">
Use MCP for AI agents, the API and SDK for your own sites and apps, Pages for a hosted docs site, and the CLI for scripts. You can use all of them at the same time.
</Accordion>

<Callout type="tip">
Browsers use publishable keys, which can only read published content.
</Callout>
`
  }
];

export { EXAMPLE_COLLECTION_NAME, createExampleEntries, createExampleSchema };
export type { ExampleEntry };
