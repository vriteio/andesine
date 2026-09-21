// Generated from SDK openapi.json. Do not edit.
import type { operations, OperationInput } from "@andesine/sdk";
import type { SDKOperation } from "./types";

const bindings: Record<keyof operations, SDKOperation> = {
  "assets.attach": (client, input, options) =>
    client.assets.attach(input as OperationInput<"assets.attach">, options),
  "assets.get": (client, input, options) =>
    client.assets.get(input as OperationInput<"assets.get">, options),
  "assets.importURL": (client, input, options) =>
    client.assets.importURL(input as OperationInput<"assets.importURL">, options),
  "assets.register": (client, input, options) =>
    client.assets.register(input as OperationInput<"assets.register">, options),
  "assets.search": (client, input, options) =>
    client.assets.search(input as OperationInput<"assets.search">, options),
  "assets.upload": (client, input, options) =>
    client.assets.upload(input as OperationInput<"assets.upload">, options),
  "auth.getIdentity": (client, input, options) =>
    client.auth.getIdentity(input as OperationInput<"auth.getIdentity">, options),
  "collections.bulkDelete": (client, input, options) =>
    client.collections.bulkDelete(input as OperationInput<"collections.bulkDelete">, options),
  "collections.create": (client, input, options) =>
    client.collections.create(input as OperationInput<"collections.create">, options),
  "collections.delete": (client, input, options) =>
    client.collections.delete(input as OperationInput<"collections.delete">, options),
  "collections.list": (client, input, options) =>
    client.collections.list(input as OperationInput<"collections.list">, options),
  "collections.update": (client, input, options) =>
    client.collections.update(input as OperationInput<"collections.update">, options),
  "content.get": (client, input, options) =>
    client.content.get(input as OperationInput<"content.get">, options),
  "content.getAsset": (client, input, options) =>
    client.content.getAsset(input as OperationInput<"content.getAsset">, options),
  "content.getSchema": (client, input, options) =>
    client.content.getSchema(input as OperationInput<"content.getSchema">, options),
  "content.getTree": (client, input, options) =>
    client.content.getTree(input as OperationInput<"content.getTree">, options),
  "content.listCollections": (client, input, options) =>
    client.content.listCollections(input as OperationInput<"content.listCollections">, options),
  "content.listEntries": (client, input, options) =>
    client.content.listEntries(input as OperationInput<"content.listEntries">, options),
  "entries.bulkDelete": (client, input, options) =>
    client.entries.bulkDelete(input as OperationInput<"entries.bulkDelete">, options),
  "entries.create": (client, input, options) =>
    client.entries.create(input as OperationInput<"entries.create">, options),
  "entries.delete": (client, input, options) =>
    client.entries.delete(input as OperationInput<"entries.delete">, options),
  "entries.get": (client, input, options) =>
    client.entries.get(input as OperationInput<"entries.get">, options),
  "entries.list": (client, input, options) =>
    client.entries.list(input as OperationInput<"entries.list">, options),
  "entries.update": (client, input, options) =>
    client.entries.update(input as OperationInput<"entries.update">, options),
  "instance.get": (client, input, options) =>
    client.instance.get(input as OperationInput<"instance.get">, options),
  "memberships.invite": (client, input, options) =>
    client.memberships.invite(input as OperationInput<"memberships.invite">, options),
  "memberships.list": (client, input, options) =>
    client.memberships.list(input as OperationInput<"memberships.list">, options),
  "memberships.listInvites": (client, input, options) =>
    client.memberships.listInvites(input as OperationInput<"memberships.listInvites">, options),
  "memberships.remove": (client, input, options) =>
    client.memberships.remove(input as OperationInput<"memberships.remove">, options),
  "memberships.resendInvite": (client, input, options) =>
    client.memberships.resendInvite(input as OperationInput<"memberships.resendInvite">, options),
  "memberships.revokeInvite": (client, input, options) =>
    client.memberships.revokeInvite(input as OperationInput<"memberships.revokeInvite">, options),
  "memberships.update": (client, input, options) =>
    client.memberships.update(input as OperationInput<"memberships.update">, options),
  "publishing.bulkPublishCollections": (client, input, options) =>
    client.publishing.bulkPublishCollections(
      input as OperationInput<"publishing.bulkPublishCollections">,
      options
    ),
  "publishing.bulkPublishEntries": (client, input, options) =>
    client.publishing.bulkPublishEntries(
      input as OperationInput<"publishing.bulkPublishEntries">,
      options
    ),
  "publishing.bulkSetCollections": (client, input, options) =>
    client.publishing.bulkSetCollections(
      input as OperationInput<"publishing.bulkSetCollections">,
      options
    ),
  "publishing.bulkUnpublishCollections": (client, input, options) =>
    client.publishing.bulkUnpublishCollections(
      input as OperationInput<"publishing.bulkUnpublishCollections">,
      options
    ),
  "publishing.bulkUnpublishEntries": (client, input, options) =>
    client.publishing.bulkUnpublishEntries(
      input as OperationInput<"publishing.bulkUnpublishEntries">,
      options
    ),
  "publishing.createChannel": (client, input, options) =>
    client.publishing.createChannel(input as OperationInput<"publishing.createChannel">, options),
  "publishing.deleteChannel": (client, input, options) =>
    client.publishing.deleteChannel(input as OperationInput<"publishing.deleteChannel">, options),
  "publishing.getChannelContent": (client, input, options) =>
    client.publishing.getChannelContent(
      input as OperationInput<"publishing.getChannelContent">,
      options
    ),
  "publishing.getEntryVersion": (client, input, options) =>
    client.publishing.getEntryVersion(
      input as OperationInput<"publishing.getEntryVersion">,
      options
    ),
  "publishing.listChannels": (client, input, options) =>
    client.publishing.listChannels(input as OperationInput<"publishing.listChannels">, options),
  "publishing.listEntryPublications": (client, input, options) =>
    client.publishing.listEntryPublications(
      input as OperationInput<"publishing.listEntryPublications">,
      options
    ),
  "publishing.publishCollection": (client, input, options) =>
    client.publishing.publishCollection(
      input as OperationInput<"publishing.publishCollection">,
      options
    ),
  "publishing.publishEntry": (client, input, options) =>
    client.publishing.publishEntry(input as OperationInput<"publishing.publishEntry">, options),
  "publishing.revertChanges": (client, input, options) =>
    client.publishing.revertChanges(input as OperationInput<"publishing.revertChanges">, options),
  "publishing.setCollection": (client, input, options) =>
    client.publishing.setCollection(input as OperationInput<"publishing.setCollection">, options),
  "publishing.unpublishCollection": (client, input, options) =>
    client.publishing.unpublishCollection(
      input as OperationInput<"publishing.unpublishCollection">,
      options
    ),
  "publishing.unpublishEntry": (client, input, options) =>
    client.publishing.unpublishEntry(input as OperationInput<"publishing.unpublishEntry">, options),
  "roles.create": (client, input, options) =>
    client.roles.create(input as OperationInput<"roles.create">, options),
  "roles.delete": (client, input, options) =>
    client.roles.delete(input as OperationInput<"roles.delete">, options),
  "roles.list": (client, input, options) =>
    client.roles.list(input as OperationInput<"roles.list">, options),
  "roles.update": (client, input, options) =>
    client.roles.update(input as OperationInput<"roles.update">, options),
  "schemaMigrations.get": (client, input, options) =>
    client.schemaMigrations.get(input as OperationInput<"schemaMigrations.get">, options),
  "schemaMigrations.getActive": (client, input, options) =>
    client.schemaMigrations.getActive(
      input as OperationInput<"schemaMigrations.getActive">,
      options
    ),
  "schemaMigrations.listContentLossEntries": (client, input, options) =>
    client.schemaMigrations.listContentLossEntries(
      input as OperationInput<"schemaMigrations.listContentLossEntries">,
      options
    ),
  "schemas.apply": (client, input, options) =>
    client.schemas.apply(input as OperationInput<"schemas.apply">, options),
  "schemas.create": (client, input, options) =>
    client.schemas.create(input as OperationInput<"schemas.create">, options),
  "schemas.delete": (client, input, options) =>
    client.schemas.delete(input as OperationInput<"schemas.delete">, options),
  "schemas.get": (client, input, options) =>
    client.schemas.get(input as OperationInput<"schemas.get">, options),
  "schemas.getRevision": (client, input, options) =>
    client.schemas.getRevision(input as OperationInput<"schemas.getRevision">, options),
  "schemaVersions.get": (client, input, options) =>
    client.schemaVersions.get(input as OperationInput<"schemaVersions.get">, options),
  "schemaVersions.list": (client, input, options) =>
    client.schemaVersions.list(input as OperationInput<"schemaVersions.list">, options),
  "schemaVersions.revert": (client, input, options) =>
    client.schemaVersions.revert(input as OperationInput<"schemaVersions.revert">, options),
  "schemaVersions.update": (client, input, options) =>
    client.schemaVersions.update(input as OperationInput<"schemaVersions.update">, options),
  "search.askCurrent": (client, input, options) =>
    client.search.askCurrent(input as OperationInput<"search.askCurrent">, options),
  "search.askCurrentStream": (client, input, options) =>
    client.search.askCurrentStream(input as OperationInput<"search.askCurrentStream">, options),
  "search.askPublished": (client, input, options) =>
    client.search.askPublished(input as OperationInput<"search.askPublished">, options),
  "search.askPublishedStream": (client, input, options) =>
    client.search.askPublishedStream(input as OperationInput<"search.askPublishedStream">, options),
  "search.current": (client, input, options) =>
    client.search.current(input as OperationInput<"search.current">, options),
  "search.published": (client, input, options) =>
    client.search.published(input as OperationInput<"search.published">, options),
  "typeMetadata.getCurrent": (client, input, options) =>
    client.typeMetadata.getCurrent(input as OperationInput<"typeMetadata.getCurrent">, options),
  "typeMetadata.getPublished": (client, input, options) =>
    client.typeMetadata.getPublished(input as OperationInput<"typeMetadata.getPublished">, options),
  "versions.create": (client, input, options) =>
    client.versions.create(input as OperationInput<"versions.create">, options),
  "versions.get": (client, input, options) =>
    client.versions.get(input as OperationInput<"versions.get">, options),
  "versions.list": (client, input, options) =>
    client.versions.list(input as OperationInput<"versions.list">, options),
  "versions.revert": (client, input, options) =>
    client.versions.revert(input as OperationInput<"versions.revert">, options),
  "versions.update": (client, input, options) =>
    client.versions.update(input as OperationInput<"versions.update">, options),
  "workspaces.list": (client, input, options) =>
    client.workspaces.list(input as OperationInput<"workspaces.list">, options)
};
export { bindings };
