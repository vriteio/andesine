# Andesine CLI

Command-line tools for [Andesine](https://andesine.app): sign in, call the API, generate content
types, run the MCP server for AI agents, and create documentation sites and extensions. Requires
Node.js 22.12 or later.

## Install

```sh
npm install --save-dev andesine @andesine/sdk
npx andesine --help
```

## Example

```sh
npx andesine auth login
npx andesine init
npx andesine api content get-tree --channel published
npx andesine types generate
```

| Command                               | Does                                                     |
| ------------------------------------- | -------------------------------------------------------- |
| `andesine auth login`                 | Signs in through the browser                             |
| `andesine init`                       | Saves the workspace and type settings in `andesine.json` |
| `andesine api <resource> <operation>` | Runs any operation of the Andesine API                   |
| `andesine types generate`             | Generates TypeScript types from collection schemas       |
| `andesine mcp`                        | Runs the MCP server for coding agents                    |
| `andesine pages init`                 | Creates a documentation site from the Pages template     |
| `andesine extensions ...`             | Creates, builds, and tests extensions                    |

## Documentation

- [CLI](https://andesine.app/docs/developers/cli/)
- [Content types](https://andesine.app/docs/developers/content-types/)
- [Local MCP server and plugin](https://andesine.app/docs/ai-agents/local-server-and-plugin/)
- [Pages framework](https://andesine.app/docs/publishing/pages-framework/)
- [Build extensions](https://andesine.app/docs/extensions/build-extensions/)

## License

MIT
