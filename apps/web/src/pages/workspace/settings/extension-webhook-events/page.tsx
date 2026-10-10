import { Button, IconButton, Tooltip } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, Show } from "solid-js";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import { extensionQuery, extensionWebhooksQuery, getWebhookErrorCode } from "#web/lib/data";
import { isSwitchedOn } from "../extension/webhook-item";
import { getExtensionPath } from "../extensions/state";
import { LoadError } from "../webhook/load-notices";
import { EventsSection } from "../webhook-events/events-section";
import type { WebhookEventsSource } from "../webhook-events/source";
import { StatusSection } from "../webhook-events/status-section";

interface EventsViewProps {
  extensionID: string;
  webhookID: string;
  workspaceID: string;
}

/** Replay sends new notifications; test samples exist only for development extensions. */
const EventsView: Component<EventsViewProps> = (props) => {
  const navigate = useNavigate();
  const notify = useNotify();
  const { hasPermission } = useWorkspace();
  const target = { extensionID: props.extensionID, workspaceID: props.workspaceID };
  const result = createAsync(async () => {
    try {
      const [extension, webhooks] = await Promise.all([
        extensionQuery(target),
        extensionWebhooksQuery(target)
      ]);
      const webhook = webhooks.find((item) => item.webhookID === props.webhookID);

      return webhook ? { extension, webhook } : { error: true as const };
    } catch (error) {
      console.error(error);

      return { error: true as const };
    }
  });
  const loaded = () => {
    const current = result();

    return current && !("error" in current) ? current : null;
  };
  const navigateBack = () => navigate(getExtensionPath(props.workspaceID, props.extensionID));
  const refresh = () => {
    void revalidate([extensionWebhooksQuery.keyFor(target), extensionQuery.keyFor(target)]);
  };
  const stateMutation = createMutation(() => ({
    retry: false,
    mutationFn: (enabled: boolean) => {
      return client.extensions.setWebhookEnabled({
        ...target,
        webhookID: props.webhookID,
        enabled,
        expectedRevision: loaded()!.extension.revision
      });
    },
    onSuccess: (_, enabled) => {
      notify({ type: "success", text: enabled ? "Webhook enabled" : "Webhook disabled" });
      refresh();
    },
    onError: (error) => {
      const code = getWebhookErrorCode(error);

      console.error(error);

      if (code === "CONFLICT" || code === "NOT_FOUND") {
        notify({ type: "error", text: "Extension changed. Try again after it reloads" });
        refresh();

        return;
      }

      notify({ type: "error", text: "Failed to change the webhook state" });
    }
  }));
  const source: WebhookEventsSource = {
    target: { ...target, webhookID: props.webhookID },
    get endpoint() {
      return loaded()?.webhook;
    },
    get canManage() {
      return hasPermission("extensions");
    },
    get canTest() {
      return hasPermission("extensions") && Boolean(loaded()?.extension.development);
    },
    get testEventTypes() {
      return (loaded()?.webhook.eventTypes ?? []).filter((type) => !type.startsWith("extension."));
    },
    replay: (deliveryIDs) => {
      return client.extensions.redeliverWebhook({
        ...target,
        webhookID: props.webhookID,
        deliveryIDs
      });
    },
    sendTest: (type) => {
      return client.extensions.sendWebhookTest({
        ...target,
        webhookID: props.webhookID,
        type: type as Parameters<typeof client.extensions.sendWebhookTest>[0]["type"]
      });
    }
  };

  return (
    <Show
      when={!(result() && "error" in result()!)}
      fallback={
        <LoadError
          label="This webhook could not be loaded"
          onRetry={() => {
            void revalidate(["extension", "extension-webhooks"]);
          }}
          onBack={navigateBack}
        />
      }
    >
      <div class="flex min-w-0 flex-col">
        <Show when={loaded()?.webhook}>{(webhook) => <StatusSection webhook={webhook()} />}</Show>
        <EventsSection source={source} />
        <div class="flex h-4 w-full items-center justify-center">
          <div class="h-px flex-1 bg-gray-200" />
        </div>
        <div class="flex items-center gap-2">
          <Tooltip content="Go back">
            <IconButton icon="i-lucide:chevron-left" onClick={navigateBack} />
          </Tooltip>
          <Show when={hasPermission("extensions") && loaded()?.webhook}>
            {(webhook) => (
              <Button
                variant={isSwitchedOn(webhook()) ? "danger" : "primary"}
                class="flex-1"
                loading={stateMutation.isPending}
                onClick={() => stateMutation.mutate(!isSwitchedOn(webhook()))}
              >
                {isSwitchedOn(webhook()) ? "Disable" : "Enable"}
              </Button>
            )}
          </Show>
        </div>
      </div>
    </Show>
  );
};
const ExtensionWebhookEventsPage: Component = () => {
  const params = useParams<{ workspaceID?: string; extensionID?: string; webhookID?: string }>();
  // Keying by route keeps list state separate for each workspace, extension, and webhook.
  const routeKey = () => {
    return [params.workspaceID || "", params.extensionID || "", params.webhookID || ""].join("/");
  };

  return (
    <Show when={routeKey()} keyed>
      {(currentKey) => {
        const [workspaceID, extensionID, webhookID] = currentKey.split("/");

        return (
          <EventsView workspaceID={workspaceID} extensionID={extensionID} webhookID={webhookID} />
        );
      }}
    </Show>
  );
};

export default ExtensionWebhookEventsPage;
