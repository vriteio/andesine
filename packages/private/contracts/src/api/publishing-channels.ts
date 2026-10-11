import { publishingSnapshotErrors } from "./errors";
import { id, publicID } from "../primitives/id";
import { publishingChannelCodeType, publishingChannelNameType } from "../publishing/channel";
import * as z from "zod";
import { collectionSelectorShape, hasCollectionSelector } from "./schemas/paths";
import { authenticatedContract } from "./base";
import {
  channelContentType,
  publishingChannelListItemType,
  publishingChannelType
} from "./schemas/publishing";

const publishingChannelsContract = {
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
      z
        .object({
          channel: publishingChannelCodeType,
          ...collectionSelectorShape,
          collectionID: id().optional().describe("Publishing root collection whose content to list")
        })
        .refine(hasCollectionSelector, {
          message: "Use exactly one collectionID, collectionPath, or collectionSlugPath"
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
  updateChannel: authenticatedContract
    .route({
      summary: "Rename a publishing channel",
      description:
        "Changes the display name of a publishing channel. The channel code, which content reads and webhooks use, doesn't change.",
      tags: ["publishing"],
      method: "PUT",
      path: "/channels/{code}"
    })
    .meta({ example: { code: "preview", name: "Staging" } })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      z.object({
        code: publishingChannelCodeType.describe("Code of the channel to rename"),
        name: publishingChannelNameType.describe("New publishing channel label")
      })
    )
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
};

export { publishingChannelsContract };
