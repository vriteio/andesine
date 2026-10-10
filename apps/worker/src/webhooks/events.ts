import { webhookEndpoints } from "@andesine/server/database";
import { toExtensionID, toUUID } from "@andesine/contracts/primitives";
import { eq } from "drizzle-orm";
import { db } from "../database";

interface WebhookUpdateEvent {
  action: "webhook:update" | "extension:update";
  data: { id: string };
}

type PublishEvent = (channel: string, message: string) => Promise<unknown>;

const publishWebhookUpdate = (
  publish: PublishEvent,
  workspaceID: string,
  endpointID: string
): void => {
  // Extension webhooks are reported as their extension, so webhook clients never see their IDs.
  const getUpdate = async (): Promise<[string, WebhookUpdateEvent]> => {
    const [endpoint] = await db
      .select({ extensionID: webhookEndpoints.extensionID })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, toUUID(endpointID)));

    return endpoint?.extensionID
      ? [
          `${workspaceID}:extensions`,
          { action: "extension:update", data: { id: toExtensionID(endpoint.extensionID) } }
        ]
      : [`${workspaceID}:webhooks`, { action: "webhook:update", data: { id: endpointID } }];
  };

  void getUpdate()
    .then(([channel, event]) => publish(channel, JSON.stringify(event)))
    .catch((error: unknown) => {
      console.error("Failed to publish webhook update", { endpointID, error });
    });
};

export { publishWebhookUpdate };
export type { PublishEvent };
