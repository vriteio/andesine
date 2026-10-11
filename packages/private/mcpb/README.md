# Andesine for Claude Desktop

A Claude Desktop extension (`.mcpb`) with the Andesine MCP server. Claude can search, read, edit, and publish the content of one Andesine workspace, and upload local images to entries.

## Install

1. Create a secret API key in the workspace's API settings. Its permissions limit what Claude can do; use a key with only read permissions for read access.
2. Open `andesine.mcpb` (from the GitHub release) and select **Install** in Claude Desktop.
3. Enter the API key. For a self-hosted instance, also enter its API URL.

## Build

```sh
pnpm --filter @andesine/mcpb build
```

The build bundles the server into `dist/server/index.js` and packs `andesine.mcpb`.

## Privacy Policy

The extension sends requests only to the Andesine API URL in its settings, with the API key from its settings. It sends the content that Claude reads or writes through its tools, and the local image files that Claude uploads with `upload_image`. It collects no other data and sends nothing to other services. Andesine processes this data as described in the [Andesine privacy policy](https://andesine.app/privacy).
