import { type ExtensionWebhookState } from "@andesine/contracts/extensions";
import { Button } from "@andesine/components";
import { createAsync, revalidate, useNavigate } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, Show } from "solid-js";
import { TimeAgo } from "#web/components/time-ago";
import { useNotify } from "#web/context/notifications";
import { client } from "#web/lib/api";
import {
  extensionQuery,
  type ExtensionQueryInput,
  extensionWebhooksQuery,
  getWebhookErrorCode
} from "#web/lib/data";
import { Notice } from "./notice";

interface ServiceNoticeProps {
  target: ExtensionQueryInput;
  revision: number;
  canManage: boolean;
  onConflict(): void;
}

const isFailing = (webhook: ExtensionWebhookState): boolean => {
  return webhook.disabledReason === "failures" || webhook.health.consecutiveFailures > 0;
};

/**
 * Shown when the extension's webhooks cannot reach its external service; webhooks are
 * otherwise a developer detail. "Try again" re-enables the webhooks that failures disabled.
 */
const ServiceNotice: Component<ServiceNoticeProps> = (props) => {
  const notify = useNotify();
  const navigate = useNavigate();
  const webhooks = createAsync(() => extensionWebhooksQuery(props.target), { initialValue: [] });
  const failing = () => webhooks().filter(isFailing);
  const failingSince = () => {
    const dates = failing().flatMap(({ health }) => {
      const date = health.firstFailureAt || health.lastFailureAt;

      return date ? [date] : [];
    });

    return dates.sort()[0];
  };
  const retryMutation = createMutation(() => ({
    retry: false,
    // Each change returns the next revision, which the following one expects.
    mutationFn: async () => {
      let revision = props.revision;

      for (const webhook of failing().filter(
        ({ disabledReason }) => disabledReason === "failures"
      )) {
        ({ revision } = await client.extensions.setWebhookEnabled({
          extensionID: props.target.extensionID,
          webhookID: webhook.webhookID,
          enabled: true,
          expectedRevision: revision
        }));
      }
    },
    onSuccess: () => {
      notify({ type: "success", text: "Trying again" });
      void revalidate([
        extensionWebhooksQuery.keyFor(props.target),
        extensionQuery.keyFor(props.target)
      ]);
    },
    onError: (error) => {
      const code = getWebhookErrorCode(error);

      console.error(error);

      if (code === "CONFLICT" || code === "NOT_FOUND") props.onConflict();
      else notify({ type: "error", text: "Failed to turn its webhooks back on" });
    }
  }));
  const eventsPath = () => {
    const { workspaceID, extensionID } = props.target;
    const webhook = failing()[0];

    return `/${workspaceID}/settings/extension/${encodeURIComponent(extensionID)}/webhook/${encodeURIComponent(webhook?.webhookID ?? "")}/events`;
  };
  const canRetry = () => {
    return props.canManage && failing().some(({ disabledReason }) => disabledReason === "failures");
  };

  return (
    <Show when={failing().length}>
      <div class="pb-4">
        <Notice
          icon="i-lucide:circle-alert text-red-500"
          actions={
            <>
              <Button variant="ghost" text="soft" onClick={() => navigate(eventsPath())}>
                Details
              </Button>
              <Show when={canRetry()}>
                <Button
                  variant="secondary"
                  loading={retryMutation.isPending}
                  onClick={() => retryMutation.mutate()}
                >
                  Try again
                </Button>
              </Show>
            </>
          }
        >
          Can't reach its external service
          <Show when={failingSince()}>
            {(date) => (
              <>
                {" "}
                since <TimeAgo date={date()} />
              </>
            )}
          </Show>
          .
        </Notice>
      </div>
    </Show>
  );
};

export { ServiceNotice };
