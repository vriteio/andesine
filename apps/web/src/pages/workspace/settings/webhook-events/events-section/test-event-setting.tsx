import { type Card, DropdownMenu, IconButton } from "@andesine/components";
import { createMutation } from "@tanstack/solid-query";
import { type Component, type ComponentProps } from "solid-js";
import { useNotify } from "#web/context/notifications";
import { client } from "#web/lib/api";
import { getWebhookErrorCode, type Webhook, type WebhookEventType } from "#web/lib/data";
import { Setting } from "../../setting";

interface TestEventSettingProps {
  webhook: Webhook;
}

const getTestErrorMessage = (code: string | undefined) => {
  if (code === "CONFLICT") {
    return "The webhook changed or no longer sends this event. Try again after the page updates";
  }

  if (code === "FORBIDDEN") return "You cannot send samples of this event";
  if (code === "NOT_FOUND") return "This webhook no longer exists";
  if (code === "TOO_MANY_REQUESTS") return "Too many test events. Try again shortly";

  return "Failed to send the test event";
};

// The list refreshes through the `webhook:update` event emitted after the test is queued.
const TestEventSetting: Component<TestEventSettingProps> = (props) => {
  const notify = useNotify();
  const testMutation = createMutation(() => ({
    retry: false,
    mutationFn: (type: WebhookEventType) => {
      return client.webhooks.sendTest({
        id: props.webhook.id,
        expectedRevision: props.webhook.revision,
        type
      });
    },
    onSuccess: () => notify({ type: "success", text: "Test event queued" }),
    onError: (error) => {
      console.error(error);
      notify({ type: "error", text: getTestErrorMessage(getWebhookErrorCode(error)) });
    }
  }));
  // The menu shows a spinner on the chosen event until the request settles, then closes.
  const items = () => {
    return props.webhook.eventTypes.map((type) => ({
      label: type,
      onClick: () => testMutation.mutateAsync(type).catch(() => undefined)
    }));
  };

  return (
    <Setting
      label="Send test event"
      description="Send a signed sample of a selected event. Works while the webhook is disabled"
      fade={false}
    >
      <DropdownMenu
        title="Send test event"
        placement="bottom-end"
        cardProps={{ class: "w-64" } as Partial<ComponentProps<typeof Card>>}
        items={items()}
        trigger={() => (
          <IconButton
            label={() => <span class="px-1">Send test</span>}
            class="flex-row-reverse pr-1"
            iconProps={{ class: "h-4 w-4" }}
            icon="i-lucide:chevron-down"
            size="small"
            color="contrast"
            variant="outlined"
            text="soft"
          />
        )}
      />
    </Setting>
  );
};

export { TestEventSetting };
