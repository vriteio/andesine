# @andesine/sdk

The TypeScript client for the [Andesine](https://andesine.app) API. It works in Node.js 22 or
later, and in browsers and workers.

## Install

```sh
npm install @andesine/sdk
```

## Example

```ts
import { createClient } from "@andesine/sdk";

const client = createClient({ apiKey: process.env.ANDESINE_API_KEY });

const page = await client.content.get({ path: "/Docs/Quickstart", channel: "published" });
const results = await client.search.published({ query: "install", channel: "published" });
```

Keep secret API keys in server code. In browsers, use a publishable key (`adn_pk_...`), which can
only read and search published content.

## Documentation

- [SDK](https://andesine.app/docs/developers/sdk/)
- [API overview](https://andesine.app/docs/developers/api-overview/)
- [API reference](https://andesine.app/docs/api/)
- [Webhooks](https://andesine.app/docs/developers/webhooks/), and the
  [webhook receivers guide](WEBHOOKS.md) in this package

## License

MIT
