import type { WebhookConfiguration } from "#backend/contracts/schemas/webhooks";
import { webhookEventType, type WebhookEvent } from "./events";
import {
  createWebhookScopeAccess,
  type WebhookResourceScope,
  type WebhookScopeIndex
} from "./scope";
import type { WebhookEventChange } from "./recording-context";

// The caller supplies validated, event-time context and the workspace's current tree.
// Never use this to replace the fixed bytes of an existing delivery after a scope change.
const projectWebhookEvent = (
  change: WebhookEventChange,
  configuration: WebhookConfiguration,
  index: WebhookScopeIndex
): WebhookEvent | null => {
  const { event, resources } = change;
  const access = createWebhookScopeAccess(configuration, index);
  const allowsScope = (scope: WebhookResourceScope | null): boolean => {
    return scope !== null && access.allowsCapturedScope(scope);
  };

  if (
    !configuration.enabled ||
    !configuration.eventTypes.includes(event.type) ||
    configuration.schemaVersion !== event.schemaVersion ||
    event.workspaceID !== index.workspaceID
  ) {
    return null;
  }

  if (event.subject.kind === "channel") {
    if (!access.allowsChannel(event.subject.code)) return null;

    if (
      event.type === "publishing.channel_advanced" &&
      !resources.some((resource) => allowsScope(resource.before) || allowsScope(resource.after))
    ) {
      return null;
    }

    return event;
  }

  const [resource] = resources;

  if (!resource) return null;

  if (event.type === "entry.moved" || event.type === "collection.moved") {
    const beforeVisible = allowsScope(resource.before);
    const afterVisible = allowsScope(resource.after);

    if (!beforeVisible && !afterVisible) return null;

    // A side outside the scope is reported as hidden, never with its location.
    return webhookEventType.parse({
      ...event,
      data: {
        reason: event.data.reason,
        scopeTransition: beforeVisible ? (afterVisible ? "within" : "left") : "entered",
        from: beforeVisible ? event.data.from : { visibility: "hidden" },
        to: afterVisible ? event.data.to : { visibility: "hidden" }
      }
    });
  }

  const deleted = event.type === "entry.deleted" || event.type === "collection.deleted";
  const scope = deleted ? resource.before : resource.after;

  return allowsScope(scope) ? event : null;
};
const encodeWebhookPayload = (event: WebhookEvent): Buffer => {
  const payload = Buffer.from(JSON.stringify(webhookEventType.parse(event)), "utf8");

  if (payload.length > 262_144) throw new Error("Webhook payload exceeds 256 KiB");

  return payload;
};

export { projectWebhookEvent, encodeWebhookPayload };
