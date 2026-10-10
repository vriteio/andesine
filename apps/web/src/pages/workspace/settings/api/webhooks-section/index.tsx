import { Button, Card, IconButton } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createMemo, createSignal, ErrorBoundary, Show, Suspense } from "solid-js";
import { Tree, TREE_ROOT_ID, type TreeMap, TreeSkeleton } from "#web/components/tree";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import { createOptimisticOverrides, type OptimisticOverrides } from "#web/lib/primitives";
import { getWebhookErrorCode, type Webhook, webhooksQuery } from "#web/lib/data";
import { SecretDialog } from "../../secret-dialog";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";
import { DeleteWebhookDialog } from "./delete-webhook-dialog";
import { RotateSecretDialog, type RotationMode } from "./rotate-secret-dialog";
import { WebhookItem } from "./webhook-item";

interface WebhookListProps {
  canManage: boolean;
  workspaceID: string;
  /** New states shown until the refetched webhooks take over. */
  optimistic: OptimisticOverrides<WebhookStateOverride>;
  isPending(id: string): boolean;
  onDelete(webhooks: Webhook[]): void;
  onEvents(webhook: Webhook): void;
  onEdit(webhook: Webhook): void;
  onRotate(webhook: Webhook): void;
  onSetEnabled(webhooks: Webhook[], enabled: boolean): void;
}
interface StateMutationInput {
  enabled: boolean;
  webhooks: Webhook[];
}
interface WebhookLoadErrorProps {
  onRetry(): void;
}

type WebhookStateOverride = Pick<Webhook, "enabled" | "disabledReason">;

