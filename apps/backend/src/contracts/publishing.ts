import { contentNameErrors } from "./errors";
import { schemaHashType } from "#backend/lib/schema/contract/recorded";
import { contentReadErrors, contentDeliveryErrors, contentPublicationErrors } from "./errors";
import { MAX_BULK_ITEMS } from "#backend/lib/api/limits";
import { publishingSnapshotErrors, schemaMigrationErrors } from "./errors";
import { versionDetailsType } from "#backend/lib/data/entry-version";
import { id, publicID } from "#backend/lib/primitives";
import {
  publishingChannelCodeType,
  publishingChannelNameType
} from "#backend/lib/publishing/channel";
import * as z from "zod";
import { authenticatedContract, baseContract } from "./base";
import { publishedEntriesResultType, unpublishedEntriesResultType } from "./schemas/publishing";

import {
  channelContentType,
  channelInput,
  publishingMutationInput,
  expectedSnapshotsType,
  entryPublicationType,
  publishEntryTargetType,
  publishingChannelListItemType,
  publishingChannelType,
  revertPublishingChangesInputType,
  revertPublishingChangesResultType
} from "./schemas/publishing";

const publishingContract = baseContract.prefix("/publishing").router({
  setCollection: authenticatedContract
    .errors(contentPublicationErrors)
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Configure collection publishing",
      description:
        "Enables publishing for a collection, or disables it and unpublishes its tree from all channels. When enabling, publish can also publish the latest entry versions.",
      tags: ["publishing"],
      method: "PUT",
      path: "/collections/{collectionID}"
    })
    .meta({ example: { collectionID: "coll_example", enabled: true, publish: false } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      z.object({
        collectionID: id().describe("Collection to configure"),
        expectedSnapshots: expectedSnapshotsType,
        enabled: z
          .boolean()
          .describe(
            "Enable publishing, or disable and unpublish the collection tree from all channels"
          ),
        publish: z
          .boolean()
          .optional()
          .describe("Whether to publish latest entry versions when enabling publishing")
      })
    )
    .output(publishedEntriesResultType),
  bulkSetCollections: authenticatedContract
    .errors(contentPublicationErrors)
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Configure publishing for collections",
      description:
        "Enables publishing for the selected collections, or disables it and unpublishes their trees from all channels. When enabling, publish can also publish the latest entry versions.",
      tags: ["publishing"],
      method: "POST",
      path: "/collections/bulk/set"
    })
    .meta({ example: { ids: ["coll_example"], enabled: true, publish: false } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      z.object({
        ids: z
          .array(id())
          .min(1)
          .max(MAX_BULK_ITEMS)
          .describe("IDs of the collections to configure"),
        expectedSnapshots: expectedSnapshotsType,
        enabled: z
          .boolean()
          .describe(
            "Enable publishing, or disable and unpublish the collection trees from all channels"
          ),
        publish: z
          .boolean()
          .optional()
          .describe("Whether to publish latest entry versions when enabling publishing")
      })
    )
    .output(publishedEntriesResultType),
  publishCollection: authenticatedContract
    .errors(contentPublicationErrors)
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Publish a collection tree",
      description:
        "Publishes the latest entry versions in a publishing-enabled collection tree to the channel. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.",
      tags: ["publishing"],
      method: "POST",
      path: "/collections/{collectionID}"
    })
    .meta({ example: { collectionID: "coll_example", channel: "published" } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      publishingMutationInput.extend({
        collectionID: id().describe("Collection tree to publish")
      })
    )
    .output(publishedEntriesResultType),
  bulkPublishCollections: authenticatedContract
    .errors(contentPublicationErrors)
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Publish collection trees",
      description:
        "Publishes the latest entry versions in the selected publishing-enabled collection trees. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.",
      tags: ["publishing"],
      method: "POST",
      path: "/collections/bulk/publish"
    })
    .meta({ example: { ids: ["coll_example"], channel: "published" } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      publishingMutationInput.extend({
        ids: z
          .array(id())
          .min(1)
          .max(MAX_BULK_ITEMS)
          .describe("IDs of the collection trees to publish")
      })
    )
    .output(publishedEntriesResultType),
  unpublishCollection: authenticatedContract
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Unpublish a collection tree",
      description:
        "Removes publication assignments for a collection tree from the channel. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.",
      tags: ["publishing"],
      method: "DELETE",
      path: "/collections/{collectionID}"
    })
    .meta({ example: { collectionID: "coll_example", channel: "published" } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      publishingMutationInput.extend({
        collectionID: id().describe("Collection tree to unpublish")
      })
    )
    .output(unpublishedEntriesResultType),
  bulkUnpublishCollections: authenticatedContract
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Unpublish collection trees",
      description:
        "Removes publication assignments for the selected collection trees from the channel. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.",
      tags: ["publishing"],
      method: "POST",
      path: "/collections/bulk/unpublish"
    })
    .meta({ example: { ids: ["coll_example"], channel: "published" } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      publishingMutationInput.extend({
        ids: z
          .array(id())
          .min(1)
          .max(MAX_BULK_ITEMS)
          .describe("IDs of the collection trees to unpublish")
      })
    )
    .output(unpublishedEntriesResultType),
  publishEntry: authenticatedContract
    .errors(contentPublicationErrors)
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Publish an entry",
      description:
        "Publishes an existing version, or the latest entry content if versionID is omitted. The entry must be in a publishing-enabled collection. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.",
      tags: ["publishing"],
      method: "POST",
      path: "/entries/{entryID}"
    })
    .meta({ example: { entryID: "ent_example", channel: "published" } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      publishingMutationInput.extend({
        entryID: id().describe("Entry to publish"),
        versionID: id().optional().describe("Existing version to publish")
      })
    )
    .output(z.void()),
  bulkPublishEntries: authenticatedContract
    .errors(contentPublicationErrors)
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Publish entries",
      description:
        "Publishes the selected entries with optional version IDs. Entries must be in publishing-enabled collections. At least one entry is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.",
      tags: ["publishing"],
      method: "POST",
      path: "/entries/bulk/publish"
    })
    .meta({ example: { entries: [{ entryID: "ent_example" }], channel: "published" } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      publishingMutationInput.extend({
        entries: z
          .array(publishEntryTargetType)
          .min(1)
          .max(MAX_BULK_ITEMS)
          .describe("Entries and versions to publish")
      })
    )
    .output(z.void()),
  unpublishEntry: authenticatedContract
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Unpublish an entry",
      description:
        "Removes the entry publication from the channel. Supply versionID to require that version to be assigned; a changed assignment returns a conflict. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.",
      tags: ["publishing"],
      method: "DELETE",
      path: "/entries/{entryID}"
    })
    .meta({ example: { entryID: "ent_example", channel: "published", versionID: "ver_example" } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      publishingMutationInput.extend({
        entryID: id().describe("Entry to unpublish"),
        versionID: id().optional().describe("Version expected to be assigned")
      })
    )
    .output(z.void()),
  bulkUnpublishEntries: authenticatedContract
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Unpublish entries",
      description:
        "Removes publication assignments for the selected entries from the channel. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.",
      tags: ["publishing"],
      method: "POST",
      path: "/entries/bulk/unpublish"
    })
    .meta({ example: { ids: ["ent_example"], channel: "published" } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      publishingMutationInput.extend({
        ids: z.array(id()).min(1).max(MAX_BULK_ITEMS).describe("IDs of the entries to unpublish")
      })
    )
    .output(z.void()),
  revertChanges: authenticatedContract
    .errors(contentNameErrors)
    .errors(contentDeliveryErrors)
    .errors(publishingSnapshotErrors)
    .errors(schemaMigrationErrors)
    .route({
      summary: "Revert pending publishing changes",
      description:
        "Restores selected drafts to the reviewed publication snapshot. This can remove unpublished items and replace draft content. First review publishing.getChannelContent and pass its snapshotID. Use all: true or specific collectionIDs/entryIDs, never both. Requires write access to affected resources in addition to read:publishing.",
      tags: ["publishing"],
      method: "POST",
      path: "/changes/revert"
    })
    .meta({
      example: {
        collectionID: "coll_example",
        snapshotID: "snp_example",
        entryIDs: ["ent_example"],
        channel: "published"
      }
    })
    .meta({ required: { session: true, key: ["read:publishing"] } })
    .input(revertPublishingChangesInputType)
    .output(revertPublishingChangesResultType),
  getEntryVersion: authenticatedContract
    .errors(contentReadErrors)
    .route({
      summary: "Get a published entry version",
      description:
        "Returns the entry version assigned to a channel, or to an explicit available snapshot, with its recorded schema metadata. Validates content against that revision. expectedSchemaHash must match it; schema-less content cannot match it. The default channel is published.",
      tags: ["publishing"],
      method: "GET",
      path: "/entries/{entryID}/version"
    })
    .meta({ example: { entryID: "ent_example", channel: "published" } })
    .meta({ required: { session: true, key: ["read:publishing"] } })
    .input(
      channelInput.extend({
        entryID: id().describe("Entry whose published version to get"),
        expectedSchemaHash: schemaHashType.optional(),
        snapshotID: publicID("snp").optional().describe("Exact publication snapshot to read")
      })
    )
    .output(versionDetailsType),
  listEntryPublications: authenticatedContract
    .route({
      summary: "List entry publications",
      description: "Returns the entry publication assignments across channels.",
      tags: ["publishing"],
      method: "GET",
      path: "/entries/{entryID}/publications"
    })
    .meta({ example: { entryID: "ent_example" } })
    .meta({ required: { session: true, key: ["read:publishing"] } })
    .input(z.object({ entryID: id().describe("Entry whose publications to list") }))
    .output(z.array(entryPublicationType)),
  listChannels: authenticatedContract
    .route({
      summary: "List publishing channels",
      description:
        "Returns workspace publishing channels. Set includeAssignmentCount to include entry assignment counts.",
      tags: ["publishing"],
      method: "GET",
      path: "/channels"
    })
    .meta({ example: { includeAssignmentCount: true } })
    .meta({ required: { session: true, key: ["read:publishing"] } })
    .input(
      z.object({
        includeAssignmentCount: z
          .boolean()
          .optional()
          .describe("Whether to include the number of assigned entries")
      })
    )
    .output(z.array(publishingChannelListItemType)),
  getChannelContent: authenticatedContract
    .route({
      summary: "Get channel content and pending changes",
      description:
        "Returns publication state and pending changes for a publishing root, with the snapshot ID needed to review and revert changes.",
      tags: ["publishing"],
      method: "GET",
      path: "/channels/{channel}/content"
    })
    .meta({ example: { channel: "published", collectionID: "coll_example" } })
    .meta({ required: { session: true, key: ["read:publishing"] } })
    .input(
      z.object({
        channel: publishingChannelCodeType,
        collectionID: id().describe("Publishing root collection whose content to list")
      })
    )
    .output(channelContentType),
  createChannel: authenticatedContract
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Create a publishing channel",
      description:
        "Creates a publishing channel from its display name and returns the generated channel code.",
      tags: ["publishing"],
      method: "POST",
      path: "/channels"
    })
    .meta({ example: { name: "Preview" } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(z.object({ name: publishingChannelNameType.describe("Publishing channel label") }))
    .output(publishingChannelType),
  deleteChannel: authenticatedContract
    .errors(publishingSnapshotErrors)
    .route({
      summary: "Delete a publishing channel",
      description:
        "Deletes a custom channel and its publication assignments. The default published channel cannot be deleted.",
      tags: ["publishing"],
      method: "DELETE",
      path: "/channels/{code}"
    })
    .meta({ example: { code: "preview" } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      z.object({
        code: publishingChannelCodeType.describe("Publishing channel identifier"),
        expectedSnapshotID: publicID("snp")
          .optional()
          .describe("Reject deletion if the channel snapshot changed")
      })
    )
    .output(z.void())
});

export { publishingContract };
