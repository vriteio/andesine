import { publishingChannels, type DatabaseClient } from "@andesine/server/database";
import {
  createWebhookScopeAccess,
  loadWebhookScopeIndex
} from "@andesine/server/webhooks/recording";
import { type WebhookConfiguration } from "@andesine/contracts/webhooks";
import { loadAuthorizedCollectionTree } from "#backend/lib/policy/authorized-collection-tree";
import { hasAuthPermission } from "#backend/lib/policy/permissions";
import type { SessionData } from "#backend/lib/policy/session";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import {
  assertWebhookManageAccess,
  canReadWebhookResource,
  getWebhookRequiredPermissions
} from "./permissions";

interface WebhookAuthorityInput {
  auth: SessionData;
  database: DatabaseClient;
  configuration: WebhookConfiguration;
  // Stored configurations may reference deleted roots and channels kept for history.
  retained?: boolean;
}

const assertChannelsExist = async (
  database: DatabaseClient,
  workspaceID: string,
  codes: string[]
): Promise<void> => {
  const channels = await database
    .select({ code: publishingChannels.code })
    .from(publishingChannels)
    .where(
      and(
        eq(publishingChannels.workspaceID, toUUID(workspaceID)),
        isNull(publishingChannels.deletedAt)
      )
    );
  const available = new Set(channels.map(({ code }) => code));

  if (!codes.every((code) => available.has(code))) {
    throw new ORPCError("BAD_REQUEST", {
      message: "The webhook scope includes an unavailable publishing channel"
    });
  }
};
// The stored scope is independent of its creator, so every manager who saves, enables,
// tests, replays, or redirects it must be able to read everything it can send.
// Call inside the workspace-lock transaction. Before replacing a destination or scope,
// also call it with the previous configuration and `retained: true`.
const assertWebhookAuthority = async (input: WebhookAuthorityInput): Promise<void> => {
  const { auth, configuration } = input;
  const permissions = getWebhookRequiredPermissions(configuration.eventTypes);
  const channelCodes =
    configuration.channels.mode === "selected" ? configuration.channels.codes : [];

  assertWebhookManageAccess(auth);

  if (!permissions.every((permission) => canReadWebhookResource(auth, permission))) {
    throw new ORPCError("FORBIDDEN", {
      message: "The selected events exceed your content read permissions"
    });
  }

  // The flag covers future restricted descendants. Current local role assignments
  // cannot delegate that open-ended authority. Keys cannot grant it.
  if (configuration.restrictedContent && !hasAuthPermission(auth, "read:restricted_collections")) {
    throw new ORPCError("FORBIDDEN", {
      message:
        "Including restricted content requires workspace-wide restricted-content read permission"
    });
  }

  if (channelCodes.length && !canReadWebhookResource(auth, "read:publishing")) {
    throw new ORPCError("FORBIDDEN", {
      message: "Selecting publishing channels requires publishing read permission"
    });
  }

  const index = await loadWebhookScopeIndex({
    database: input.database,
    workspaceID: auth.workspaceID,
    includeDeleted: input.retained
  });
  const access = createWebhookScopeAccess(configuration, index);
  const authorization =
    input.retained && configuration.collections.mode === "selected"
      ? await loadAuthorizedCollectionTree({
          auth,
          database: input.database,
          includeDeleted: true
        })
      : null;

  if (!index.rootID) {
    throw new ORPCError("NOT_FOUND", { message: "Workspace content is unavailable" });
  }

  if (
    configuration.collections.mode === "selected" &&
    !configuration.collections.roots.every((id) =>
      authorization ? authorization.canAccessCollection(id) : access.allowsCollection(id)
    )
  ) {
    throw new ORPCError("FORBIDDEN", {
      message: "The webhook scope includes an unavailable or restricted collection"
    });
  }

  if (!input.retained && channelCodes.length) {
    await assertChannelsExist(input.database, auth.workspaceID, channelCodes);
  }
};

export { assertWebhookAuthority };
