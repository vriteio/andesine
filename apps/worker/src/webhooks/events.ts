interface WebhookUpdateEvent {
  action: "webhook:update";
  data: { id: string };
}

type PublishEvent = (channel: string, message: string) => Promise<unknown>;

const publishWebhookUpdate = (
  publish: PublishEvent,
  workspaceID: string,
  endpointID: string
): void => {
  const event: WebhookUpdateEvent = { action: "webhook:update", data: { id: endpointID } };

  void Promise.resolve()
    .then(() => publish(`${workspaceID}:webhooks`, JSON.stringify(event)))
    .catch((error: unknown) => {
      console.error("Failed to publish webhook update", { endpointID, error });
    });
};

export { publishWebhookUpdate };
export type { PublishEvent };
