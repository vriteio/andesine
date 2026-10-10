# Andesine extension

An Andesine extension with a Solid frontend and a Node backend.

- `andesine.config.ts` — the manifest: name, permissions, backend, webhooks, configuration, and views.
- `andesine.keys.json` — the backend's public keys; `andesine extensions keys` maintains it.
- `src/frontend` — the views, rendered by Andesine in a sandbox; `index.tsx` exports every view that the manifest names.
- `src/backend` — the backend; it receives webhooks and verifies frontend sessions.

## Samples

Each frontend module shows one kind of contribution; remove the ones you do not need from the manifest and `index.tsx`.

- `note-view.tsx` — element views: `<Note>` with its editable content in `ContentSlot`, a tone switch that edits the element's props, and a `<NoteTitle>` descendant view.
- Block actions for paragraphs and headings; each view decides its UI: `shout-action.tsx` runs without UI (the block menu shows a spinner until it closes), `count-words-action.tsx` shows a `Menu` in the block menu's place with the count and “Insert below”, and `wrap-in-note-action.tsx` asks for the tone in a `Dialog`, then wraps the blocks in a `<Note>`.
- `hello-panel.tsx` — a right panel for the open entry: configuration, an API call with the member's granted permissions, a call to the backend, and a “More” `Menu` with a copy action and an “About” `Dialog`.
- `src/backend/server.ts` — lifecycle and `entry.created` webhooks, session verification, and the secret `apiToken` field, read with the extension's credentials.

## Local setup

Extensions are developed against a fully local Andesine stack; the hosted app has no development mode.

1. On the local stack, set `PUBLIC_EXTENSIONS_ENABLED=true` and `EXTENSIONS_DEVELOPMENT_ENABLED=true` for the backend and the web app. For webhooks to reach a backend on your machine, also allow local HTTP destinations: `WEBHOOK_ALLOW_HTTP=true` and a `WEBHOOK_DESTINATION_EXCEPTIONS` entry for the backend's origin.
2. Sign in the CLI to the local instance (API keys cannot develop extensions): `npx andesine --base-url http://localhost:3333 auth login`.
3. Start the backend with `npm run backend`, then `npm run dev`. Only you see and run the development extension; `npm run dev -- --remove` uninstalls it.

## Commands

- `npm run build` — validate the manifest and build the frontend, its CSS, and the artifact metadata into `dist/`.
- `npm run backend` — start the backend with the variables from `.env` (see `.env.example`).
- `npm run dev` — run the extension on a local Andesine instance for you, reloading it on each change; Ctrl+C stops it and keeps its state. It needs `andesine auth login` against the local instance, points the extension at the local backend (`--backend`, port 3000 as in `.env.example`), and writes a development key to `.env`.
- `npx andesine extensions test-event <webhook> <type>` — send a sample event to a webhook of the running development extension.
- `npx andesine extensions keys generate` — create a key pair; the private key never leaves your machine.
- `npx andesine extensions keys check` — compare the backend's private key with the manifest keys.
- `npx andesine extensions keys revoke <kid>` — stop listing a key; publish a new version afterwards.

Private keys stay in `.andesine/keys` and `.env`, which Git ignores.

Publish a version through a pull request to the extension registry.
