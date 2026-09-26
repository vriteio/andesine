import { Button, IconButton, Tooltip } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import { type Webhook, webhookQuery } from "#web/lib/data";
import { LoadError } from "../webhook/load-notices";
import { EventsSection } from "./events-section";
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
        <EventsSection
          webhook={webhookResult()?.webhook}
          webhookID={props.webhookID}
          workspaceID={props.workspaceID}
        />
        <div class="flex h-4 w-full items-center justify-center">
          <div class="h-px flex-1 bg-gray-200" />
        </div>
        <div class="flex items-center gap-2">
          <Tooltip content="Go back">
            <IconButton
              variant="outlined"
              color="contrast"
              text="soft"
              size="small"
              icon="i-lucide:chevron-left"
              onClick={navigateToAPI}
            />
          </Tooltip>
          <Button
            variant="outlined"
            color="contrast"
            size="small"
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
