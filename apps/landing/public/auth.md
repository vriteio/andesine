# Andesine auth.md

How AI agents and apps get access to an Andesine workspace. Agents act for a user who signs in; Andesine has no anonymous agent accounts. Agents never need a paid seat: their work counts as API calls and AI credits.

## MCP with OAuth (recommended for agents)

- MCP server: <https://api.andesine.app/mcp>, or `https://api.andesine.app/mcp/<workspace ID>` for one workspace.
- Protected resource metadata (RFC 9728): <https://api.andesine.app/.well-known/oauth-protected-resource/mcp>
- Authorization server: <https://api.andesine.app/auth>, with metadata at <https://api.andesine.app/.well-known/oauth-authorization-server/auth>
- Client registration: dynamic client registration (RFC 7591) at <https://api.andesine.app/auth/oauth2/register>, or an HTTPS client ID URL that points to a client metadata document.
- Scopes: `andesine:read`, `andesine:write`, and `offline_access` for refresh tokens.
- The user signs in, picks a workspace, and approves the access. Send the access token as `Authorization: Bearer <token>`.

## API keys (servers, scripts, and CI)

- A workspace member with the API keys permission creates a key in **Settings → API → Credentials**.
- Secret keys (`adn_...`) have the access that the member selects. Publishable keys (`adn_pk_...`) read published content only.
- Send the key as `Authorization: Bearer <key>` to `https://api.andesine.app`.

## CLI

The `andesine` CLI signs in with the OAuth device flow and then calls the API for the user.

## More

- [API overview](https://andesine.app/docs/developers/api-overview/)
- [Connect an AI app](https://andesine.app/docs/ai-agents/connect-an-ai-app/)
- [API catalog](https://andesine.app/.well-known/api-catalog)
