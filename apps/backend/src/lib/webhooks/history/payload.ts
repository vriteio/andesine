import { outboundEventResources } from "#backend/db/outbound-events";
import type { DatabaseClient } from "#backend/lib/adapters/postgres";
import type { SessionData } from "#backend/lib/policy/session";
import { and, eq } from "drizzle-orm";
import { loadWebhookScopeIndex, type WebhookResourceScope } from "../scope";
import { restoreWebhookEventResources } from "../recording-context";
import { canReadWebhookPayload } from "../payload-access";
import { loadStoredWebhookEvent } from "../stored-event";
import type { WebhookDeliveryRow } from "./records";

const readRetainedWebhookPayload = async (
  database: DatabaseClient,
  auth: SessionData,
  delivery: WebhookDeliveryRow
) => {
  const event = await loadStoredWebhookEvent(database, delivery);
  const scopes: WebhookResourceScope[] = [];

  if (!event.test && event.subject.kind !== "channel") {
    const index = await loadWebhookScopeIndex({
      database,
      workspaceID: auth.workspaceID,
      includeDeleted: true
    });
    const rows = await database
      .select()
      .from(outboundEventResources)
      .where(
        and(
          eq(outboundEventResources.workspaceID, delivery.workspaceID),
          eq(outboundEventResources.eventID, delivery.eventID)
        )
      );
    const resource = restoreWebhookEventResources(rows, index).find(
      ({ kind, id }) =>
        kind === event.subject.kind && "id" in event.subject && id === event.subject.id
    );

    if (!resource) return { event, allowed: false };

    if (event.type === "entry.moved" || event.type === "collection.moved") {
      if (event.data.from.visibility === "visible") {
        if (!resource.before) return { event, allowed: false };

        scopes.push(resource.before);
      }

      if (event.data.to.visibility === "visible") {
        if (!resource.after) return { event, allowed: false };

        scopes.push(resource.after);
      }
    } else {
      const deleted = event.type === "entry.deleted" || event.type === "collection.deleted";
      const scope = deleted ? resource.before : resource.after;

      if (scope) scopes.push(scope);
    }
  }

  return { event, allowed: await canReadWebhookPayload({ auth, database, event, scopes }) };
};

export { readRetainedWebhookPayload };