const WebhookList: Component<WebhookListProps> = (props) => {
  const webhooks = createAsync(() => webhooksQuery(props.workspaceID), { initialValue: [] });
  const orderedWebhooks = createMemo(() => {
    return webhooks()
      .map((webhook) => ({ ...webhook, ...props.optimistic.get(webhook.id) }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
  const getWebhooks = (ids: string[]) => {
    return orderedWebhooks().filter((webhook) => ids.includes(webhook.id));
  };
  const webhooksTree = createMemo<TreeMap>(() => ({
    [TREE_ROOT_ID]: { items: orderedWebhooks().map((webhook) => webhook.id), levels: [] }
  }));

  props.optimistic.sync(webhooks);

  return (
    <Show
      when={orderedWebhooks().length}
      fallback={
        <Card
          class="flex h-16 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
          shade
        >
          <div class="i-lucide:webhook h-5.5 w-5.5 text-gray-300" />
          No webhooks
        </Card>
      }
    >
      <Tree
        keyboard
        tree={webhooksTree}
        itemHeight="2rem"
        renderItem={(itemID) => {
          const webhook = () => orderedWebhooks().find((current) => current.id === itemID)!;

          return (
            <WebhookItem
              webhook={webhook()}
              canManage={props.canManage}
              loading={props.isPending(webhook().id)}
              getWebhooks={getWebhooks}
              onEdit={() => props.onEdit(webhook())}
              onEvents={() => props.onEvents(webhook())}
              onSetEnabled={props.onSetEnabled}
              onRotate={() => props.onRotate(webhook())}
              onDelete={props.onDelete}
            />
          );
        }}
      />
    </Show>
  );
};
const WebhookLoadError: Component<WebhookLoadErrorProps> = (props) => (
  <Card
    class="flex h-16 items-center justify-center gap-2 rounded-lg bg-white px-2 text-sm text-gray-400"
    shade
  >
    <div class="i-lucide:circle-alert h-5.5 w-5.5 text-gray-300" />
    Webhooks could not be loaded
    <Button variant="secondary" onClick={props.onRetry}>
      Retry
    </Button>
  </Card>
);
const WebhooksSection: Component = () => {
  const { hasPermission } = useWorkspace();
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string }>();
  const notify = useNotify();
  const [deletionTargets, setDeletionTargets] = createSignal<Webhook[]>([]);
  const [rotationTarget, setRotationTarget] = createSignal<Webhook | null>(null);
  const [secret, setSecret] = createSignal("");
  const workspaceID = () => params.workspaceID || "";
  const settingsPath = () => `/${workspaceID()}/settings`;
  const refresh = async (onRefreshed?: () => void) => {
    await revalidate(webhooksQuery.keyFor(workspaceID()));
    onRefreshed?.();
  };
  const openWebhook = (webhook: Webhook) => {
    navigate(`${settingsPath()}/webhook/${encodeURIComponent(webhook.id)}`);
  };
  const handleError = (error: unknown, fallback: string) => {
    const code = getWebhookErrorCode(error);

    console.error(error);

    if (code === "CONFLICT" || code === "NOT_FOUND") {
      notify({ type: "error", text: "Webhook changed. Try again after the list updates" });
      void refresh();

      return;
    }

    if (code === "FORBIDDEN") {
      notify({ type: "error", text: "You cannot approve this webhook's data access" });

      return;
    }

    notify({ type: "error", text: fallback });
  };
  const optimistic = createOptimisticOverrides<WebhookStateOverride>((id): boolean => {
    return Boolean(
      stateMutation.isPending &&
      stateMutation.variables?.webhooks.some((webhook) => webhook.id === id)
    );
  });
  const stateMutation = createMutation(() => ({
    retry: false,
    onMutate: (input: StateMutationInput): void => {
      const state = {
        enabled: input.enabled,
        disabledReason: input.enabled ? null : "manual"
      } as const;

      input.webhooks.forEach(({ id }) => optimistic.set(id, state));
    },
    mutationFn: (input: StateMutationInput) => {
      return client.webhooks.bulkSetEnabled({
        enabled: input.enabled,
        webhooks: input.webhooks.map(({ id, revision }) => ({ id, expectedRevision: revision }))
      });
    },
    onSuccess: (_, input) => {
      const count = input.webhooks.length;
      const subject = count === 1 ? "Webhook" : `${count} webhooks`;

      notify({ type: "success", text: `${subject} ${input.enabled ? "enabled" : "disabled"}` });
      void refresh();
    },
    onError: (error, input) => {
      input.webhooks.forEach(({ id }) => optimistic.clear(id));
      handleError(error, "Failed to change webhook state. Check the list before trying again");
    }
  }));
  const rotateMutation = createMutation(() => ({
    retry: false,
    mutationFn: (input: { id: string; expectedRevision: number; mode: RotationMode }) => {
      return client.webhooks.rotateSecret(input);
    },
    onSuccess: (result) => {
      setRotationTarget(null);
      setSecret(result.secret);
      void refresh();
    },
    onError: (error) => {
      handleError(
        error,
        "Failed to rotate secret. If it may have rotated, rotate again to get a secret you can see"
      );
    },
    // The mutation result holds the plaintext secret, so clear it as soon as it is handed off.
    onSettled: () => {
      rotateMutation.reset();
    }
  }));
  // Spinners belong only to webhooks with an action in progress.
  const isPending = (id: string) => {
    const toggling =
      stateMutation.isPending &&
      Boolean(stateMutation.variables?.webhooks.some((webhook) => webhook.id === id));
    const rotating = rotateMutation.isPending && rotateMutation.variables?.id === id;

    return toggling || rotating;
  };

  return (
    <SettingsSection label="Webhooks">
      <SecretDialog kind="webhook-secret" secret={secret()} onClose={() => setSecret("")} />
      <RotateSecretDialog
        webhook={rotationTarget()}
        loading={rotateMutation.isPending}
        onClose={() => setRotationTarget(null)}
        onConfirm={(mode) => {
          const webhook = rotationTarget();

          if (webhook) {
            rotateMutation.mutate({ id: webhook.id, expectedRevision: webhook.revision, mode });
          }
        }}
      />
      <DeleteWebhookDialog
        webhooks={deletionTargets()}
        onClose={() => setDeletionTargets([])}
        onDeleted={() => refresh(() => setDeletionTargets([]))}
        onConflict={() => refresh(() => setDeletionTargets([]))}
      />
      <div class="flex flex-col">
        <Setting
          label="Webhooks"
          description="Send signed requests to external services when workspace content changes"
        >
          <div class="flex items-center gap-1">
            <Show when={hasPermission("webhooks")}>
              <IconButton
                label={() => <span class="px-1">Create webhook</span>}
                class="flex-row-reverse pr-1"
                onClick={() => navigate(`${settingsPath()}/webhook`)}
                iconProps={{ class: "h-4 w-4" }}
                icon="i-lucide:plus"
              />
            </Show>
          </div>
        </Setting>
        <div class="relative flex w-full flex-col">
          <ErrorBoundary
            fallback={(_, reset) => <WebhookLoadError onRetry={() => refresh(reset)} />}
          >
            <Suspense
              fallback={<TreeSkeleton fullWidth itemHeight="2rem" rowCount={2} size="medium" />}
            >
              <WebhookList
                workspaceID={workspaceID()}
                canManage={hasPermission("webhooks")}
                optimistic={optimistic}
                isPending={isPending}
                onEdit={openWebhook}
                onEvents={(webhook) => {
                  navigate(`${settingsPath()}/webhook/${encodeURIComponent(webhook.id)}/events`);
                }}
                onRotate={setRotationTarget}
                onDelete={setDeletionTargets}
                onSetEnabled={(webhooks, enabled) => stateMutation.mutate({ webhooks, enabled })}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </SettingsSection>
  );
};

export { WebhooksSection };
