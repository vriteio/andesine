---
name: andesine
description: Work with Andesine workspace content (knowledge base, CMS, and docs entries and collections). Use when the user mentions Andesine, or asks to find, read, write, publish, or reorganize their docs or knowledge base content, or to use the Andesine CLI or SDK in code.
---

# Andesine

Andesine is a knowledge base, headless CMS, and docs platform. A workspace has a tree of collections that hold entries. Entries have a title, optional schema fields, and content; publishing copies them to channels that sites read.

## Use the MCP tools for content work

The `andesine` MCP server runs `npx -y andesine mcp`. Use its tools to find, read, and change content:

- Find: `search` (by meaning and keywords) and `get_tree` (collections and entries under a path).
- Read: `fetch` returns MDX with a `hash`, the linked entries, and the schema. Read the `andesine://guide/mdx` resource before you write MDX for the first time.
- Change: `edit_entry` with operations for changes to existing content; `write_entry` only for full rewrites; `create_entry`, `move`, and `delete`.
- Versions and publishing: `save_version`, `revert_version`, `publish`, and `unpublish`. Publish only when the user asks.
- Local images: `upload_image` uploads a file from this machine.

Address entries by ID (`ent_...`) or path (`/Collection/Entry`). When a tool fails, read the error and its hints, read the entry again, and retry.

If the server reports that no workspace is selected, run `npx andesine init --mcp` in the project (or `npx andesine auth login` first when the user isn't signed in).

## Use the CLI for operations without a tool

The CLI covers the whole public API. Use it for schemas, publishing channels, assets, webhooks, and bulk operations:

```sh
npx andesine api --help
npx andesine api entries bulk-update --help
npx andesine api publishing list-channels
```

Use `npx andesine types generate` to update the generated content types, and `npx andesine types generate --check` to check them in CI.

## Use the SDK in application code

When the user's code reads or writes Andesine content, use `@andesine/sdk`:

```ts
import { createClient } from "@andesine/sdk";

const client = createClient({ apiKey: process.env.ANDESINE_API_KEY });
const entry = await client.content.get({ path: "/Docs/Introduction", channel: "published" });
```

Sites read published content (`client.content.*`) with a publishable key. Keep secret keys on the server. Don't put keys in code or in project files; use environment variables.
