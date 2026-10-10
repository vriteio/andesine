import { Button, IconButton, Tooltip } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import { type Webhook, webhookQuery } from "#web/lib/data";
import { LoadError } from "../webhook/load-notices";
import { EventsSection } from "./events-section";
import type { WebhookEventsSource } from "./source";
import { StatusSection } from "./status-section";

interface EventsViewProps {
  webhookID: string;
  workspaceID: string;
}
interface WebhookLoadResult {
  error?: true;
  webhook: Webhook | null;
}

const EventsView: Component<EventsViewProps> = (props) => {
  const navigate = useNavigate();
  const { hasPermission } = useWorkspace();
  const webhookResult = createAsync<WebhookLoadResult>(async () => {
    try {
      return {
        webhook: await webhookQuery({ webhookID: props.webhookID, workspaceID: props.workspaceID })
      };
    } catch (error) {
      console.error(error);

      return { webhook: null, error: true };
    }
  });
  const navigateToAPI = () => navigate(`/${props.workspaceID}/settings/api`);
  const source: WebhookEventsSource = {
    target: { webhookID: props.webhookID, workspaceID: props.workspaceID },
    get endpoint() {
      return webhookResult()?.webhook;
    },
    get canManage() {
      return hasPermission("webhooks");
    },
    get canTest() {
      return hasPermission("webhooks");
    },
    get testEventTypes() {
      return webhookResult()?.webhook?.eventTypes ?? [];
    },
    replay: (deliveryIDs) => {
      const webhook = webhookResult()!.webhook!;

      return client.webhooks.bulkRedeliver({
        id: webhook.id,
        deliveryIDs,
        expectedDestinationRevision: webhook.destinationRevision
      });
    },
    sendTest: (type) => {
      const webhook = webhookResult()!.webhook!;

      return client.webhooks.sendTest({
        id: webhook.id,
        expectedRevision: webhook.revision,
        type: type as Webhook["eventTypes"][number]
      });
    }
  };

  return (
    <Show
      when={!webhookResult()?.error}
      fallback={
        <LoadError
          label="This webhook could not be loaded"
          onRetry={() => {
            void revalidate("webhook");
          }}
          onBack={navigateToAPI}
        />
      }
    >
      <div class="flex min-w-0 flex-col">
        <Show when={webhookResult()?.webhook}>
          {(webhook) => <StatusSection webhook={webhook()} />}
        </Show>
        <EventsSection source={source} />
        <div class="flex h-4 w-full items-center justify-center">
          <div class="h-px flex-1 bg-gray-200" />
        </div>
        <div class="flex items-center gap-2">
          <Tooltip content="Go back">
            <IconButton icon="i-lucide:chevron-left" onClick={navigateToAPI} />
          </Tooltip>
          <Button
            variant="secondary"
            class="flex-1"
            onClick={() => {
              navigate(
                `/${props.workspaceID}/settings/webhook/${encodeURIComponent(props.webhookID)}`
              );
            }}
          >
            Edit webhook
          </Button>
        </div>
      </div>
    </Show>
  );
};
const WebhookEventsPage: Component = () => {
  const params = useParams<{ workspaceID?: string; webhookID?: string }>();
  // Keying by route keeps list state separate for each workspace and endpoint.
  const routeKey = () => `${params.workspaceID || ""}/${params.webhookID || ""}`;

  return (
    <Show when={routeKey()} keyed>
      {(currentKey) => {
        const [workspaceID, webhookID] = currentKey.split("/");

        return <EventsView workspaceID={workspaceID} webhookID={webhookID} />;
      }}
    </Show>
  );
};

export default WebhookEventsPage;
