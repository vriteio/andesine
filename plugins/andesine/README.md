# Andesine plugin

Work with your Andesine knowledge base, headless CMS, and docs content from Claude Code or Cursor. The plugin adds the Andesine MCP server and a skill that tells the agent when to use the MCP tools, the Andesine CLI, or the SDK.

With it, the agent can search and read entries, create and edit them as MDX, upload local images, move and delete content, save and restore versions, and publish to your channels. Changes appear live for people editing the same entries, and the agent saves a version before its first edit of an entry.

## Requirements

- Node.js 20 or later.
- An Andesine account. Sign in once with `npx andesine auth login`, or set `ANDESINE_API_KEY`.
- A workspace for the project: run `npx andesine init --mcp` in the project, which saves it in `andesine.json`.

## Install

In Claude Code:

```text
/plugin install andesine --marketplace vriteio/andesine
```

In Cursor, install **Andesine** from the Cursor Marketplace.

## Data and privacy

The MCP server runs on your machine (`npx -y andesine mcp`) and sends requests only to your Andesine instance, with your CLI login or API key. It sends the content that the agent reads or writes and the local images that it uploads. See the [Andesine privacy policy](https://andesine.app/privacy).

## License

MIT
