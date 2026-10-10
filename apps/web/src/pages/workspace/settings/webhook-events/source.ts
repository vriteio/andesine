import { type Webhook, type WebhookQueryInput } from "#web/lib/data";

/** Endpoint state shared by HTTP and extension webhooks. */
interface WebhookEventsEndpoint {
  url: string;
  enabled: boolean;
  disabledReason: string | null;
  eventTypes: string[];
  health: Webhook["health"];
}
interface WebhookEventsSource {
  target: WebhookQueryInput;
  endpoint: WebhookEventsEndpoint | null | undefined;
  canManage: boolean;
  canTest: boolean;
  testEventTypes: string[];
  replay(deliveryIDs: string[]): Promise<unknown>;
  sendTest(type: string): Promise<unknown>;
}

export type { WebhookEventsEndpoint, WebhookEventsSource };
