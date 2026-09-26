> [!IMPORTANT]
> This is a WIP branch for _Andesine_ (the v2 rewrite of Vrite). For the latest stable version of Vrite, please check out the [main branch](https://github.com/vriteio/andesine/tree/main)

<h4 align="center">
  <a href="https://docs.vrite.io">Usage Guide</a> |
  <a href="https://vrite.io">Website</a> |
  <a href="https://app.vrite.io">Vrite Cloud</a>
</h4>
<p align="center">
  <a href="https://github.com/vriteio/andesine/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/vriteio/andesine" alt="Vrite is available under the AGPL-3.0 license." />
  </a>
  <a href="https://discord.gg/yYqDWyKnqE">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=vriteio">
    <img src="https://img.shields.io/twitter/follow/vriteio.svg?label=Follow%20@vriteio" alt="Follow @vriteio" />
  </a>
</p>

Vrite is an open-source, collaborative space to create, manage, and deploy product documentation, technical blogs, and knowledge bases. It aims to provide a high-quality, integrated user and developer experience, with features like:

- **Built-in management dashboard** for managing content production and delivery using Kanban or List view;
- Modern **WYSIWYG** editing experience with support for **Markdown**, integrated **code editor**, code formatting and real-time collaboration;
- AI-powered **semantic search** for organizing and searching through your content base;
- Versitile **API** and **Extension System** for customizing your experience and delivering content to any frontend;
- **Open-source**, with options to both self-host and use [Vrite Cloud](https://app.vrite.io).

Learn more about all the features of Vrite and how to use them from the [official Usage Guide](https://docs.vrite.io).

## Server configuration

Set `BILLING_ENABLED=true` or `BILLING_ENABLED=false` in the backend, worker, and usage reporter.
All three deployments must use the same value. A missing or invalid value stops startup.
Use a shared deployment variable where possible. With billing disabled, all Pro features remain
available and the reporter skips usage reporting.

| Application    | Stripe settings required when billing is enabled                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend        | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_SEAT_PRICE_ID`, `STRIPE_PRO_API_CALL_PRICE_ID`, `STRIPE_PRO_API_CALL_METER_EVENT_NAME` |
| Worker         | None                                                                                                                                             |
| Usage reporter | `STRIPE_SECRET_KEY`, `STRIPE_PRO_API_CALL_METER_EVENT_NAME`                                                                                      |

The reporter always requires `DATABASE_URL`. It does not require backend host, authentication,
email, Redis, or search configuration. Match its database, Stripe account, and meter event name
to the backend. Match `VERSION_RETENTION_DAYS` and `PRO_VERSION_RETENTION_DAYS` between backend
and worker; both version cleanup and webhook recording use these durations. See [.env.example](.env.example)
for the other settings.

Before deploying this refactor, set the explicit billing mode on all three applications. Stripe
credentials no longer select the mode. Existing deployments without this variable will fail startup.

## Links

- 🔥 [**Try out Vrite**](https://app.vrite.io)
- ℹ️ [**Usage guide**](https://docs.vrite.io)
- 🚀 [**Blog**](https://vrite.io/blog)
- 📝 [**Report a bug**](https://github.com/vriteio/andesine/issues)
- 🙋‍♀️ [**Request a feature**](https://github.com/vriteio/andesine/discussions)
- 💬 [**Join Discord**](https://discord.gg/yYqDWyKnqE)
- 🐦 [**Follow on Twitter**](https://twitter.com/vriteio)
- 💼 [**Follow on LinkedIn**](https://www.linkedin.com/company/vrite)
