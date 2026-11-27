import type { WorkspaceEvent } from "../events";
import {
  visitorNameType,
  visitorType,
  shareAccessType,
  shareKindType,
  shareType,
  sharingPolicyType
} from "../entities/shares";
import { id, publicID } from "../primitives/id";
import { assetDetailsType } from "./schemas/assets";
import { pageInputType, paginationType } from "./schemas/pagination";
import {
  extensionActiveViewType,
  extensionConfigurationValuesType,
  extensionRuntimeType
} from "./schemas/extensions";
import { type } from "@orpc/contract";
import * as z from "zod";
import { authenticatedContract, baseContract, sessionContract } from "./base";

const expiresAtType = z.iso
  .datetime()
  .nullable()
  .describe("When the share expires, or null for never");
const listedShareType = shareType.extend({
  visitors: z.number().int().describe("Visitors who opened the share")
});
const sharedEntryType = z.object({
  share: shareType.pick({ access: true }),
  entry: z.object({ id: id(), name: z.string() }),
  workspace: z.object({ name: z.string(), logo: z.string().nullable() }),
  visitor: visitorType,
  members: z
    .array(z.object({ id: id(), name: z.string() }))
    .describe("Members who commented on the entry, for the comments' author names")
});
const joinedShareType = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("visitor"),
    token: z.string().describe("Visitor token, sent as a Bearer token")
  }),
  z.object({
    type: z.literal("member").describe("The account's workspace membership can read the entry"),
    workspaceID: id(),
    entryID: id()
  })
]);
const visitorContract = baseContract.meta({
  required: { visitor: true },
  requireWorkspace: false
});
const sharesContract = baseContract.router({
  list: authenticatedContract
    .route({
      summary: "List shares",
      description: "Lists the link and the email shares of an entry.",
      tags: ["shares"],
      method: "GET",
      path: "/entries/{entryID}/shares"
    })
    .meta({ example: { entryID: "ent_example" } })
    .meta({ required: { session: true, key: ["read:entries", "sharing"] } })
    .input(z.object({ entryID: id().describe("ID of the entry") }))
    .output(z.object({ data: z.array(listedShareType) })),
  listEntries: authenticatedContract
    .route({
      summary: "List shared entries",
      description:
        "Lists the entries that you can share and that have shares, by name, with their shares. Use pagination.nextCursor to continue with the same filters.",
      tags: ["shares"],
      method: "GET",
      path: "/shares"
    })
    .meta({ example: { kind: "link" } })
    .meta({ required: { session: true, key: ["read:entries", "sharing"] } })
    .input(
      pageInputType.extend({
        kind: shareKindType.optional().describe("Only entries with shares of this kind"),
        search: z
          .string()
          .trim()
          .max(200)
          .optional()
          .describe("Part of the entry name or of a shared email address")
      })
    )
    .output(
      z.object({
        data: z.array(
          z.object({
            id: id().describe("ID of the entry"),
            name: z.string(),
            shares: z.array(listedShareType)
          })
        ),
        pagination: paginationType
      })
    ),
  listVisitors: authenticatedContract
    .route({
      summary: "List identified visitors",
      description:
        "Lists the email addresses that the entries you can share are shared with, by address. Remove an address's shares with deleteMany to revoke its access.",
      tags: ["shares"],
      method: "GET",
      path: "/shares/visitors"
    })
    .meta({ example: {} })
    .meta({ required: { session: true, key: ["read:entries", "sharing"] } })
    .input(
      pageInputType.extend({
        cursor: z.string().max(320).optional().describe("Cursor from the previous page")
      })
    )
    .output(
      z.object({
        data: z.array(
          z.object({
            email: z.string(),
            entries: z.number().int().describe("Entries shared with the address"),
            shareIDs: z.array(id()).describe("IDs of the address's email shares")
          })
        ),
        pagination: paginationType.extend({ nextCursor: z.string().nullable() })
      })
    ),
  deleteMany: authenticatedContract
    .route({
      summary: "Remove shares",
      description: "Removes shares, e.g. all of an entry's. Their visitors lose access at once.",
      tags: ["shares"],
      method: "POST",
      path: "/shares/delete"
    })
    .meta({ example: { ids: ["shr_example"] } })
    .meta({ required: { session: true, key: ["read:entries", "sharing"] } })
    .input(z.object({ ids: z.array(id()).min(1).max(500).describe("IDs of the shares") }))
    .output(z.void()),
  getPolicy: sessionContract
    .route({ method: "GET", path: "/shares/policy" })
    .output(sharingPolicyType),
  updatePolicy: sessionContract
    .route({ method: "PATCH", path: "/shares/policy" })
    .meta({ required: { session: ["workspace"] } })
    .input(sharingPolicyType.partial())
    .output(sharingPolicyType),
  createLink: authenticatedContract
    .route({
      summary: "Create or reset the share link",
      description:
        "Creates the link share of an entry. When it exists, it is replaced by a new share with a new ID and token: the old link and its visitors stop working.",
      tags: ["shares"],
      method: "POST",
      path: "/entries/{entryID}/shares/link"
    })
    .meta({ example: { entryID: "ent_example", access: "comment" } })
    .meta({ required: { session: true, key: ["read:entries", "sharing"] } })
    .input(
      z.object({
        entryID: id().describe("ID of the entry"),
        access: shareAccessType,
        expiresAt: expiresAtType.default(null)
      })
    )
    .output(shareType),
  invite: authenticatedContract
    .route({
      summary: "Share an entry by email",
      description:
        "Shares an entry with one person and sends them an email. They sign in with the email address to open it.",
      tags: ["shares"],
      method: "POST",
      path: "/entries/{entryID}/shares"
    })
    .meta({ example: { entryID: "ent_example", email: "jane@example.com", access: "comment" } })
    .meta({ required: { session: true, key: ["read:entries", "sharing"] } })
    .input(
      z.object({
        entryID: id().describe("ID of the entry"),
        email: z.email().max(320).describe("Email address of the person"),
        access: shareAccessType,
        expiresAt: expiresAtType.default(null)
      })
    )
    .output(shareType),
  update: authenticatedContract
    .route({
      summary: "Update a share",
      tags: ["shares"],
      method: "PATCH",
      path: "/shares/{id}"
    })
    .meta({ example: { id: "shr_example", access: "view" } })
    .meta({ required: { session: true, key: ["read:entries", "sharing"] } })
    .input(
      z.object({
        id: id().describe("ID of the share"),
        access: shareAccessType.optional(),
        expiresAt: expiresAtType.optional()
      })
    )
    .output(shareType),
  join: baseContract
    .route({ method: "POST", path: "/shares/join" })
    .input(
      z.object({
        code: z.string().min(1).max(64).describe("Link token, or the ID of an email share")
      })
    )
    .output(joinedShareType),
  current: visitorContract
    .route({ method: "GET", path: "/shares/current" })
    .output(sharedEntryType),
  rename: visitorContract
    .route({ method: "PUT", path: "/shares/current/name" })
    .input(z.object({ name: visitorNameType.nullable() }))
    .output(visitorType),
  /** For element views; without backend or permissions. */
  extensions: visitorContract.route({ method: "GET", path: "/shares/current/extensions" }).output(
    z.object({
      runtime: z.array(extensionRuntimeType),
      activeViews: z.array(extensionActiveViewType),
      configurations: z
        .record(id(), extensionConfigurationValuesType)
        .describe("Non-secret configuration values by extension ID")
    })
  ),
  /** An image of the shared entry. */
  getAsset: visitorContract
    .route({ method: "GET", path: "/shares/current/assets/{assetID}" })
    .input(z.object({ assetID: publicID("ast") }))
    .output(assetDetailsType),
  /** Comment thread events of the shared entry. */
  events: visitorContract.output(type<AsyncGenerator<WorkspaceEvent, void, unknown>>())
});

export { sharesContract };
