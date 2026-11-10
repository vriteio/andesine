import { Button, Fragment, IconButton, Tooltip } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createComputed, createMemo, createSignal, Show, untrack } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import { Dynamic } from "solid-js/web";
import { ActionConfirmationDialog } from "#web/components/action-confirmation-dialog";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import {
  getWebhookErrorCode,
  publishingChannelsQuery,
  type Webhook,
  webhookQuery,
  webhooksQuery
} from "#web/lib/data";
import { SecretDialog } from "../secret-dialog";
import { AccessSection } from "./access-section";
import {
  createDraftFromWebhook,
  createEmptyDraft,
  getChangeNotices,
  getDraftChanges,
  getEffectiveDraft,
  getSaveErrorMessage,
  trimDraftFields,
  validateDraft,
  type WebhookDraft,
  type WebhookDraftChanges
} from "./configuration";
import { DetailsSection } from "./details-section";
import { LoadError, StaleNotice } from "./load-notices";
import { EventsSection } from "./events-section";

interface WebhookEditorProps {
  webhookID: string | null;
  workspaceID: string;
}
interface WebhookLoadResult {
  error?: true;
  webhook: Webhook | null;
}
const WebhookEditor: Component<WebhookEditorProps> = (props) => {
  const notify = useNotify();
  const navigate = useNavigate();
  const { hasPermission } = useWorkspace();
  const [draft, setDraft] = createStore<WebhookDraft>(createEmptyDraft());
  const [baseline, setBaseline] = createSignal<Webhook | null>(null);
  const [stale, setStale] = createSignal(false);
  const [secret, setSecret] = createSignal("");
  const [createdID, setCreatedID] = createSignal<string | null>(null);
  const [pendingChanges, setPendingChanges] = createSignal<WebhookDraftChanges | null>(null);
  // Explicit reload discards edits; refetches after dedicated actions keep them.
  const reloadState = { requested: false };
  const webhookResult = createAsync<WebhookLoadResult>(async () => {
    if (!props.webhookID) return { webhook: null };

    try {
      return {
        webhook: await webhookQuery({ webhookID: props.webhookID, workspaceID: props.workspaceID })
      };
    } catch (error) {
      console.error(error);

      return { webhook: null, error: true };
    }
  });
  const channels = createAsync(() => publishingChannelsQuery(), { initialValue: [] });
  const creating = () => !props.webhookID;
  const canManage = () => hasPermission("webhooks");
  const formDisabled = () => {
    const loading = !creating() && !baseline();

    return !canManage() || stale() || loading || saving() || Boolean(createdID());
  };
  // Serializing reads every draft field, so the memo tracks nested store changes.
  const changes = createMemo(() => {
    return getDraftChanges(JSON.parse(JSON.stringify(draft)) as WebhookDraft, baseline());
  });
  const hasChanges = () => Object.keys(changes()).length > 0;
  const fillError = createMemo(() => {
    if (stale()) return "Reload the webhook before saving";

    return validateDraft(draft) || (!creating() && !hasChanges() ? "No changes to save" : "");
  });
  const settingsPath = () => `/${props.workspaceID}/settings`;
  const navigateToAPI = () => navigate(`${settingsPath()}/api`);
  const detailKey = () => {
    return webhookQuery.keyFor({
      webhookID: props.webhookID || "",
      workspaceID: props.workspaceID
    });
  };
  const reload = () => {
    reloadState.requested = true;
    void revalidate(detailKey());
  };
  const applySavedWebhook = (webhook: Webhook) => {
    setBaseline(webhook);
    setDraft(reconcile(createDraftFromWebhook(webhook)));
    void revalidate([webhooksQuery.keyFor(props.workspaceID), detailKey()]);
  };
  const handleSaveError = (error: unknown, urlChanged: boolean) => {
    const code = getWebhookErrorCode(error);

    console.error(error);

    if (code === "CONFLICT" || code === "NOT_FOUND") {
      setStale(true);
      notify({ type: "error", text: "Webhook changed. Reload it to continue" });

      return;
    }

    notify({ type: "error", text: getSaveErrorMessage(code, creating(), urlChanged) });
  };
  const createWebhookMutation = createMutation(() => ({
    retry: false,
    mutationFn: (input: WebhookDraft) => {
      return client.webhooks.create({ ...trimDraftFields(input), schemaVersion: 1 });
    },
    onSuccess: (result) => {
      setCreatedID(result.endpoint.id);
      setSecret(result.secret);
      void revalidate(webhooksQuery.keyFor(props.workspaceID));
    },
    onError: (error) => handleSaveError(error, false),
    // The mutation result holds the plaintext secret, so clear it as soon as it is handed off.
    onSettled: () => {
      createWebhookMutation.reset();
    }
  }));
  const updateWebhookMutation = createMutation(() => ({
    retry: false,
    mutationFn: (input: WebhookDraftChanges & { id: string; expectedRevision: number }) => {
      return client.webhooks.update(trimDraftFields(input));
    },
    onSuccess: (result) => {
      setPendingChanges(null);
      applySavedWebhook(result.endpoint);

      if (result.secretChanged) {
        setSecret(result.secret);
      } else {
        notify({ type: "success", text: "Webhook saved" });
      }
    },
    onError: (error, input) => {
      setPendingChanges(null);
      handleSaveError(error, input.url !== undefined);
    },
    onSettled: () => {
      updateWebhookMutation.reset();
    }
  }));
  const saving = () => createWebhookMutation.isPending || updateWebhookMutation.isPending;
  const saveChanges = (webhookChanges: WebhookDraftChanges) => {
    const webhook = baseline();

    if (!webhook) return;

    updateWebhookMutation.mutate({
      ...structuredClone(webhookChanges),
      id: webhook.id,
      expectedRevision: webhook.revision
    });
  };
  const save = () => {
    const webhook = baseline();
    const webhookChanges = changes();

    if (creating()) {
      createWebhookMutation.mutate(structuredClone(getEffectiveDraft(unwrap(draft))));

      return;
    }

    if (!webhook) return;

    const needsConfirmation = getChangeNotices(webhook, webhookChanges).some(
      (notice) => notice.id !== "backfill"
    );

    if (needsConfirmation) {
      setPendingChanges(webhookChanges);
    } else {
      saveChanges(webhookChanges);
    }
  };

  // Runs during server rendering too, so SSR includes the loaded status and form values.
  createComputed(() => {
    const result = webhookResult();
    const webhook = result?.webhook;
    const current = untrack(baseline);

    if (!webhook) return;

    if (!reloadState.requested && current) {
      const configurationKeys = Object.keys(
        getDraftChanges(createDraftFromWebhook(webhook), current)
      ).filter((key) => key !== "enabled");

      // Our own save is still applying its result; it revalidates again afterwards.
      if (untrack(saving)) return;

      // Health, signing, and enabled-state updates never conflict with form edits.
      if (!configurationKeys.length) {
        setBaseline(webhook);
        setDraft("enabled", webhook.enabled);

        return;
      }

      // Someone else changed the configuration. Never overwrite unsaved edits.
      if (untrack(hasChanges)) {
        setStale(true);

        return;
      }
    }

    reloadState.requested = false;
    setStale(false);
    setBaseline(webhook);
    setDraft(reconcile(createDraftFromWebhook(webhook)));
  });

  return (
    <>
      <SecretDialog
        kind="webhook-secret"
        secret={secret()}
        onClose={() => {
          const id = createdID();

          setSecret("");

          if (id) {
            navigate(`${settingsPath()}/webhook/${encodeURIComponent(id)}`, { replace: true });
          }
        }}
      />
      <ActionConfirmationDialog
        opened={Boolean(pendingChanges())}
        title="Save webhook changes?"
        description="Review how these changes affect delivery."
        affected={
          baseline() && pendingChanges() ? getChangeNotices(baseline()!, pendingChanges()!) : []
        }
        action={{
          color: "primary",
          label: "Save changes",
          loading: updateWebhookMutation.isPending,
          onClick: () => {
            const webhookChanges = pendingChanges();

            if (webhookChanges) saveChanges(webhookChanges);
          }
        }}
        onClose={() => {
          if (!updateWebhookMutation.isPending) setPendingChanges(null);
        }}
      />
      <Show
        when={!webhookResult()?.error}
        fallback={
          <LoadError
            label="This webhook could not be loaded"
            onRetry={reload}
            onBack={navigateToAPI}
          />
        }
      >
        <div class="flex min-w-0 flex-col">
          <Show when={stale()}>
            <StaleNotice onReload={reload} />
          </Show>
          <DetailsSection draft={draft} setDraft={setDraft} disabled={formDisabled()} />
          <EventsSection draft={draft} setDraft={setDraft} disabled={formDisabled()} />
          <AccessSection
            channels={channels()}
            draft={draft}
            setDraft={setDraft}
            disabled={formDisabled()}
          />
          <div class="flex h-4 w-full items-center justify-center">
            <div class="h-px flex-1 bg-gray-200" />
          </div>
          <div class="flex items-center justify-end gap-2">
            <Tooltip content="Go back">
              <IconButton
                icon="i-lucide:chevron-left"
                disabled={saving()}
                onClick={navigateToAPI}
              />
            </Tooltip>
            <Show when={canManage()}>
              <Dynamic
                component={fillError() ? Tooltip : Fragment}
                content={fillError()}
                wrapperClass="flex-1"
              >
                <Button
                  class="flex w-full items-center justify-center gap-1"
                  disabled={formDisabled() || Boolean(fillError())}
                  loading={saving()}
                  onClick={save}
                >
                  {creating() ? "Create webhook" : "Save changes"}
                </Button>
              </Dynamic>
            </Show>
          </div>
        </div>
      </Show>
    </>
  );
};
const WebhookSettingsPage: Component = () => {
  const params = useParams<{ workspaceID?: string; webhookID?: string }>();
  // Keying by route keeps editor state separate for each workspace and endpoint.
  const routeKey = () => `${params.workspaceID || ""}/${params.webhookID || ""}`;

  return (
    <Show when={routeKey()} keyed>
      {(currentKey) => {
        const [workspaceID, webhookID] = currentKey.split("/");

        return <WebhookEditor workspaceID={workspaceID} webhookID={webhookID || null} />;
      }}
    </Show>
  );
};

export default WebhookSettingsPage;
