import {
  outboundDeliveries,
  webhookEndpoints,
  type DatabaseClient
} from "@andesine/server/database";
import { type WebhookConfiguration, type WebhookEndpoint } from "@andesine/contracts/webhooks";
import { toUUID, toWebhookID, toWorkspaceID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";

interface WebhookEndpointQuery {
  workspaceID: string;
  includeDeleted?: boolean;
}
interface WebhookEndpointLookup extends WebhookEndpointQuery {
  id: string;
  lock?: boolean;
}
interface WebhookEndpointListQuery extends WebhookEndpointQuery {
  cursor?: string;
  limit: number;
}

type WebhookEndpointRow = typeof webhookEndpoints.$inferSelect;

const MAX_WORKSPACE_WEBHOOKS = 10;
// Keep public endpoint discovery separate from internal delivery queries.
const endpointScope = (input: WebhookEndpointQuery) =>
  and(
    eq(webhookEndpoints.workspaceID, toUUID(input.workspaceID)),
    input.includeDeleted ? undefined : isNull(webhookEndpoints.deletedAt)
  );
const loadWebhookEndpoint = async (
  database: DatabaseClient,
  input: WebhookEndpointLookup
): Promise<WebhookEndpointRow> => {
  const query = database
    .select()
    .from(webhookEndpoints)
    .where(and(endpointScope(input), eq(webhookEndpoints.id, toUUID(input.id))));
  const [endpoint] = await (input.lock ? query.for("update") : query);

  if (!endpoint) throw new ORPCError("NOT_FOUND", { message: "Webhook not found" });

  return endpoint;
};
const listWebhookEndpoints = (database: DatabaseClient, input: WebhookEndpointListQuery) =>
  database
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        endpointScope(input),
        input.cursor ? gt(webhookEndpoints.id, toUUID(input.cursor)) : undefined
      )
    )
    .orderBy(asc(webhookEndpoints.id))
    .limit(input.limit);
const countWebhookEndpoints = async (
  database: DatabaseClient,
  input: WebhookEndpointQuery
): Promise<number> => {
  const [result] = await database
    .select({ count: count() })
    .from(webhookEndpoints)
    .where(endpointScope(input));

  return result!.count;
};
const getWebhookConfiguration = (endpoint: WebhookEndpointRow): WebhookConfiguration => ({
  name: endpoint.name,
  url: endpoint.url,
  enabled: endpoint.enabled,
  eventTypes: endpoint.eventTypes,
  schemaVersion: 1,
  collections: endpoint.collections,
  channels: endpoint.channels,
  restrictedContent: endpoint.restrictedContent
});
const describeWebhookEndpoints = async (
  database: DatabaseClient,
  endpoints: WebhookEndpointRow[],
  now: Date
): Promise<WebhookEndpoint[]> => {
  if (!endpoints.length) return [];

  const counts = await database
    .select({
      endpointID: outboundDeliveries.endpointID,
      pending: sql<number>`count(*) filter (where ${outboundDeliveries.state} = 'pending')`.mapWith(
        Number
      ),
      failed: sql<number>`count(*) filter (where ${outboundDeliveries.state} = 'failed')`.mapWith(
        Number
      )
    })
    .from(outboundDeliveries)
    .where(
      and(
        eq(outboundDeliveries.workspaceID, endpoints[0]!.workspaceID),
        inArray(
          outboundDeliveries.endpointID,
          endpoints.map(({ id }) => id)
        ),
        gt(outboundDeliveries.expiresAt, now)
      )
    )
    .groupBy(outboundDeliveries.endpointID);
  const byEndpoint = new Map(counts.map((value) => [value.endpointID, value]));

  // Explicit projection: never spread a database row containing encrypted keys.
  return endpoints.map((endpoint) => ({
    ...getWebhookConfiguration(endpoint),
    id: toWebhookID(endpoint.id),
    workspaceID: toWorkspaceID(endpoint.workspaceID),
    revision: endpoint.revision,
    destinationRevision: endpoint.destinationRevision,
    createdAt: endpoint.createdAt.toISOString(),
    updatedAt: endpoint.updatedAt.toISOString(),
    disabledReason: endpoint.disabledReason,
    health: {
      consecutiveFailures: endpoint.consecutiveFailures,
      firstFailureAt: endpoint.firstFailureAt?.toISOString() ?? null,
      lastFailureAt: endpoint.lastFailureAt?.toISOString() ?? null,
      lastFailureCategory: endpoint.lastFailureCategory,
      lastSuccessAt: endpoint.lastSuccessAt?.toISOString() ?? null,
      pendingCount: byEndpoint.get(endpoint.id)?.pending ?? 0,
      failedCount: byEndpoint.get(endpoint.id)?.failed ?? 0
    },
    signing: {
      rotatedAt: endpoint.secretRotatedAt.toISOString(),
      previousSecretExpiresAt:
        endpoint.previousSecretExpiresAt && endpoint.previousSecretExpiresAt > now
          ? endpoint.previousSecretExpiresAt.toISOString()
          : null
    }
  }));
};

export {
  loadWebhookEndpoint,
  listWebhookEndpoints,
  countWebhookEndpoints,
  getWebhookConfiguration,
  describeWebhookEndpoints,
  MAX_WORKSPACE_WEBHOOKS
};
export type { WebhookEndpointRow };
