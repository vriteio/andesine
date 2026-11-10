import { query } from "@solidjs/router";
import { client } from "#web/lib/api";

interface ExtensionQueryInput {
  extensionID: string;
  workspaceID: string;
}
interface ExtensionCatalogItemQueryInput {
  name: string;
  workspaceID: string;
}

// The workspace ID is part of the cache key so workspace switches never reuse the index.
const extensionActiveViewsQuery = query(async (_workspaceID: string) => {
  return client.extensions.listActiveViews();
}, "extension-active-views");

const extensionRuntimeQuery = query(async (_workspaceID: string) => {
  return client.extensions.listRuntime();
}, "extension-runtime");

// The workspace ID keys each settings query, so workspace switches never reuse settings.
const extensionsQuery = query(async (_workspaceID: string) => {
  return client.extensions.list();
}, "extensions");
const extensionQuery = query((input: ExtensionQueryInput) => {
  return client.extensions.get({ extensionID: input.extensionID });
}, "extension");
const extensionConfigurationQuery = query((input: ExtensionQueryInput) => {
  return client.extensions.getConfiguration({ extensionID: input.extensionID });
}, "extension-configuration");
const extensionElementViewsQuery = query((input: ExtensionQueryInput) => {
  return client.extensions.listElementViews({ extensionID: input.extensionID });
}, "extension-element-views");
const extensionWebhooksQuery = query((input: ExtensionQueryInput) => {
  return client.extensions.listWebhooks({ extensionID: input.extensionID });
}, "extension-webhooks");
const extensionCatalogQuery = query(async (_workspaceID: string) => {
  return client.extensions.listCatalog();
}, "extension-catalog");
const extensionCatalogItemQuery = query((input: ExtensionCatalogItemQueryInput) => {
  return client.extensions.getCatalogItem({ name: input.name });
}, "extension-catalog-item");

export {
  extensionActiveViewsQuery,
  extensionRuntimeQuery,
  extensionsQuery,
  extensionQuery,
  extensionConfigurationQuery,
  extensionElementViewsQuery,
  extensionWebhooksQuery,
  extensionCatalogQuery,
  extensionCatalogItemQuery
};
export type { ExtensionQueryInput };
