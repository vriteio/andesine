import { isIP } from "node:net";
import type { WebhookConfiguration } from "#backend/contracts/schemas/webhooks";
import { webhookEndpointRevisions } from "#backend/db/webhooks";
import { workspaces } from "#backend/db/workspaces";
import type { DatabaseTransaction } from "#backend/lib/adapters/postgres";
import { config } from "#backend/lib/config";
import { toUUID } from "#backend/lib/primitives/id";
import { consumeRateLimit } from "#backend/lib/security/rate-limit";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import type { ZodType } from "zod";
import { parseWebhookDestination, WebhookDestinationError } from "./destination";
import { reconcileWebhookEndpoint } from "./delivery/maintain-endpoint";
import { loadWebhookEndpoint } from "./endpoints";

const parseWebhookInput = <T>(schema: ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ORPCError("BAD_REQUEST", { data: { issues: result.error.issues } });
  }

  return result.data;
};
const assertWebhookDestination = (url: string): void => {
  try {
    const destination = parseWebhookDestination(url, config);

    if (isIP(destination.hostname) && !destination.allowsAddress(destination.hostname)) {
      throw new WebhookDestinationError();
    }
  } catch (error) {
    if (!(error instanceof WebhookDestinationError)) throw error;

    throw new ORPCError("BAD_REQUEST", {
      message: "Webhook destination is not allowed by server policy"
    });
  }
};
// The caller's locked-workspace transaction serializes all configuration changes.
const assertWebhookWorkspace = async (
  database: DatabaseTransaction,
  workspaceID: string
): Promise<void> => {
  if (typeof database.rollback !== "function") {
    throw new Error("Webhook configuration requires a database transaction");
  }

  const [workspace] = await database
    .select({ deletingAt: workspaces.deletingAt })
    .from(workspaces)
    .where(eq(workspaces.id, toUUID(workspaceID)))
    .for("update");

  if (!workspace) throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });

  if (workspace.deletingAt) {
    throw new ORPCError("CONFLICT", { message: "Workspace deletion is in progress" });
  }
};
const lockWebhookForUpdate = async (
  database: DatabaseTransaction,
  workspaceID: string,
  input: { id: string; expectedRevision: number }
) => {
  await assertWebhookWorkspace(database, workspaceID);

  const endpoint = await loadWebhookEndpoint(database, { workspaceID, id: input.id, lock: true });

  if (endpoint.revision !== input.expectedRevision) {
    throw new ORPCError("CONFLICT", {
      message: "Webhook configuration changed; reload it before saving"
    });
  }

  return endpoint;
};
const recordWebhookRevision = async (
  database: DatabaseTransaction,
  input: {
    workspaceID: string;
    id: string;
    revision: number;
    destinationRevision: number;
    configuration: WebhookConfiguration;
    now: Date;
  }
): Promise<void> => {
  await database.insert(webhookEndpointRevisions).values({
    workspaceID: toUUID(input.workspaceID),
    endpointID: toUUID(input.id),
    revision: input.revision,
    destinationRevision: input.destinationRevision,
    configuration: input.configuration,
    createdAt: input.now
  });
};
const reconcileWebhookConfiguration = async (
  database: DatabaseTransaction,
  workspaceID: string,
  id: string
): Promise<void> => {
  let cursor: string | null = null;

  do {
    const result = await reconcileWebhookEndpoint(database, {
      workspaceID,
      endpointID: id,
      afterRunID: cursor
    });

    if (!result.acquired) throw new Error("Webhook configuration requires the workspace lock");

    cursor = result.cursor;
  } while (cursor);
};
const limitWebhookManagement = async (
  workspaceID: string,
  action: "create" | "secret" | "test" | "redeliver"
): Promise<void> => {
  const result = await consumeRateLimit({
    scope: `webhooks:${action}`,
    key: workspaceID,
    limit: { max: 10, window: 60 }
  });

  if (!result.allowed) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Too many webhook management requests; try again shortly",
      data: { retryAfterSeconds: result.retryAfter }
    });
  }
};

export {
  parseWebhookInput,
  assertWebhookDestination,
  assertWebhookWorkspace,
  lockWebhookForUpdate,
  recordWebhookRevision,
  reconcileWebhookConfiguration,
  limitWebhookManagement
};
