import { type ExtensionWebhookState } from "@andesine/contracts/extensions";
import { createAsync, revalidate, useNavigate } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createMemo, Show } from "solid-js";
import { Tree, TREE_ROOT_ID, type TreeMap } from "#web/components/tree";
import { useNotify } from "#web/context/notifications";
import { client } from "#web/lib/api";
import { createOptimisticOverrides } from "#web/lib/primitives";
import {
  extensionQuery,
  type ExtensionQueryInput,
  extensionWebhooksQuery,
  getWebhookErrorCode
} from "#web/lib/data";
import { Setting } from "../setting";
import { WebhookItem } from "./webhook-item";

interface WebhooksSectionProps {
  target: ExtensionQueryInput;
  revision: number;
  canManage: boolean;
  onConflict(): void;
}
interface StateMutationInput {
  webhooks: ExtensionWebhookState[];
  enabled: boolean;
}

type WebhookStateOverride = Pick<ExtensionWebhookState, "enabled" | "disabledReason">;

/**
 * The webhooks that the extension's manifest declares, listed like the API page's webhooks.
 * Enabling resets failure tracking without resending missed events.
 */
const WebhooksSection: Component<WebhooksSectionProps> = (props) => {
  const notify = useNotify();
  const navigate = useNavigate();
  const loadedWebhooks = createAsync(() => extensionWebhooksQuery(props.target), {
    initialValue: []
  });
  // The new states show until the refetched webhooks take over.
  const optimistic = createOptimisticOverrides<WebhookStateOverride>((webhookID): boolean => {
    return Boolean(
      stateMutation.isPending &&
      stateMutation.variables?.webhooks.some((webhook) => webhook.webhookID === webhookID)
    );
  });
  const webhooks = createMemo(() => {
    return loadedWebhooks().map((webhook) => ({
      ...webhook,
      ...optimistic.get(webhook.webhookID)
    }));
  });
  const webhooksTree = createMemo<TreeMap>(() => ({
    [TREE_ROOT_ID]: { items: webhooks().map(({ webhookID }) => webhookID), levels: [] }
  }));
  const stateMutation = createMutation(() => ({
    retry: false,
    onMutate: (input: StateMutationInput): void => {
      const state = {
        enabled: input.enabled,
        disabledReason: input.enabled ? null : "manual"
      } as const;

      input.webhooks.forEach(({ webhookID }) => optimistic.set(webhookID, state));
    },
    // Each change returns the next revision, which the following one expects.
    mutationFn: async (input: StateMutationInput) => {
      let revision = props.revision;

      for (const webhook of input.webhooks) {
        ({ revision } = await client.extensions.setWebhookEnabled({
          extensionID: props.target.extensionID,
          webhookID: webhook.webhookID,
          enabled: input.enabled,
          expectedRevision: revision
        }));
      }
    },
    onSuccess: (_, input) => {
      const count = input.webhooks.length;
      const subject = count === 1 ? "Webhook" : `${count} webhooks`;

      notify({ type: "success", text: `${subject} ${input.enabled ? "enabled" : "disabled"}` });
      void revalidate([
        extensionWebhooksQuery.keyFor(props.target),
        extensionQuery.keyFor(props.target)
      ]);
    },
    onError: (error, input) => {
      const code = getWebhookErrorCode(error);

      console.error(error);
      input.webhooks.forEach(({ webhookID }) => optimistic.clear(webhookID));

      if (code === "CONFLICT" || code === "NOT_FOUND") props.onConflict();
      else notify({ type: "error", text: "Failed to change the webhook state" });
    }
  }));
  const getWebhooks = (ids: string[]) => {
    return webhooks().filter(({ webhookID }) => ids.includes(webhookID));
  };
  const eventsPath = (webhook: ExtensionWebhookState) => {
    const { workspaceID, extensionID } = props.target;

    return `/${workspaceID}/settings/extension/${encodeURIComponent(extensionID)}/webhook/${encodeURIComponent(webhook.webhookID)}/events`;
  };
  const isPending = (webhook: ExtensionWebhookState) => {
    return Boolean(
      stateMutation.isPending &&
      stateMutation.variables?.webhooks.some(({ webhookID }) => webhookID === webhook.webhookID)
    );
  };

  optimistic.sync(loadedWebhooks);
  return (
    <Show when={webhooks().length}>
      <div class="flex flex-col">
        <div class="flex flex-col">
          <Setting
            label="Webhooks"
            description="Send signed requests to the extension's service when workspace content changes"
          />
          <div class="relative flex w-full flex-col">
            <Tree
              keyboard
              tree={webhooksTree}
              itemHeight="2rem"
              renderItem={(itemID) => {
                const webhook = () => webhooks().find(({ webhookID }) => webhookID === itemID)!;

                return (
                  <WebhookItem
                    webhook={webhook()}
                    canManage={props.canManage}
                    loading={isPending(webhook())}
                    getWebhooks={getWebhooks}
                    onEvents={() => navigate(eventsPath(webhook()))}
                    onSetEnabled={(selected, enabled) => {
                      stateMutation.mutate({ webhooks: selected, enabled });
                    }}
                  />
                );
              }}
            />
          </div>
        </div>
      </div>
    </Show>
  );
};

export { WebhooksSection };
